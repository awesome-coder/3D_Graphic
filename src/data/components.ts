import type {
  ComponentCategory,
  ComponentDefinition,
  ComponentType,
  GraphNode,
  NodeProps,
  NodeStyle,
} from '../types'
import { uid } from '../lib/graph'

export const CATEGORY_ORDER: ComponentCategory[] = ['基础图形', '数据显示', '交互控件']

export const CATEGORY_META: Record<ComponentCategory, { caption: string }> = {
  基础图形: { caption: 'SHAPES' },
  数据显示: { caption: 'DISPLAY' },
  交互控件: { caption: 'CONTROLS' },
}

export const COMPONENTS: ComponentDefinition[] = [
  {
    type: 'rect',
    name: '矩形',
    shortName: '矩形',
    category: '基础图形',
    description: '可填充、描边的矩形图形',
    defaultW: 160,
    defaultH: 100,
    accent: '#48b8ff',
  },
  {
    type: 'ellipse',
    name: '圆形',
    shortName: '圆形',
    category: '基础图形',
    description: '圆形 / 椭圆图形',
    defaultW: 120,
    defaultH: 120,
    accent: '#42e6bc',
  },
  {
    type: 'line',
    name: '线条',
    shortName: '线条',
    category: '基础图形',
    description: '水平分割线或装饰线',
    defaultW: 200,
    defaultH: 24,
    accent: '#7d94a8',
  },
  {
    type: 'panel',
    name: '面板',
    shortName: '面板',
    category: '基础图形',
    description: '带标题的分组面板容器',
    defaultW: 380,
    defaultH: 240,
    accent: '#6f8da4',
  },
  {
    type: 'image',
    name: '状态图片',
    shortName: '图片',
    category: '基础图形',
    description: '上传一张或多张图片，按点位状态自动切换',
    defaultW: 240,
    defaultH: 150,
    accent: '#b5a6ff',
  },
  {
    type: 'text',
    name: '文本',
    shortName: '文本',
    category: '数据显示',
    description: '标题、说明文字或动态文本',
    defaultW: 300,
    defaultH: 60,
    accent: '#a7b8ca',
  },
  {
    type: 'value',
    name: '数值显示',
    shortName: '数值',
    category: '数据显示',
    description: '绑定点位并显示实时数值',
    defaultW: 180,
    defaultH: 120,
    accent: '#48b8ff',
  },
  {
    type: 'clock',
    name: '时间',
    shortName: '时间',
    category: '数据显示',
    description: '实时日期与时钟',
    defaultW: 240,
    defaultH: 74,
    accent: '#a7b8ca',
  },
  {
    type: 'status',
    name: '状态指示灯',
    shortName: '状态',
    category: '数据显示',
    description: '按布尔值显示运行 / 停止',
    defaultW: 140,
    defaultH: 110,
    accent: '#42e6bc',
  },
  {
    type: 'gauge',
    name: '仪表盘',
    shortName: '仪表',
    category: '数据显示',
    description: '模拟量圆弧仪表',
    defaultW: 170,
    defaultH: 170,
    accent: '#f0b85b',
  },
  {
    type: 'progress',
    name: '进度条',
    shortName: '进度',
    category: '数据显示',
    description: '百分比或区间数值进度',
    defaultW: 260,
    defaultH: 100,
    accent: '#42e6bc',
  },
  {
    type: 'trend',
    name: '趋势曲线',
    shortName: '趋势',
    category: '数据显示',
    description: '点位历史趋势图',
    defaultW: 340,
    defaultH: 190,
    accent: '#48b8ff',
  },
  {
    type: 'fan',
    name: '风机图形',
    shortName: '风机',
    category: '数据显示',
    description: '随频率点旋转的动态图形',
    defaultW: 170,
    defaultH: 170,
    accent: '#53d6c2',
  },
  {
    type: 'tank',
    name: '液位罐',
    shortName: '液位',
    category: '数据显示',
    description: '按点位百分比显示液位',
    defaultW: 150,
    defaultH: 200,
    accent: '#48b8ff',
  },
  {
    type: 'button',
    name: '按钮',
    shortName: '按钮',
    category: '交互控件',
    description: '向点位写入指定值',
    defaultW: 150,
    defaultH: 50,
    accent: '#42e6bc',
  },
  {
    type: 'switch',
    name: '开关',
    shortName: '开关',
    category: '交互控件',
    description: '切换布尔点位',
    defaultW: 170,
    defaultH: 80,
    accent: '#42e6bc',
  },
  {
    type: 'slider',
    name: '滑块',
    shortName: '滑块',
    category: '交互控件',
    description: '拖动向模拟量点位写入数值',
    defaultW: 300,
    defaultH: 100,
    accent: '#48b8ff',
  },
  {
    type: 'select',
    name: '下拉框',
    shortName: '下拉',
    category: '交互控件',
    description: '从选项列表写入枚举点位',
    defaultW: 240,
    defaultH: 90,
    accent: '#b5a6ff',
  },
  {
    type: 'number',
    name: '数字输入',
    shortName: '输入',
    category: '交互控件',
    description: '输入数值并写入点位',
    defaultW: 190,
    defaultH: 86,
    accent: '#f0b85b',
  },
]

