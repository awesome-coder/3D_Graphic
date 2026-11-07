import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  CircleAlert,
  Image as ImageIcon,
  Minus,
  Plus,
  Power,
  Waves,
} from 'lucide-react'
import type { GraphNode, PointDefinition, PointValue } from '../types'
import {
  clamp,
  formatNumber,
  formatPointDisplay,
  formatPointValue,
  isBooleanPoint,
  isOn,
  isStringPoint,
  pointPercent,
  toNumber,
} from '../lib/graph'
import { imageStateLabel, resolveImageState } from '../lib/imageRules'

interface WidgetRendererProps {
  node: GraphNode
  point?: PointDefinition
  interactive?: boolean
  onWrite?: (pointId: string, value: PointValue, source: string) => void
}

function pointAccent(point?: PointDefinition) {
  if (!point) return '#5f7d92'
  if (isBooleanPoint(point)) {
    return isOn(point) ? '#42e6bc' : '#ff7f89'
  }
  if (isStringPoint(point)) return '#b5a6ff'
  switch (point.unit) {
    case '°C':
      return '#f0b85b'
    case '%RH':
    case 'Hz':
      return '#48b8ff'
    case 'ppm':
    case '%':
      return '#42e6bc'
    case 'Pa':
      return '#b5a6ff'
    case 'kW':
    case 'kWh':
      return '#f0b85b'
    default:
      return '#48b8ff'
  }
}

function accentStyle(node: GraphNode, point?: PointDefinition) {
  return pointAccent(point)
}

function fillTemplate(template: string, point?: PointDefinition, appendValue = false) {
  if (!point) return template.replace(/\{value\}/g, '—').replace(/\{unit\}/g, '')
  const hasToken = /\{(value|unit|name|device)\}/.test(template)
  const resolved = template
    .replace(/\{value\}/g, formatPointValue(point))
    .replace(/\{unit\}/g, point.unit)
    .replace(/\{name\}/g, point.name)
    .replace(/\{device\}/g, point.device)
  return hasToken || !appendValue || !template.trim() ? resolved : `${resolved} ${formatPointDisplay(point)}`
}

