import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ConnectionStatus,
  DataMode,
  PointDefinition,
  PointValue,
  WsEvent,
} from '../types'
import { clamp, nowTimeLabel, uid } from '../lib/graph'

const URL_KEY = 'aeron-hmi-ws-url'
const RECONNECT_KEY = 'aeron-hmi-auto-reconnect'
const DEFAULT_URL = 'ws://127.0.0.1:8787'
const MAX_HISTORY = 90

function normalizeRemoteValue(point: PointDefinition, raw: unknown): PointValue | null {
  if (point.pointType === 'DI' || point.pointType === 'DO') {
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'number') return raw >= 0.5
    if (typeof raw === 'string') {
      const text = raw.trim().toLowerCase()
      if (['true', '1', 'on', 'yes', '运行', '启动'].includes(text)) return true
      if (['false', '0', 'off', 'no', '停止'].includes(text)) return false
    }
    return null
  }
  if (point.pointType === 'STRING') {
    if (raw === null || raw === undefined) return null
    return String(raw)
  }
  const numeric = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(numeric)) return null
  return Math.round(numeric * 10 ** (point.precision + 1)) / 10 ** (point.precision + 1)
}

function nextPoint(point: PointDefinition, raw: unknown, at = Date.now()): PointDefinition {
  const next = normalizeRemoteValue(point, raw)
  if (next === null) return point
  const numeric = typeof next === 'number' && point.pointType !== 'STRING'
  return {
    ...point,
    value: next,
    quality: 'good',
    history: numeric
      ? [...point.history.slice(-(MAX_HISTORY - 1)), { t: at, v: next }]
      : point.history,
  }
}

function extractUpdates(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  if (Array.isArray(payload)) {
    const map: Record<string, unknown> = {}
    for (const item of payload) {
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        if (typeof record.id === 'string' && 'value' in record) map[record.id] = record.value
      }
    }
    return Object.keys(map).length ? map : null
  }
  const object = payload as Record<string, unknown>
  if (typeof object.id === 'string' && 'value' in object) {
    return { [object.id]: object.value }
  }
  const nested = object.points ?? object.values ?? (object.data as Record<string, unknown> | undefined)?.points
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>
  }
  if (
    object.type === 'point.update' ||
    object.type === 'points.snapshot' ||
    object.type === 'points.update' ||
    object.type === 'point.write.ack' ||
    object.type === 'point.write.error' ||
    object.type === 'error'
  ) {
    return null
  }
  return object
}

export interface LiveDataApi {
  points: PointDefinition[]
  pointMap: Map<string, PointDefinition>
  mode: DataMode
  status: ConnectionStatus
  url: string
  setUrl: (url: string) => void
  autoReconnect: boolean
  setAutoReconnect: (enabled: boolean) => void
  connect: (url?: string) => void
  disconnect: () => void
  useDemo: () => void
  writePoint: (pointId: string, value: PointValue, source?: string) => boolean
  events: WsEvent[]
  clearEvents: () => void
  messageCount: number
  lastMessageAt: string | null
  lastError: string | null
  resetPoints: (points: PointDefinition[]) => void
  isConnected: boolean
}