export const COMPONENT_MAP = new Map<ComponentType, ComponentDefinition>(
  COMPONENTS.map((component) => [component.type, component]),
)

const TAGS: Record<ComponentType, string> = {
  rect: 'RECT',
  ellipse: 'CIRC',
  line: 'LINE',
  panel: 'PANEL',
  image: 'IMG',
  text: 'TXT',
  value: 'VAL',
  clock: 'CLK',
  status: 'IND',
  gauge: 'GAUGE',
  progress: 'BAR',
  trend: 'TREND',
  fan: 'FAN',
  tank: 'TANK',
  button: 'BTN',
  switch: 'SW',
  slider: 'SLIDER',
  select: 'SELECT',
  number: 'INPUT',
}

const LABELS: Record<ComponentType, string> = {
  rect: '矩形',
  ellipse: '圆形',
  line: '分割线',
  panel: '信息面板',
  image: '图片',
  text: '文本',
  value: '数值显示',
  clock: '系统时间',
  status: '运行状态',
  gauge: '仪表',
  progress: '进度',
  trend: '趋势曲线',
  fan: '送风机',
  tank: '液位',
  button: '执行按钮',
  switch: '启停开关',
  slider: '设定滑块',
  select: '模式选择',
  number: '数值设定',
}

export const DEFAULT_STYLE: NodeStyle = {
  fill: '#0d1c2a',
  stroke: '#29465c',
  strokeWidth: 1,
  radius: 10,
  opacity: 1,
  textColor: '#d9e6f2',
  fontSize: 12,
  fontWeight: 500,
  align: 'left',
}

const DEFAULT_PROPS: Partial<Record<ComponentType, NodeProps>> = {
  rect: { text: '' },
  ellipse: { text: '' },
  line: {},
  panel: { text: '信息面板', subtitle: 'PANEL' },
  image: { text: '状态图片', objectFit: 'contain' },
  text: { text: '标题文本' },
  value: { text: '实时数值', showTrend: true, precision: 1 },
  clock: { text: '' },
  status: { text: '设备运行状态', onText: '运行', offText: '停止' },
  gauge: { text: '仪表', min: 0, max: 100, precision: 1 },
  progress: { text: '进度', min: 0, max: 100, showValue: true, precision: 1 },
  trend: { text: '实时趋势', showTrend: true },
  fan: { text: '送风机', precision: 0 },
  tank: { text: '液位', min: 0, max: 100, precision: 0 },
  button: { text: '执行', action: 'set', writeValue: true },
  switch: { text: '启停控制', onText: '运行', offText: '停止' },
  slider: { text: '设定值', min: 0, max: 100, step: 1, precision: 1 },
  select: {
    text: '运行模式',
    options: [
      { label: '自动', value: 'auto' },
      { label: '手动', value: 'manual' },
      { label: '停止', value: 'stopped' },
    ],
  },
  number: { text: '设定值', min: 0, max: 100, step: 0.1, precision: 1 },
}

export function createGraphNode(
  type: ComponentType,
  x: number,
  y: number,
  existing: GraphNode[],
): GraphNode {
  const definition = COMPONENT_MAP.get(type) ?? COMPONENTS[0]
  const tagPrefix = TAGS[type]
  const numbers = existing
    .map((node) => node.tag.match(new RegExp(`^${tagPrefix}-(\\d+)$`)))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[1]))
  const next = numbers.length ? Math.max(...numbers) + 1 : 1
  const baseStyle = { ...DEFAULT_STYLE }
  if (type === 'text' || type === 'clock' || type === 'line') {
    baseStyle.fill = 'transparent'
    baseStyle.stroke = 'transparent'
    baseStyle.strokeWidth = 0
  }
  if (type === 'text') {
    baseStyle.fontSize = 22
    baseStyle.fontWeight = 600
  }
  if (type === 'image') {
    baseStyle.fill = 'transparent'
    baseStyle.stroke = 'transparent'
    baseStyle.strokeWidth = 0
    baseStyle.radius = 6
  }
  const props: NodeProps = { ...DEFAULT_PROPS[type] }
  if (type === 'image') {
    props.imageStates = [
      {
        id: uid('img'),
        label: '默认图片',
        url: '',
      },
    ]
  }
  if (type === 'button') {
    baseStyle.fill = '#1c9d7c'
    baseStyle.stroke = '#3fd6ad'
    baseStyle.textColor = '#04110d'
    baseStyle.radius = 9
    baseStyle.align = 'center'
    baseStyle.fontSize = 13
    baseStyle.fontWeight = 600
  }
  if (type === 'panel') {
    baseStyle.fill = '#0b1621'
    baseStyle.stroke = '#223a4d'
    baseStyle.radius = 12
  }
  return {
    id: uid('node'),
    type,
    label: LABELS[type],
    tag: `${tagPrefix}-${String(next).padStart(2, '0')}`,
    x: Math.round(x),
    y: Math.round(y),
    w: definition.defaultW,
    h: definition.defaultH,
    rotation: 0,
    style: baseStyle,
    props,
    binding: { pointId: null, mode: 'value' },
  }
}