function Sparkline({
  point,
  color,
  width = 110,
  height = 28,
}: {
  point?: PointDefinition
  color: string
  width?: number
  height?: number
}) {
  if (!point || !point.history.length) return <div className="widget-spark-empty" />
  const values = point.history.slice(-24).map((item) => item.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : width
  const d = values
    .map((value, index) => {
      const x = index * step
      const y = height - 3 - ((value - min) / span) * (height - 8)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg className="widget-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={color} fillOpacity={0.09} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  )
}

function TimeWidget({ node }: { node: GraphNode }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const time = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const date = now.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  return (
    <div
      className="clock-widget"
      style={{
        color: node.style.textColor,
        alignItems: node.style.align === 'right' ? 'flex-end' : node.style.align === 'center' ? 'center' : 'flex-start',
      }}
    >
      <span className="clock-time">{time}</span>
      <span className="clock-date">{date}</span>
    </div>
  )
}

function ValueWidget({ node, point }: { node: GraphNode; point?: PointDefinition }) {
  const accent = accentStyle(node, point)
  const value = formatPointValue(point, node.props.precision)
  const unit = node.props.unit || point?.unit || ''
  return (
    <div
      className="value-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <div className="value-widget-top">
        <span className="value-label">{node.props.text || node.label}</span>
        <span className={`value-quality ${point?.quality ?? 'bad'}`} />
      </div>
      <div className="value-widget-main">
        <span className="value-number" style={{ color: accent }}>
          {value}
        </span>
        {unit && <span className="value-unit">{unit}</span>}
      </div>
      {node.props.showTrend && (
        <div className="value-spark-wrap">
          <Sparkline point={point} color={accent} width={150} height={26} />
        </div>
      )}
      {!point && <div className="value-unbound">未绑定点位</div>}
    </div>
  )
}

function StatusWidget({ node, point }: { node: GraphNode; point?: PointDefinition }) {
  const on = isOn(point)
  const accent = on ? node.props.activeColor || '#42e6bc' : '#ff7f89'
  const label = on
    ? node.props.onText || point?.boolLabels?.[0] || '运行'
    : node.props.offText || point?.boolLabels?.[1] || '停止'
  return (
    <div
      className="status-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <div className="status-beacon" style={{ color: accent }}>
        <span className="status-halo" />
        <span className="status-core" />
      </div>
      <div className="status-copy">
        <span className="status-name">{node.props.text || node.label}</span>
        <span className="status-value" style={{ color: accent }}>
          {label}
        </span>
      </div>
    </div>
  )
}

function GaugeWidget({ node, point }: { node: GraphNode; point?: PointDefinition }) {
  const color = accentStyle(node, point)
  const min = node.props.min ?? point?.min ?? 0
  const max = node.props.max ?? point?.max ?? 100
  const ratio = clamp((toNumber(point?.value) - min) / (max - min || 1), 0, 1)
  const start = 140
  const sweep = 260
  const angle = start + sweep * ratio
  const cx = 50
  const cy = 50
  const r = 35
  const polar = (degrees: number, radius: number) => {
    const rad = (degrees * Math.PI) / 180
    return {
      x: cx + Math.cos(rad) * radius,
      y: cy + Math.sin(rad) * radius,
    }
  }
  const startPoint = polar(start, r)
  const endPoint = polar(start + sweep, r)
  const needle = polar(angle, r - 9)
  const arcLength = (2 * Math.PI * r * sweep) / 360
  return (
    <div
      className="gauge-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <span className="gauge-label">{node.props.text || node.label}</span>
      <svg viewBox="0 0 100 100" className="gauge-svg">
        <path
          d={`M ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 1 1 ${endPoint.x} ${endPoint.y}`}
          fill="none"
          stroke="rgba(137,164,185,.14)"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <path
          d={`M ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 1 1 ${endPoint.x} ${endPoint.y}`}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${arcLength * ratio} ${arcLength}`}
          style={{ filter: `drop-shadow(0 0 3px ${color}66)` }}
        />
        {Array.from({ length: 7 }, (_, index) => {
          const tickAngle = start + (sweep / 6) * index
          const inside = polar(tickAngle, r - 9)
          const outside = polar(tickAngle, r - 4)
          return (
            <line
              key={index}
              x1={inside.x}
              y1={inside.y}
              x2={outside.x}
              y2={outside.y}
              stroke="rgba(148,174,195,.35)"
              strokeWidth={0.9}
            />
          )
        })}
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={3.4} fill="#0b1722" stroke={color} strokeWidth={1.2} />
      </svg>
      <div className="gauge-reading">
        <strong style={{ color }}>{formatPointValue(point, node.props.precision)}</strong>
        <span>{node.props.unit || point?.unit || ''}</span>
      </div>
      <div className="gauge-range">
        <span>{formatNumber(min, 0)}</span>
        <span>{formatNumber(max, 0)}</span>
      </div>
    </div>
  )
}

function ProgressWidget({ node, point }: { node: GraphNode; point?: PointDefinition }) {
  const color = node.props.barColor || accentStyle(node, point)
  const percent = pointPercent(point, node.props.min, node.props.max)
  const value = formatPointValue(point, node.props.precision)
  const unit = node.props.unit || point?.unit || ''
  return (
    <div
      className="progress-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <div className="progress-head">
        <span>{node.props.text || node.label}</span>
        <strong style={{ color }}>
          {value}
          <small>{unit}</small>
        </strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%`, background: color }}>
          <span />
        </div>
      </div>
      <div className="progress-foot">
        <span>{formatNumber(node.props.min ?? point?.min ?? 0, 0)}</span>
        <span>{percent.toFixed(0)}%</span>
        <span>{formatNumber(node.props.max ?? point?.max ?? 100, 0)}</span>
      </div>
    </div>
  )
}

function TrendWidget({ node, point }: { node: GraphNode; point?: PointDefinition }) {
  const color = accentStyle(node, point)
  const width = 320
  const height = 116
  const values = (point?.history ?? []).slice(-32).map((item) => item.v)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 100
  const span = max - min || 1
  const d = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width
      const y = 8 + (1 - (value - min) / span) * (height - 26)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const area = values.length
    ? `${d} L ${width} ${height - 18} L 0 ${height - 18} Z`
    : ''
  return (
    <div
      className="trend-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <div className="trend-widget-head">
        <div>
          <strong>{node.props.text || node.label}</strong>
          <span>{node.props.subtitle || point?.name || '未绑定点位'}</span>
        </div>
        <span className="trend-widget-value" style={{ color }}>
          {formatPointValue(point, node.props.precision)}
          <small>{node.props.unit || point?.unit}</small>
        </span>
      </div>
      {values.length ? (
        <svg
          className="trend-widget-chart"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`widget-trend-${node.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {[0.2, 0.5, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1={0}
              x2={width}
              y1={8 + ratio * (height - 26)}
              y2={8 + ratio * (height - 26)}
              stroke="rgba(127,158,181,.12)"
              strokeWidth={0.7}
              strokeDasharray="2 5"
            />
          ))}
          <path d={area} fill={`url(#widget-trend-${node.id})`} />
          <path d={d} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
        </svg>
      ) : (
        <div className="trend-unbound">
          <Waves size={16} />
          绑定数值点位后显示历史趋势
        </div>
      )}
      <div className="trend-widget-foot">
        <span>{point?.device ?? '—'}</span>
        <span>{point ? `MIN ${formatNumber(min, 1)} · MAX ${formatNumber(max, 1)}` : 'NO DATA'}</span>
      </div>
    </div>
  )
}

function FanWidget({ node, point }: { node: GraphNode; point?: PointDefinition }) {
  const color = accentStyle(node, point)
  const percent = pointPercent(point, node.props.min ?? 0, node.props.max ?? 50)
  const active = percent > 0.3
  const duration = Math.max(0.75, 3.8 - (percent / 100) * 3)
  return (
    <div
      className="fan-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <span className="fan-label">{node.props.text || node.label}</span>
      <div className="fan-stage">
        <div className="fan-rings">
          <span />
          <span />
          <span />
        </div>
        <div
          className={`fan-rotor ${active ? 'is-spinning' : ''}`}
          style={{ animationDuration: `${duration}s` }}
        >
          <span className="fan-blade blade-a" style={{ background: color }} />
          <span className="fan-blade blade-b" style={{ background: color }} />
          <span className="fan-blade blade-c" style={{ background: color }} />
          <span className="fan-blade blade-d" style={{ background: color }} />
          <span className="fan-hub" style={{ background: color }} />
        </div>
      </div>
      <div className="fan-reading">
        <strong style={{ color }}>{formatPointValue(point, node.props.precision)}</strong>
        <span>{node.props.unit || point?.unit || 'Hz'}</span>
      </div>
      <span className={`fan-state ${active ? 'is-on' : ''}`}>{active ? 'RUNNING' : 'STOPPED'}</span>
    </div>
  )
}

function TankWidget({ node, point }: { node: GraphNode; point?: PointDefinition }) {
  const color = accentStyle(node, point)
  const percent = pointPercent(point, node.props.min, node.props.max)
  const level = 160 - (percent / 100) * 120
  const gradientId = `tank-${node.id}`
  return (
    <div
      className="tank-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <div className="tank-head">
        <span>{node.props.text || node.label}</span>
        <strong style={{ color }}>
          {formatPointValue(point, node.props.precision)}
          <small>{node.props.unit || point?.unit || '%'}</small>
        </strong>
      </div>
      <div className="tank-stage">
        <svg viewBox="0 0 100 160" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0.12} />
            </linearGradient>
            <clipPath id={`${gradientId}-clip`}>
              <rect x="12" y="16" width="76" height="128" rx="12" />
            </clipPath>
          </defs>
          <rect x="10" y="14" width="80" height="132" rx="14" fill="rgba(8,19,29,.8)" stroke="rgba(135,166,190,.3)" />
          <g clipPath={`url(#${gradientId}-clip)`}>
            <rect x="12" y={level} width="76" height="132" fill={`url(#${gradientId})`} />
            <path
              d={`M 6 ${level + 4} Q 24 ${level - 3} 44 ${level + 4} T 88 ${level + 4} T 112 ${level + 4}`}
              fill="none"
              stroke={color}
              strokeWidth={1.4}
              opacity={0.65}
            />
          </g>
          {[36, 56, 76, 96, 116].map((y) => (
            <line key={y} x1="10" x2="18" y1={y} y2={y} stroke="rgba(152,180,201,.3)" />
          ))}
          <rect x="20" y="8" width="60" height="8" rx="4" fill="rgba(128,158,181,.18)" />
        </svg>
      </div>
      <span className="tank-caption">LEVEL</span>
    </div>
  )
}

function ButtonWidget({
  node,
  point,
  interactive,
  onWrite,
}: {
  node: GraphNode
  point?: PointDefinition
  interactive: boolean
  onWrite?: (pointId: string, value: PointValue, source: string) => void
}) {
  const disabled = !point || !point.writable || !onWrite
  const handleClick = () => {
    if (disabled || !point || !onWrite) return
    let next: PointValue
    if (node.props.action === 'toggle') {
      if (isBooleanPoint(point)) next = !isOn(point)
      else if (isStringPoint(point) && point.options?.length) {
        const index = point.options.findIndex((option) => String(option.value) === String(point.value))
        next = point.options[(index + 1) % point.options.length].value
      } else next = isOn(point) ? 0 : 1
    } else {
      const configured = node.props.writeValue
      if (configured !== undefined) {
        if ((point.pointType === 'DI' || point.pointType === 'DO') && typeof configured === 'string') {
          next = configured === 'true' || configured === '1'
        } else next = configured
      } else if (isBooleanPoint(point)) next = true
      else if (isStringPoint(point)) next = point.options?.[0]?.value ?? ''
      else next = point.min
    }
    onWrite(point.id, next, node.props.text || '按钮')
  }
  return (
    <div
      className={`button-widget ${interactive ? 'is-interactive' : 'is-static'} ${disabled ? 'is-disabled' : ''}`}
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
      onClick={(event) => {
        event.stopPropagation()
        handleClick()
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          handleClick()
        }
      }}
    >
      <Power size={15} />
      <span>{node.props.text || node.label}</span>
      {!point && <small>未绑定</small>}
    </div>
  )
}

