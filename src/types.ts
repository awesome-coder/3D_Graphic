export type ComponentType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'panel'
  | 'image'
  | 'text'
  | 'value'
  | 'clock'
  | 'status'
  | 'gauge'
  | 'progress'
  | 'trend'
  | 'fan'
  | 'tank'
  | 'button'
  | 'switch'
  | 'slider'
  | 'select'
  | 'number'

export type ComponentCategory = '基础图形' | '数据显示' | '交互控件'

export type PointType = 'AI' | 'AO' | 'DI' | 'DO' | 'STRING'
export type PointValue = number | string | boolean
export type PointQuality = 'good' | 'stale' | 'bad'

export interface PointOption {
  label: string
  value: string | number
}

export interface PointHistoryPoint {
  t: number
  v: number
}

export interface PointDefinition {
  id: string
  name: string
  device: string
  pointType: PointType
  unit: string
  value: PointValue
  min: number
  max: number
  precision: number
  writable: boolean
  quality: PointQuality
  options?: PointOption[]
  boolLabels?: [string, string]
  history: PointHistoryPoint[]
  sim?: {
    base: number
    amp: number
    speed: number
    phase: number
  }
}

export interface NodeStyle {
  fill: string
  stroke: string
  strokeWidth: number
  radius: number
  opacity: number
  textColor: string
  fontSize: number
  fontWeight: number
  align: 'left' | 'center' | 'right'
}

export interface ImageRule {
  id: string
  label: string
  url: string
  matchValue?: string | number | boolean
  min?: number
  max?: number
}

export interface NodeProps {
  text?: string
  subtitle?: string
  unit?: string
  precision?: number
  min?: number
  max?: number
  step?: number
  showValue?: boolean
  showTrend?: boolean
  showUnit?: boolean
  onText?: string
  offText?: string
  action?: 'toggle' | 'set'
  writeValue?: PointValue
  options?: PointOption[]
  imageUrl?: string
  imageStates?: ImageRule[]
  objectFit?: 'cover' | 'contain'
  threshold?: number
  activeColor?: string
  inactiveColor?: string
  barColor?: string
}

export interface NodeBinding {
  pointId: string | null
  mode: 'value' | 'visibility' | 'fill'
}

export interface GraphNode {
  id: string
  type: ComponentType
  label: string
  tag: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  locked?: boolean
  hidden?: boolean
  style: NodeStyle
  props: NodeProps
  binding: NodeBinding
}

export interface CanvasPage {
  id: string
  name: string
  subtitle: string
  nodes: GraphNode[]
}

export interface Project {
  schema: 2
  name: string
  site: string
  version: string
  updatedAt: string
  pages: CanvasPage[]
  points: PointDefinition[]
}

export interface ComponentDefinition {
  type: ComponentType
  name: string
  shortName: string
  category: ComponentCategory
  description: string
  defaultW: number
  defaultH: number
  accent: string
}

export type Selection = string[]

export type InspectorTab = 'properties' | 'data'
export type LibraryTab = 'components' | 'points'
export type ToolMode = 'select' | 'pan'
export type DataMode = 'demo' | 'live'

export type ConnectionStatus =
  | 'demo'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

export interface WsEvent {
  id: string
  time: string
  direction: 'in' | 'out' | 'system'
  message: string
}

export interface WriteLog {
  id: string
  time: string
  pointId: string
  pointName: string
  valueLabel: string
  source: string
  transport: 'demo' | 'websocket'
  status: 'local' | 'sent' | 'error'
}