export function useLiveData(initialPoints: PointDefinition[]): LiveDataApi {
  const [points, setPoints] = useState<PointDefinition[]>(initialPoints)
  const pointsRef = useRef(points)
  pointsRef.current = points
  const [mode, setModeState] = useState<DataMode>('demo')
  const [status, setStatus] = useState<ConnectionStatus>('demo')
  const [url, setUrlState] = useState(() => {
    try {
      return window.localStorage.getItem(URL_KEY) || DEFAULT_URL
    } catch {
      return DEFAULT_URL
    }
  })
  const urlRef = useRef(url)
  urlRef.current = url
  const [autoReconnect, setAutoReconnectState] = useState(() => {
    try {
      return window.localStorage.getItem(RECONNECT_KEY) === '1'
    } catch {
      return false
    }
  })
  const autoReconnectRef = useRef(autoReconnect)
  autoReconnectRef.current = autoReconnect
  const [events, setEvents] = useState<WsEvent[]>([])
  const [messageCount, setMessageCount] = useState(0)
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const manualCloseRef = useRef(false)
  const reconnectTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const tickRef = useRef(0)
  const connectRef = useRef<(url?: string) => void>(() => undefined)

  const addEvent = useCallback(
    (direction: WsEvent['direction'], message: string) => {
      setEvents((previous) =>
        [
          {
            id: uid('ws'),
            time: nowTimeLabel(),
            direction,
            message,
          },
          ...previous,
        ].slice(0, 80),
      )
    },
    [],
  )

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  const applyUpdates = useCallback((updates: Record<string, unknown>) => {
    const at = Date.now()
    setPoints((previous) => {
      let changed = false
      const next = previous.map((point) => {
        if (!(point.id in updates)) return point
        const updated = nextPoint(point, updates[point.id], at)
        if (updated !== point) changed = true
        return updated
      })
      return changed ? next : previous
    })
  }, [])

  const connect = useCallback(
    (targetUrl?: string) => {
      const nextUrl = (targetUrl ?? urlRef.current).trim()
      const previousSocket = socketRef.current
      if (previousSocket) {
        manualCloseRef.current = true
        previousSocket.close()
        socketRef.current = null
      }
      clearReconnectTimer()
      clearHeartbeat()
      if (!nextUrl) {
        setLastError('请输入 WebSocket 地址')
        setStatus('error')
        return
      }
      manualCloseRef.current = false
      setUrlState(nextUrl)
      urlRef.current = nextUrl
      try {
        window.localStorage.setItem(URL_KEY, nextUrl)
      } catch {
        // URL persistence is optional.
      }
      setModeState('live')
      setStatus('connecting')
      setLastError(null)
      addEvent('system', `正在连接 ${nextUrl}`)
      let socket: WebSocket
      try {
        socket = new WebSocket(nextUrl)
      } catch (error) {
        setStatus('error')
        setLastError(error instanceof Error ? error.message : '无法创建 WebSocket 连接')
        addEvent('system', 'WebSocket 地址无效，连接未建立')
        return
      }
      socketRef.current = socket
      socket.onopen = () => {
        if (!mountedRef.current) return
        setStatus('connected')
        setLastError(null)
        addEvent('system', 'WebSocket 已连接，等待点位数据')
        clearHeartbeat()
        heartbeatTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
          }
        }, 20_000)
      }
      socket.onmessage = (event) => {
        if (!mountedRef.current) return
        setMessageCount((count) => count + 1)
        setLastMessageAt(nowTimeLabel())
        let payload: unknown
        try {
          payload = JSON.parse(String(event.data))
        } catch {
          addEvent('in', '收到非 JSON 消息，已忽略')
          return
        }
        const object = payload as Record<string, unknown>
        if (object.type === 'pong') return
        const updates = extractUpdates(payload)
        if (!updates) {
          addEvent('in', '收到消息，但未发现点位数据')
          return
        }
        const ids = Object.keys(updates)
        applyUpdates(updates)
        addEvent(
          'in',
          `${ids.length} 个点位更新 · ${ids
            .slice(0, 3)
            .map((id) => `${id}=${String(updates[id])}`)
            .join(', ')}${ids.length > 3 ? ' …' : ''}`,
        )
      }
      socket.onerror = () => {
        if (!mountedRef.current) return
        setLastError('无法连接到 WebSocket 服务，请检查地址与服务状态')
        setStatus('error')
        addEvent('system', 'WebSocket 连接错误')
      }
      socket.onclose = (event) => {
        if (!mountedRef.current) return
        clearHeartbeat()
        if (manualCloseRef.current) {
          setStatus('disconnected')
          return
        }
        setStatus((previous) => (previous === 'error' ? 'error' : 'disconnected'))
        addEvent('system', `WebSocket 已断开（code ${event.code}）`)
        if (autoReconnectRef.current) {
          addEvent('system', '4 秒后尝试自动重连')
          reconnectTimerRef.current = window.setTimeout(() => {
            if (mountedRef.current) connectRef.current(urlRef.current)
          }, 4000)
        }
      }
    },
    [addEvent, applyUpdates, clearHeartbeat, clearReconnectTimer],
  )
  connectRef.current = connect

  const disconnect = useCallback(() => {
    manualCloseRef.current = true
    clearReconnectTimer()
    clearHeartbeat()
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    setModeState('demo')
    setStatus('demo')
    addEvent('system', '已断开 WebSocket，切换回本地演示数据')
  }, [addEvent, clearHeartbeat, clearReconnectTimer])

  const useDemo = useCallback(() => {
    disconnect()
    setLastError(null)
  }, [disconnect])

  const writePoint = useCallback(
    (pointId: string, value: PointValue, source = 'HMI') => {
      const point = pointsRef.current.find((item) => item.id === pointId)
      if (!point) return false
      if (mode === 'live' && socketRef.current?.readyState !== WebSocket.OPEN) {
        addEvent('system', `写入失败：${point.name}，WebSocket 未连接`)
        return false
      }
      const normalized = normalizeRemoteValue(point, value)
      if (normalized === null) return false
      const updates: Record<string, PointValue> = { [pointId]: normalized }
      if (pointId === 'p-unit-running') {
        if (normalized === false) updates['p-fan-speed'] = 0
        else if (normalized === true) {
          const speed = pointsRef.current.find((item) => item.id === 'p-fan-speed')
          if (speed && Number(speed.value) === 0) updates['p-fan-speed'] = 42
        }
      }
      if (pointId === 'p-fan-speed') {
        updates['p-unit-running'] = Number(normalized) > 0
      }
      setPoints((previous) => {
        const at = Date.now()
        return previous.map((item) =>
          item.id in updates ? nextPoint(item, updates[item.id], at) : item,
        )
      })
      if (mode === 'live' && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'point.write',
            id: pointId,
            value: normalized,
            source,
            ts: Date.now(),
          }),
        )
        addEvent('out', `写入 ${point.name} = ${String(normalized)}`)
        return true
      }
      addEvent('out', `演示写入 ${point.name} = ${String(normalized)}`)
      return true
    },
    [addEvent, mode],
  )

  const setUrl = useCallback((nextUrl: string) => {
    setUrlState(nextUrl)
    urlRef.current = nextUrl
  }, [])

  const setAutoReconnect = useCallback((enabled: boolean) => {
    setAutoReconnectState(enabled)
    autoReconnectRef.current = enabled
    try {
      window.localStorage.setItem(RECONNECT_KEY, enabled ? '1' : '0')
    } catch {
      // Preference persistence is optional.
    }
  }, [])

  const resetPoints = useCallback((nextPoints: PointDefinition[]) => {
    setPoints(nextPoints)
    pointsRef.current = nextPoints
  }, [])

  useEffect(() => {
    if (mode !== 'demo') return
    const timer = window.setInterval(() => {
      tickRef.current += 1
      const tick = tickRef.current
      setPoints((previous) => {
        let changed = false
        const next = previous.map((point) => {
          if (!point.sim || point.writable) return point
          const { base, amp, speed, phase } = point.sim
          const value = Number(
            clamp(
              base +
                Math.sin(tick * speed + phase) * amp +
                Math.sin(tick * speed * 0.37 + phase * 1.9) * amp * 0.34 +
                Math.cos(tick * 0.07 + phase) * amp * 0.15,
              point.min,
              point.max,
            ).toFixed(point.precision + 1),
          )
          changed = true
          return {
            ...point,
            value,
            quality: 'good' as const,
            history: [...point.history.slice(-(MAX_HISTORY - 1)), { t: Date.now(), v: value }],
          }
        })
        return changed ? next : previous
      })
    }, 1500)
    return () => window.clearInterval(timer)
  }, [mode])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      manualCloseRef.current = true
      clearReconnectTimer()
      clearHeartbeat()
      socketRef.current?.close()
    }
  }, [clearHeartbeat, clearReconnectTimer])

  const pointMap = new Map(points.map((point) => [point.id, point]))

  return {
    points,
    pointMap,
    mode,
    status,
    url,
    setUrl,
    autoReconnect,
    setAutoReconnect,
    connect,
    disconnect,
    useDemo,
    writePoint,
    events,
    clearEvents: () => setEvents([]),
    messageCount,
    lastMessageAt,
    lastError,
    resetPoints,
    isConnected: status === 'connected',
  }
}
