import { WebSocketServer } from 'ws'

const PORT = Number(process.env.WS_PORT || 8787)
const TICK_MS = 1500

const points = {
  'p-zone-temp': { name: '办公区温度', value: 23.8, min: 10, max: 35, precision: 1, sim: { amp: 0.35, speed: 0.05, phase: 0.3 } },
  'p-zone-humidity': { name: '办公区湿度', value: 48.6, min: 20, max: 80, precision: 1, sim: { amp: 1.1, speed: 0.045, phase: 1.6 } },
  'p-zone-co2': { name: '办公区 CO₂', value: 824, min: 400, max: 1600, precision: 0, sim: { amp: 25, speed: 0.052, phase: 2.2 } },
  'p-supply-temp': { name: '送风温度', value: 16.8, min: 8, max: 30, precision: 1, sim: { amp: 0.45, speed: 0.055, phase: 0.8 } },
  'p-return-temp': { name: '回风温度', value: 24.1, min: 15, max: 32, precision: 1, sim: { amp: 0.35, speed: 0.043, phase: 1.9 } },
  'p-duct-pressure': { name: '送风静压', value: 428, min: 0, max: 1000, precision: 0, sim: { amp: 14, speed: 0.06, phase: 2.6 } },
  'p-fan-speed': { name: '送风频率', value: 42, min: 0, max: 50, precision: 1, writable: true },
  'p-chw-valve': { name: '冷冻水阀开度', value: 62, min: 0, max: 100, precision: 0, writable: true },
  'p-setpoint': { name: '温度设定值', value: 24, min: 16, max: 30, precision: 1, writable: true },
  'p-unit-running': { name: '机组运行状态', value: true, writable: true, boolean: true },
  'p-mode': { name: '运行模式', value: 'auto', writable: true, string: true },
  'p-power': { name: '机组功率', value: 38.6, min: 0, max: 120, precision: 1, sim: { amp: 2.2, speed: 0.047, phase: 0.6 } },
  'p-energy': { name: '今日能耗', value: 1284.6, min: 0, max: 5000, precision: 1, sim: { amp: 0.06, speed: 0.02, phase: 2.9 } },
  'p-chiller-load': { name: '冷机负载', value: 68.4, min: 0, max: 100, precision: 1, sim: { amp: 2.8, speed: 0.05, phase: 1.1 } },
  'p-chw-supply': { name: '冷冻水供水', value: 7.2, min: 0, max: 15, precision: 1, sim: { amp: 0.18, speed: 0.058, phase: 2.3 } },
  'p-chw-return': { name: '冷冻水回水', value: 12.4, min: 6, max: 20, precision: 1, sim: { amp: 0.28, speed: 0.049, phase: 3.1 } },
  'p-chiller-running': { name: '冷机运行状态', value: true, writable: true, boolean: true },
  'p-tower-running': { name: '冷却塔运行', value: true, writable: true, boolean: true },
  'p-filter-dp': { name: '过滤器压差', value: 168, min: 0, max: 400, precision: 0, sim: { amp: 2.5, speed: 0.061, phase: 0.9 } },
  'p-outdoor-temp': { name: '室外温度', value: 31.2, min: 10, max: 42, precision: 1, sim: { amp: 0.22, speed: 0.035, phase: 4.1 } },
  'p-tank-level': { name: '水箱液位', value: 72, min: 0, max: 100, precision: 0, sim: { amp: 1.1, speed: 0.042, phase: 1.4 } },
  'p-alarm': { name: '综合告警', value: false, boolean: true },
}

const round = (value, precision) => Number(value.toFixed(precision + 1))
const snapshot = () => Object.fromEntries(Object.entries(points).map(([id, point]) => [id, point.value]))
let tick = 0

function simulate() {
  tick += 1
  const updates = {}
  for (const [id, point] of Object.entries(points)) {
    if (!point.sim || point.writable) continue
    const { amp, speed, phase } = point.sim
    const value =
      point.value +
      Math.sin(tick * speed * 0.7 + phase) * amp * 0.08 +
      Math.sin(tick * 0.09 + phase) * amp * 0.02
    point.value = round(Math.min(point.max, Math.max(point.min, value)), point.precision)
    updates[id] = point.value
  }
  return updates
}

function writePoint(id, rawValue, source) {
  const point = points[id]
  if (!point) return { ok: false, error: 'unknown point' }
  if (!point.writable) return { ok: false, error: 'point is read-only' }
  let value = rawValue
  if (point.boolean) {
    value =
      typeof rawValue === 'boolean'
        ? rawValue
        : ['true', '1', 'on', 1].includes(typeof rawValue === 'string' ? rawValue.toLowerCase() : rawValue)
  } else if (point.string) {
    value = String(rawValue)
  } else {
    value = Number(rawValue)
    if (!Number.isFinite(value)) return { ok: false, error: 'invalid numeric value' }
    value = Math.min(point.max, Math.max(point.min, value))
  }
  point.value = value
  const updates = { [id]: value }

  if (id === 'p-unit-running') {
    if (value === false) {
      points['p-fan-speed'].value = 0
      updates['p-fan-speed'] = 0
    } else if (Number(points['p-fan-speed'].value) === 0) {
      points['p-fan-speed'].value = 42
      updates['p-fan-speed'] = 42
    }
  }
  if (id === 'p-fan-speed') {
    const running = Number(value) > 0
    points['p-unit-running'].value = running
    updates['p-unit-running'] = running
  }

  console.log(`[write] ${new Date().toLocaleTimeString('zh-CN')} ${source || 'HMI'} ${id}=${value}`)
  return { ok: true, updates }
}

const server = new WebSocketServer({ host: '127.0.0.1', port: PORT })

function broadcast(payload) {
  const message = JSON.stringify(payload)
  for (const client of server.clients) {
    if (client.readyState === 1) client.send(message)
  }
}

server.on('listening', () => {
  console.log(`\nAERON HMI mock WebSocket server`)
  console.log(`  ws://127.0.0.1:${PORT}`)
  console.log(`  ${Object.keys(points).length} points · updates every ${TICK_MS} ms`)
  console.log(`  Press Ctrl+C to stop\n`)
})

server.on('connection', (socket, request) => {
  const address = request.socket.remoteAddress
  console.log(`[connect] ${address}`)
  socket.send(JSON.stringify({ type: 'points.snapshot', points: snapshot() }))
  socket.on('message', (raw) => {
    let message
    try {
      message = JSON.parse(String(raw))
    } catch {
      socket.send(JSON.stringify({ type: 'error', error: 'invalid JSON' }))
      return
    }
    if (message.type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
      return
    }
    if (message.type === 'point.write') {
      const result = writePoint(message.id, message.value, message.source)
      if (!result.ok) {
        socket.send(JSON.stringify({ type: 'point.write.error', id: message.id, error: result.error }))
        return
      }
      socket.send(
        JSON.stringify({
          type: 'point.write.ack',
          id: message.id,
          value: result.updates[message.id],
        }),
      )
      broadcast({ type: 'points.update', points: result.updates })
    }
  })
  socket.on('close', () => {
    console.log(`[close] ${address}`)
  })
})

const timer = setInterval(() => {
  const updates = simulate()
  if (Object.keys(updates).length) broadcast({ type: 'points.update', points: updates })
}, TICK_MS)

process.on('SIGINT', () => {
  console.log('\nStopping mock server…')
  clearInterval(timer)
  server.close(() => process.exit(0))
})