function SwitchWidget({
  node,
  point,
  interactive,
  onWrite,
}: {
  node: GraphNode
  point?: PointDefinition
  interactive: boolean
  onWrite?: (pointId: string, value: PointValue, source: string) => void
}) {
  const on = isOn(point)
  const disabled = !point || !point.writable || !onWrite
  const toggle = () => {
    if (disabled || !point || !onWrite) return
    if (isBooleanPoint(point)) onWrite(point.id, !on, node.props.text || '开关')
    else if (isStringPoint(point) && point.options?.length) {
      const index = point.options.findIndex((option) => String(option.value) === String(point.value))
      const next = point.options[(index + 1) % point.options.length].value
      onWrite(point.id, next, node.props.text || '开关')
    } else onWrite(point.id, on ? 0 : 1, node.props.text || '开关')
  }
  return (
    <div
      className={`switch-widget ${interactive ? 'is-interactive' : 'is-static'} ${disabled ? 'is-disabled' : ''}`}
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
      onClick={(event) => {
        event.stopPropagation()
        toggle()
      }}
      role={interactive ? 'switch' : undefined}
      aria-checked={on}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          toggle()
        }
      }}
    >
      <div className="switch-copy">
        <span>{node.props.text || node.label}</span>
        <small style={{ color: on ? '#42e6bc' : '#71869a' }}>
          {on ? node.props.onText || '运行' : node.props.offText || '停止'}
        </small>
      </div>
      <span className={`switch-track ${on ? 'is-on' : ''}`}>
        <span className="switch-knob" />
      </span>
    </div>
  )
}

