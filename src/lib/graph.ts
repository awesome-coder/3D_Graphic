import type { GraphNode, PointDefinition, PointValue } from '../types'

export const GRID_SIZE = 8

export const ACCENT_PRESETS = [
  { name: '冰川蓝', value: '#48b8ff' },
  { name: '薄荷绿', value: '#42e6bc' },
  { name: '琥珀金', value: '#f0b85b' },
  { name: '珊瑚红', value: '#ff7f89' },
  { name: '雾灰', value: '#a7b8ca' },
]

export const COLOR_PRESETS = [
  '#48b8ff',
  '#42e6bc',
  '#f0b85b',
  '#ff7f89',
  '#b5a6ff',
  '#a7b8ca',
]

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function snap(value: number, enabled: boolean, grid = GRID_SIZE) {
  return enabled ? Math.round(value / grid) * grid : Math.round(value)
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now()
    .toString(36)
    .slice(-3)}`
}

export function isBooleanPoint(point?: PointDefinition | null) {
  return point?.pointType === 'DI' || point?.pointType === 'DO'
}

export function isStringPoint(point?: PointDefinition | null) {
  return point?.pointType === 'STRING'
}

export function isOn(point?: PointDefinition | null) {
  if (!point) return false
  if (typeof point.value === 'boolean') return point.value
  if (typeof point.value === 'number') return point.value >= 0.5
  return point.value !== '' && point.value !== '0' && point.value !== 'false'
}

export function toNumber(value: PointValue | undefined, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function formatPointValue(
  point?: PointDefinition | null,
  precisionOverride?: number,
): string {
  if (!point) return '—'
  if (isBooleanPoint(point)) {
    return isOn(point) ? point.boolLabels?.[0] ?? 'ON' : point.boolLabels?.[1] ?? 'OFF'
  }
  if (isStringPoint(point)) {
    return point.options?.find((option) => String(option.value) === String(point.value))?.label ?? String(point.value)
  }
  const precision = precisionOverride ?? point.precision
  return Number(point.value).toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })
}

export function formatPointUnit(point?: PointDefinition | null, override?: string) {
  if (override !== undefined) return override
  return point?.unit ?? ''
}

export function formatPointDisplay(
  point?: PointDefinition | null,
  precisionOverride?: number,
  unitOverride?: string,
) {
  if (!point) return '—'
  const value = formatPointValue(point, precisionOverride)
  const unit = formatPointUnit(point, unitOverride)
  const isState = isBooleanPoint(point) || isStringPoint(point)
  return unit && !isState ? `${value} ${unit}` : value
}

export function formatNumber(value: number, precision = 1) {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })
}

export function formatHistoryTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function pointPercent(
  point?: PointDefinition | null,
  min?: number,
  max?: number,
) {
  if (!point) return 0
  const raw = toNumber(point.value)
  const lower = min ?? point.min ?? 0
  const upper = max ?? point.max ?? 100
  const span = upper - lower || 1
  return clamp(((raw - lower) / span) * 100, 0, 100)
}

export function pointLabel(point?: PointDefinition | null) {
  return point ? `${point.device} · ${point.name}` : '未绑定点位'
}

export function valueLabel(point: PointDefinition, value: PointValue) {
  if (isBooleanPoint(point)) {
    const on = typeof value === 'boolean' ? value : Number(value) >= 0.5
    return on ? point.boolLabels?.[0] ?? 'ON' : point.boolLabels?.[1] ?? 'OFF'
  }
  if (isStringPoint(point)) {
    return point.options?.find((option) => String(option.value) === String(value))?.label ?? String(value)
  }
  return Number(value).toFixed(point.precision)
}

export function getNodeBounds(nodes: GraphNode[]) {
  if (!nodes.length) return { x: 0, y: 0, w: 1200, h: 760 }
  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const maxX = Math.max(...nodes.map((node) => node.x + node.w))
  const maxY = Math.max(...nodes.map((node) => node.y + node.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function nowTimeLabel(seconds = true) {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hour12: false,
  })
}

export function dateTimeLabel(date = new Date()) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