function SliderWidget({
  node,
  point,
  interactive,
  onWrite,
}: {
  node: GraphNode
  point?: PointDefinition
  interactive: boolean
  onWrite?: (pointId: string, value: PointValue, source: string) => void
}) {
  const min = node.props.min ?? point?.min ?? 0
  const max = node.props.max ?? point?.max ?? 100
  const step = node.props.step ?? 0.1
  const current = clamp(toNumber(point?.value, min), min, max)
  const canControl = Boolean(interactive && point?.writable && onWrite)
  const [draft, setDraft] = useState(current)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!dragging) setDraft(current)
  }, [current, dragging])
  const percent = ((draft - min) / (max - min || 1)) * 100
  const commit = () => {
    setDragging(false)
    if (!point || !onWrite || !canControl) return
    onWrite(point.id, draft, node.props.text || '滑块')
  }
  return (
    <div
      className="slider-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <div className="slider-head">
        <span>{node.props.text || node.label}</span>
        <strong>
          {formatNumber(draft, node.props.precision ?? 0)}
          <small>{node.props.unit || point?.unit}</small>
        </strong>
      </div>
      <div className="slider-track-wrap">
        <div className="slider-track">
          <div
            className="slider-fill"
            style={{ width: `${percent}%`, background: node.props.barColor || '#48b8ff' }}
          />
          <span
            className="slider-thumb"
            style={{ left: `${percent}%`, borderColor: node.props.barColor || '#48b8ff' }}
          />
        </div>
        {canControl && (
          <input
            className="slider-input"
            type="range"
            min={min}
            max={max}
            step={step}
            value={draft}
            onPointerDown={() => setDragging(true)}
            onChange={(event) => {
              setDragging(true)
              setDraft(Number(event.target.value))
            }}
            onPointerUp={commit}
            onTouchEnd={commit}
            onKeyUp={commit}
            onBlur={commit}
            aria-label={node.props.text || node.label}
          />
        )}
      </div>
      <div className="slider-scale">
        <span>{formatNumber(min, 0)}</span>
        <span>{formatNumber(max, 0)}</span>
      </div>
    </div>
  )
}

function SelectWidget({
  node,
  point,
  interactive,
  onWrite,
}: {
  node: GraphNode
  point?: PointDefinition
  interactive: boolean
  onWrite?: (pointId: string, value: PointValue, source: string) => void
}) {
  const options = point?.options?.length ? point.options : node.props.options ?? []
  const current = String(point?.value ?? '')
  const currentLabel = options.find((option) => String(option.value) === current)?.label ?? (current || '—')
  const canControl = Boolean(interactive && point?.writable && onWrite)
  return (
    <div
      className="select-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <span className="select-label">{node.props.text || node.label}</span>
      {canControl ? (
        <label className="select-field">
          <select
            value={current}
            onChange={(event) => {
              if (!point || !onWrite) return
              const selected = options.find((option) => String(option.value) === event.target.value)
              onWrite(point.id, selected?.value ?? event.target.value, node.props.text || '下拉框')
            }}
            aria-label={node.props.text || node.label}
          >
            {!options.length && <option value="">未配置选项</option>}
            {options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
      ) : (
        <div className="select-static">
          <span>{currentLabel}</span>
          <ChevronDown size={13} />
        </div>
      )}
    </div>
  )
}

function NumberWidget({
  node,
  point,
  interactive,
  onWrite,
}: {
  node: GraphNode
  point?: PointDefinition
  interactive: boolean
  onWrite?: (pointId: string, value: PointValue, source: string) => void
}) {
  const min = node.props.min ?? point?.min ?? 0
  const max = node.props.max ?? point?.max ?? 100
  const step = node.props.step ?? 0.1
  const current = toNumber(point?.value, min)
  const canControl = Boolean(interactive && point?.writable && onWrite)
  const [draft, setDraft] = useState(String(current))
  useEffect(() => {
    setDraft(String(current))
  }, [current])
  const commit = (value = Number(draft)) => {
    if (!point || !onWrite || !canControl || !Number.isFinite(value)) return
    const next = clamp(value, min, max)
    setDraft(String(next))
    onWrite(point.id, next, node.props.text || '数字输入')
  }
  return (
    <div
      className="number-widget"
      style={{
        background: node.style.fill,
        borderColor: node.style.stroke,
        borderRadius: node.style.radius,
        color: node.style.textColor,
      }}
    >
      <span className="number-label">{node.props.text || node.label}</span>
      {canControl ? (
        <div className="number-input-wrap">
          <button type="button" onClick={() => commit(current - step)} aria-label="减小">
            <Minus size={12} />
          </button>
          <input
            value={draft}
            inputMode="decimal"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => commit()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
            }}
            aria-label={node.props.text || node.label}
          />
          <button type="button" onClick={() => commit(current + step)} aria-label="增大">
            <Plus size={12} />
          </button>
          <span className="number-unit">{node.props.unit || point?.unit}</span>
        </div>
      ) : (
        <div className="number-static">
          {formatPointValue(point, node.props.precision)}
          <span>{node.props.unit || point?.unit}</span>
        </div>
      )}
    </div>
  )
}

export function WidgetRenderer({ node, point, interactive = false, onWrite }: WidgetRendererProps) {
  const accent = accentStyle(node, point)
  const baseStyle = {
    color: node.style.textColor,
  }

  if (node.type === 'rect' || node.type === 'ellipse' || node.type === 'panel') {
    const active =
      node.props.threshold !== undefined
        ? toNumber(point?.value) >= node.props.threshold
        : isOn(point)
    const visualMode = node.binding.mode
    const filled = visualMode === 'fill' && active
    const hiddenInPreview =
      visualMode === 'visibility' && point !== undefined && !active && interactive
    const fill = filled ? node.props.activeColor || '#1a9979' : node.style.fill
    const content = node.props.text || ''
    return (
      <div
        className={`shape-widget shape-${node.type} ${hiddenInPreview ? 'is-condition-hidden' : ''}`}
        style={{
          ...baseStyle,
          background: node.type === 'panel' ? fill : fill,
          borderColor: filled ? node.props.activeColor || '#42e6bc' : node.style.stroke,
          borderWidth: node.style.strokeWidth,
          borderStyle: node.binding.pointId ? 'solid' : node.type === 'panel' ? 'solid' : 'solid',
          borderRadius: node.type === 'ellipse' ? '50%' : node.style.radius,
        }}
      >
        {node.type === 'panel' && (
          <>
            <div className="panel-heading">
              <span className="panel-dot" />
              <span>{node.props.text || node.label}</span>
              <small>{node.props.subtitle}</small>
            </div>
            <span className="panel-grid-mark" />
          </>
        )}
        {node.type !== 'panel' && content && (
          <span className="shape-text" style={{ fontSize: node.style.fontSize, fontWeight: node.style.fontWeight }}>
            {fillTemplate(content, point)}
          </span>
        )}
        {node.type === 'rect' && node.binding.pointId && !content && (
          <span className="shape-binding-note">{point ? formatPointDisplay(point) : '未绑定'}</span>
        )}
      </div>
    )
  }

  if (node.type === 'line') {
    const active =
      node.props.threshold !== undefined
        ? toNumber(point?.value) >= node.props.threshold
        : isOn(point)
    const conditionHidden =
      node.binding.mode === 'visibility' && point !== undefined && !active && interactive
    const lineColor =
      node.binding.mode === 'fill' && active
        ? node.props.activeColor || '#ff7585'
        : node.style.stroke === 'transparent'
          ? '#31526b'
          : node.style.stroke
    return (
      <div className={`line-widget ${conditionHidden ? 'is-condition-hidden' : ''}`} style={baseStyle}>
        <span
          style={{
            background: lineColor,
            height: Math.max(1, node.style.strokeWidth || 1),
          }}
        />
      </div>
    )
  }

  if (node.type === 'image') {
    const states = node.props.imageStates ?? []
    const rule = resolveImageState(point, states)
    const fallbackUrl = !states.length ? node.props.imageUrl ?? '' : ''
    const imageUrl = rule?.url || fallbackUrl
    return (
      <div
        className={`image-widget ${imageUrl ? 'has-image' : ''}`}
        style={{
          ...baseStyle,
          borderColor: node.style.stroke,
          borderWidth: node.style.strokeWidth,
          borderRadius: node.style.radius,
          background: node.style.fill,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={node.label}
            draggable={false}
            style={{ objectFit: node.props.objectFit ?? 'contain' }}
          />
        ) : (
          <div className="image-placeholder">
            <ImageIcon size={22} />
            <span>{node.label}</span>
            <small>{point ? `${imageStateLabel(rule, point)} · 尚未上传图片` : '在属性中上传图片'}</small>
          </div>
        )}
        {!interactive && point && (
          <span className="image-state-badge">{imageStateLabel(rule, point)}</span>
        )}
      </div>
    )
  }

  if (node.type === 'text') {
    const text = fillTemplate(node.props.text || node.label, point, true)
    return (
      <div
        className="text-widget"
        style={{
          ...baseStyle,
          fontSize: node.style.fontSize,
          fontWeight: node.style.fontWeight,
          textAlign: node.style.align,
          justifyContent:
            node.style.align === 'center' ? 'center' : node.style.align === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        {text}
      </div>
    )
  }

  if (node.type === 'clock') return <TimeWidget node={node} />
  if (node.type === 'value') return <ValueWidget node={node} point={point} />
  if (node.type === 'status') return <StatusWidget node={node} point={point} />
  if (node.type === 'gauge') return <GaugeWidget node={node} point={point} />
  if (node.type === 'progress') return <ProgressWidget node={node} point={point} />
  if (node.type === 'trend') return <TrendWidget node={node} point={point} />
  if (node.type === 'fan') return <FanWidget node={node} point={point} />
  if (node.type === 'tank') return <TankWidget node={node} point={point} />
  if (node.type === 'button') {
    return <ButtonWidget node={node} point={point} interactive={interactive} onWrite={onWrite} />
  }
  if (node.type === 'switch') {
    return <SwitchWidget node={node} point={point} interactive={interactive} onWrite={onWrite} />
  }
  if (node.type === 'slider') {
    return <SliderWidget node={node} point={point} interactive={interactive} onWrite={onWrite} />
  }
  if (node.type === 'select') {
    return <SelectWidget node={node} point={point} interactive={interactive} onWrite={onWrite} />
  }
  if (node.type === 'number') {
    return <NumberWidget node={node} point={point} interactive={interactive} onWrite={onWrite} />
  }

  return (
    <div className="text-widget" style={baseStyle}>
      <CircleAlert size={14} /> {node.label}
    </div>
  )
}
