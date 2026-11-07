import { useEffect, useMemo, useState } from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Database,
  Eye,
  Image as ImageIcon,
  Link2,
  Lock,
  MousePointerClick,
  Palette,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unlink,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import type {
  CanvasPage,
  ConnectionStatus,
  GraphNode,
  InspectorTab,
  NodeBinding,
  NodeProps,
  PointDefinition,
  PointOption,
  PointValue,
  Project,
} from '../types'
import { COMPONENT_MAP } from '../data/components'
import {
  COLOR_PRESETS,
  formatPointValue,
  isBooleanPoint,
  isOn,
  isStringPoint,
} from '../lib/graph'
import { PaletteIcon } from './PaletteIcon'
import { ImageStateEditor } from './ImageStateEditor'

interface InspectorProps {
  tab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  page: CanvasPage
  project: Project
  selectedNodes: GraphNode[]
  points: PointDefinition[]
  pointMap: Map<string, PointDefinition>
  status: ConnectionStatus
  onUpdateNode: (id: string, patch: Partial<GraphNode>) => void
  onBind: (nodeId: string, pointId: string | null, mode?: NodeBinding['mode']) => void
  onAlign: (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void
  onBringForward: () => void
  onSendBackward: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUpdatePage: (patch: Partial<CanvasPage>) => void
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span />
    </button>
  )
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="color-field">
      <span>{label}</span>
      <div className="color-input-wrap">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <code>{value.toUpperCase()}</code>
      </div>
    </div>
  )
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: PointOption[]
  onChange: (options: PointOption[]) => void
}) {
  return (
    <div className="options-editor">
      {options.map((option, index) => (
        <div className="option-row" key={index}>
          <input
            className="text-input mono"
            value={String(option.value)}
            aria-label="选项值"
            onChange={(event) => {
              const next = [...options]
              next[index] = { ...next[index], value: event.target.value }
              onChange(next)
            }}
          />
          <input
            className="text-input"
            value={option.label}
            aria-label="选项名称"
            onChange={(event) => {
              const next = [...options]
              next[index] = { ...next[index], label: event.target.value }
              onChange(next)
            }}
          />
          <button
            className="option-remove"
            onClick={() => onChange(options.filter((_, optionIndex) => optionIndex !== index))}
            aria-label="删除选项"
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <button
        className="option-add"
        onClick={() => onChange([...options, { label: `选项 ${options.length + 1}`, value: `option${options.length + 1}` }])}
      >
        <Plus size={12} />
        添加选项
      </button>
    </div>
  )
}

function formatBindingValue(point: PointDefinition, value: PointValue) {
  if (isBooleanPoint(point)) return value ? point.boolLabels?.[0] ?? 'ON' : point.boolLabels?.[1] ?? 'OFF'
  if (isStringPoint(point)) {
    return point.options?.find((option) => String(option.value) === String(value))?.label ?? String(value)
  }
  return `${value} ${point.unit}`
}

export function Inspector({
  tab,
  onTabChange,
  page,
  project,
  selectedNodes,
  points,
  pointMap,
  status,
  onUpdateNode,
  onBind,
  onAlign,
  onBringForward,
  onSendBackward,
  onDuplicate,
  onDelete,
  onUpdatePage,
}: InspectorProps) {
  const node = selectedNodes.length === 1 ? selectedNodes[0] : null
  const definition = node ? COMPONENT_MAP.get(node.type) : null
  const point = node?.binding.pointId ? pointMap.get(node.binding.pointId) : undefined
  const [pointQuery, setPointQuery] = useState('')
  const [pointDropdownOpen, setPointDropdownOpen] = useState(false)

  useEffect(() => {
    setPointQuery('')
    setPointDropdownOpen(false)
  }, [node?.id])

  const boundCount = page.nodes.filter((item) => item.binding.pointId).length
  const totalBindings = project.pages.reduce(
    (count, item) => count + item.nodes.filter((nodeItem) => nodeItem.binding.pointId).length,
    0,
  )
  const writableCount = points.filter((item) => item.writable).length

  const filteredPoints = useMemo(() => {
    const needle = pointQuery.trim().toLowerCase()
    if (!needle) return points
    return points.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.device.toLowerCase().includes(needle) ||
        item.id.toLowerCase().includes(needle),
    )
  }, [points, pointQuery])

  const updateStyle = (patch: Partial<GraphNode['style']>) => {
    if (!node) return
    onUpdateNode(node.id, { style: { ...node.style, ...patch } })
  }

  const updateProps = (patch: Partial<NodeProps>) => {
    if (!node) return
    onUpdateNode(node.id, { props: { ...node.props, ...patch } })
  }

  const updateBindingMode = (mode: NodeBinding['mode']) => {
    if (!node) return
    onUpdateNode(node.id, { binding: { ...node.binding, mode } })
  }

  const writeValueEditor = () => {
    if (!node) return null
    if (node.props.action === 'toggle') {
      return (
        <div className="inspector-note">
          <RefreshCw size={13} />
          预览时点击按钮将在当前值与相反值之间切换。
        </div>
      )
    }
    if (!point) {
      return (
        <Field label="写入值">
          <input
            className="text-input mono"
            value={String(node.props.writeValue ?? '')}
            onChange={(event) => updateProps({ writeValue: event.target.value })}
            placeholder="绑定点位后可用"
          />
        </Field>
      )
    }
    if (isBooleanPoint(point)) {
      const value = Boolean(node.props.writeValue)
      return (
        <div className="field">
          <span className="field-label">写入值</span>
          <div className="write-value-segment">
            <button
              className={value ? 'is-active' : ''}
              onClick={() => updateProps({ writeValue: true })}
            >
              {point.boolLabels?.[0] ?? 'ON'}
            </button>
            <button
              className={!value ? 'is-active is-off' : ''}
              onClick={() => updateProps({ writeValue: false })}
            >
              {point.boolLabels?.[1] ?? 'OFF'}
            </button>
          </div>
        </div>
      )
    }
    if (isStringPoint(point)) {
      return (
        <Field label="写入值">
          <select
            className="select-input"
            value={String(node.props.writeValue ?? point.options?.[0]?.value ?? '')}
            onChange={(event) => updateProps({ writeValue: event.target.value })}
          >
            {(point.options ?? node.props.options ?? []).map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      )
    }
    return (
      <Field label="写入值" hint={point.unit}>
        <input
          className="text-input mono"
          type="number"
          value={Number(node.props.writeValue ?? point.value)}
          onChange={(event) => updateProps({ writeValue: Number(event.target.value) })}
        />
      </Field>
    )
  }

  const componentSettings = () => {
    if (!node) return null
    if (node.type === 'text') {
      return (
        <>
          <Field label="文本内容" hint="支持 {value} {unit}">
            <textarea
              className="text-area"
              rows={3}
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <div className="field-grid">
            <Field label="字号">
              <input
                className="text-input mono"
                type="number"
                min={6}
                max={80}
                value={node.style.fontSize}
                onChange={(event) => updateStyle({ fontSize: Number(event.target.value) })}
              />
            </Field>
            <Field label="字重">
              <select
                className="select-input"
                value={node.style.fontWeight}
                onChange={(event) => updateStyle({ fontWeight: Number(event.target.value) })}
              >
                <option value={400}>常规</option>
                <option value={500}>中等</option>
                <option value={600}>半粗</option>
                <option value={700}>粗体</option>
              </select>
            </Field>
          </div>
          <div className="align-segment">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                className={node.style.align === align ? 'is-active' : ''}
                onClick={() => updateStyle({ align })}
              >
                {align === 'left' ? '左对齐' : align === 'center' ? '居中' : '右对齐'}
              </button>
            ))}
          </div>
        </>
      )
    }
    if (node.type === 'value') {
      return (
        <>
          <Field label="标题">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <div className="field-grid">
            <Field label="单位覆盖">
              <input
                className="text-input"
                value={node.props.unit ?? ''}
                placeholder={point?.unit ?? '自动'}
                onChange={(event) => updateProps({ unit: event.target.value })}
              />
            </Field>
            <Field label="小数位">
              <input
                className="text-input mono"
                type="number"
                min={0}
                max={4}
                value={node.props.precision ?? 1}
                onChange={(event) => updateProps({ precision: Number(event.target.value) })}
              />
            </Field>
          </div>
          <div className="switch-row">
            <span>
              <Sparkles size={13} />
              显示迷你趋势
            </span>
            <Toggle
              checked={Boolean(node.props.showTrend)}
              onChange={(value) => updateProps({ showTrend: value })}
              label="显示迷你趋势"
            />
          </div>
        </>
      )
    }
    if (node.type === 'panel' || node.type === 'rect' || node.type === 'ellipse') {
      return (
        <>
          <Field label="组件文字">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          {node.type === 'panel' && (
            <Field label="英文副标题">
              <input
                className="text-input mono"
                value={node.props.subtitle ?? ''}
                onChange={(event) => updateProps({ subtitle: event.target.value })}
              />
            </Field>
          )}
        </>
      )
    }
    if (node.type === 'image') {
      return (
        <div className="inspector-note">
          <ImageIcon size={13} />
          图片由绑定的点位驱动；在下方“图片状态映射”中为每个状态上传图片。
        </div>
      )
    }
    if (node.type === 'status') {
      return (
        <>
          <Field label="标题">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <div className="field-grid">
            <Field label="ON 文本">
              <input
                className="text-input"
                value={node.props.onText ?? ''}
                onChange={(event) => updateProps({ onText: event.target.value })}
              />
            </Field>
            <Field label="OFF 文本">
              <input
                className="text-input"
                value={node.props.offText ?? ''}
                onChange={(event) => updateProps({ offText: event.target.value })}
              />
            </Field>
          </div>
          <ColorField
            label="ON 颜色"
            value={node.props.activeColor || '#42e6bc'}
            onChange={(value) => updateProps({ activeColor: value })}
          />
        </>
      )
    }
    if (node.type === 'gauge' || node.type === 'progress' || node.type === 'fan' || node.type === 'tank') {
      return (
        <>
          <Field label="标题">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <div className="field-grid quad">
            <Field label="最小">
              <input
                className="text-input mono"
                type="number"
                value={node.props.min ?? point?.min ?? 0}
                onChange={(event) => updateProps({ min: Number(event.target.value) })}
              />
            </Field>
            <Field label="最大">
              <input
                className="text-input mono"
                type="number"
                value={node.props.max ?? point?.max ?? 100}
                onChange={(event) => updateProps({ max: Number(event.target.value) })}
              />
            </Field>
            <Field label="小数">
              <input
                className="text-input mono"
                type="number"
                min={0}
                max={4}
                value={node.props.precision ?? 1}
                onChange={(event) => updateProps({ precision: Number(event.target.value) })}
              />
            </Field>
            <Field label="单位">
              <input
                className="text-input"
                value={node.props.unit ?? ''}
                placeholder={point?.unit ?? '自动'}
                onChange={(event) => updateProps({ unit: event.target.value })}
              />
            </Field>
          </div>
          {(node.type === 'progress' || node.type === 'gauge') && (
            <ColorField
              label="主色"
              value={node.props.barColor || node.props.activeColor || '#48b8ff'}
              onChange={(value) => updateProps({ barColor: value })}
            />
          )}
        </>
      )
    }
    if (node.type === 'trend') {
      return (
        <>
          <Field label="标题">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <Field label="副标题">
            <input
              className="text-input mono"
              value={node.props.subtitle ?? ''}
              onChange={(event) => updateProps({ subtitle: event.target.value })}
            />
          </Field>
          <Field label="数值单位">
            <input
              className="text-input"
              value={node.props.unit ?? ''}
              placeholder={point?.unit ?? '自动'}
              onChange={(event) => updateProps({ unit: event.target.value })}
            />
          </Field>
        </>
      )
    }
    if (node.type === 'button') {
      return (
        <>
          <Field label="按钮文字">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <Field label="操作方式">
            <select
              className="select-input"
              value={node.props.action ?? 'set'}
              onChange={(event) =>
                updateProps({ action: event.target.value as 'set' | 'toggle' })
              }
            >
              <option value="set">写入指定值</option>
              <option value="toggle">切换当前值</option>
            </select>
          </Field>
          {writeValueEditor()}
        </>
      )
    }
    if (node.type === 'switch') {
      return (
        <>
          <Field label="标题">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <div className="field-grid">
            <Field label="ON 文本">
              <input
                className="text-input"
                value={node.props.onText ?? ''}
                onChange={(event) => updateProps({ onText: event.target.value })}
              />
            </Field>
            <Field label="OFF 文本">
              <input
                className="text-input"
                value={node.props.offText ?? ''}
                onChange={(event) => updateProps({ offText: event.target.value })}
              />
            </Field>
          </div>
        </>
      )
    }
    if (node.type === 'slider') {
      return (
        <>
          <Field label="标题">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <div className="field-grid quad">
            <Field label="最小">
              <input
                className="text-input mono"
                type="number"
                value={node.props.min ?? 0}
                onChange={(event) => updateProps({ min: Number(event.target.value) })}
              />
            </Field>
            <Field label="最大">
              <input
                className="text-input mono"
                type="number"
                value={node.props.max ?? 100}
                onChange={(event) => updateProps({ max: Number(event.target.value) })}
              />
            </Field>
            <Field label="步长">
              <input
                className="text-input mono"
                type="number"
                value={node.props.step ?? 1}
                onChange={(event) => updateProps({ step: Number(event.target.value) })}
              />
            </Field>
            <Field label="小数">
              <input
                className="text-input mono"
                type="number"
                min={0}
                max={4}
                value={node.props.precision ?? 0}
                onChange={(event) => updateProps({ precision: Number(event.target.value) })}
              />
            </Field>
          </div>
          <ColorField
            label="滑块颜色"
            value={node.props.barColor || '#48b8ff'}
            onChange={(value) => updateProps({ barColor: value })}
          />
        </>
      )
    }
    if (node.type === 'select') {
      const pointOptions = point?.options
      const options = pointOptions?.length ? pointOptions : node.props.options ?? []
      return (
        <>
          <Field label="标题">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <div className="field">
            <span className="field-label">下拉选项</span>
            {pointOptions?.length ? (
              <div className="readonly-options">
                {pointOptions.map((option) => (
                  <span key={String(option.value)}>
                    <code>{String(option.value)}</code>
                    {option.label}
                  </span>
                ))}
                <small>选项来自所绑定点位</small>
              </div>
            ) : (
              <OptionsEditor
                options={options}
                onChange={(nextOptions) => updateProps({ options: nextOptions })}
              />
            )}
          </div>
          {pointOptions?.length ? (
            <div className="inspector-note">
              <Database size={13} />
              当前点位已提供选项，预览时使用点位选项写入。
            </div>
          ) : null}
        </>
      )
    }
    if (node.type === 'number') {
      return (
        <>
          <Field label="标题">
            <input
              className="text-input"
              value={node.props.text ?? ''}
              onChange={(event) => updateProps({ text: event.target.value })}
            />
          </Field>
          <div className="field-grid quad">
            <Field label="最小">
              <input
                className="text-input mono"
                type="number"
                value={node.props.min ?? 0}
                onChange={(event) => updateProps({ min: Number(event.target.value) })}
              />
            </Field>
            <Field label="最大">
              <input
                className="text-input mono"
                type="number"
                value={node.props.max ?? 100}
                onChange={(event) => updateProps({ max: Number(event.target.value) })}
              />
            </Field>
            <Field label="步长">
              <input
                className="text-input mono"
                type="number"
                value={node.props.step ?? 0.1}
                onChange={(event) => updateProps({ step: Number(event.target.value) })}
              />
            </Field>
            <Field label="小数">
              <input
                className="text-input mono"
                type="number"
                min={0}
                max={4}
                value={node.props.precision ?? 1}
                onChange={(event) => updateProps({ precision: Number(event.target.value) })}
              />
            </Field>
          </div>
        </>
      )
    }
    return null
  }

  return (
    <aside className="inspector-panel">
      <div className="inspector-tabs" role="tablist">
        <button className={tab === 'properties' ? 'is-active' : ''} onClick={() => onTabChange('properties')}>
          属性
        </button>
        <button
          className={tab === 'data' ? 'is-active' : ''}
          onClick={() => onTabChange('data')}
          disabled={selectedNodes.length > 1}
        >
          数据
          {node?.binding.pointId && <span className="tab-dot" />}
        </button>
      </div>

      <div className="inspector-scroll">
        <div className="inspector-selection-head">
          <div className="selection-icon" style={{ color: node ? pointTone(point) : '#6d8496' }}>
            {node ? <PaletteIcon type={node.type} /> : <SlidersHorizontal size={18} />}
          </div>
          <div className="selection-titles">
            <span className="selection-tag">
              {node ? node.tag : selectedNodes.length > 1 ? 'MULTI SELECT' : 'PAGE'}
            </span>
            <h2>
              {node
                ? node.label
                : selectedNodes.length > 1
                  ? `${selectedNodes.length} 个组件`
                  : '页面属性'}
            </h2>
          </div>
          {node && (
            <span className={`selection-health ${point ? 'has-binding' : ''}`}>
              <span className={`live-dot ${point ? 'is-running' : 'is-demo'}`} />
              {point ? '已绑定' : '未绑定'}
            </span>
          )}
        </div>

        {tab === 'properties' && node && (
          <>
            {node.type === 'image' && (
              <section className="inspector-section">
                <div className="section-heading">
                  <span>图片状态映射</span>
                  <ImageIcon size={13} />
                </div>
                <ImageStateEditor
                  point={point}
                  states={node.props.imageStates ?? []}
                  objectFit={node.props.objectFit}
                  onChange={(states) => updateProps({ imageStates: states })}
                  onObjectFitChange={(objectFit) => updateProps({ objectFit })}
                />
              </section>
            )}

            <section className="inspector-section">
              <div className="section-heading">
                <span>标识信息</span>
                <span className="section-note">{definition?.name}</span>
              </div>
              <Field label="组件名称">
                <input
                  className="text-input"
                  value={node.label}
                  onChange={(event) => onUpdateNode(node.id, { label: event.target.value })}
                />
              </Field>
              <div className="field-grid">
                <Field label="组件编号">
                  <input
                    className="text-input mono"
                    value={node.tag}
                    onChange={(event) => onUpdateNode(node.id, { tag: event.target.value.toUpperCase() })}
                  />
                </Field>
                <Field label="旋转角度">
                  <div className="input-with-suffix">
                    <input
                      className="text-input mono"
                      type="number"
                      min={-180}
                      max={180}
                      value={node.rotation}
                      onChange={(event) => onUpdateNode(node.id, { rotation: Number(event.target.value) || 0 })}
                    />
                    <span>°</span>
                  </div>
                </Field>
              </div>
            </section>

            <section className="inspector-section">
              <div className="section-heading">
                <span>位置与尺寸</span>
                <span className="section-note">网格 8 px</span>
              </div>
              <div className="field-grid quad">
                <Field label="X">
                  <input
                    className="text-input mono"
                    type="number"
                    value={Math.round(node.x)}
                    onChange={(event) => onUpdateNode(node.id, { x: Number(event.target.value) || 0 })}
                  />
                </Field>
                <Field label="Y">
                  <input
                    className="text-input mono"
                    type="number"
                    value={Math.round(node.y)}
                    onChange={(event) => onUpdateNode(node.id, { y: Number(event.target.value) || 0 })}
                  />
                </Field>
                <Field label="W">
                  <input
                    className="text-input mono"
                    type="number"
                    min={32}
                    max={2000}
                    value={Math.round(node.w)}
                    onChange={(event) => onUpdateNode(node.id, { w: Math.max(32, Number(event.target.value) || 32) })}
                  />
                </Field>
                <Field label="H">
                  <input
                    className="text-input mono"
                    type="number"
                    min={24}
                    max={2000}
                    value={Math.round(node.h)}
                    onChange={(event) => onUpdateNode(node.id, { h: Math.max(24, Number(event.target.value) || 24) })}
                  />
                </Field>
              </div>
              <div className="rotation-row">
                <SlidersHorizontal size={13} />
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={node.rotation}
                  onChange={(event) => onUpdateNode(node.id, { rotation: Number(event.target.value) })}
                />
                <span>{node.rotation}°</span>
              </div>
            </section>

            <section className="inspector-section">
              <div className="section-heading">
                <span>外观样式</span>
                <Palette size={13} />
              </div>
              <div className="color-preset-row">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    className="color-preset"
                    style={{ background: color }}
                    onClick={() => updateStyle({ stroke: color })}
                    title={`描边 ${color}`}
                  />
                ))}
              </div>
              <div className="field-grid">
                <ColorField
                  label="填充"
                  value={node.style.fill === 'transparent' ? '#0d1c2a' : node.style.fill}
                  onChange={(value) => updateStyle({ fill: value })}
                />
                <ColorField
                  label="描边"
                  value={node.style.stroke === 'transparent' ? '#29465c' : node.style.stroke}
                  onChange={(value) => updateStyle({ stroke: value })}
                />
              </div>
              <div className="field-grid">
                <ColorField
                  label="文字"
                  value={node.style.textColor}
                  onChange={(value) => updateStyle({ textColor: value })}
                />
                <Field label="圆角">
                  <input
                    className="text-input mono"
                    type="number"
                    min={0}
                    max={60}
                    value={node.style.radius}
                    onChange={(event) => updateStyle({ radius: Number(event.target.value) })}
                  />
                </Field>
              </div>
              <div className="field-grid">
                <Field label="边框宽度">
                  <input
                    className="text-input mono"
                    type="number"
                    min={0}
                    max={8}
                    step={0.5}
                    value={node.style.strokeWidth}
                    onChange={(event) => updateStyle({ strokeWidth: Number(event.target.value) })}
                  />
                </Field>
                <Field label="不透明度">
                  <input
                    className="text-input mono"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={node.style.opacity}
                    onChange={(event) => updateStyle({ opacity: Number(event.target.value) })}
                  />
                </Field>
              </div>
              <div className="switch-row">
                <span>
                  <Lock size={13} />
                  锁定组件位置
                </span>
                <Toggle
                  checked={Boolean(node.locked)}
                  onChange={(value) => onUpdateNode(node.id, { locked: value })}
                  label="锁定组件位置"
                />
              </div>
            </section>

            <section className="inspector-section">
              <div className="section-heading">
                <span>组件设置</span>
                <MousePointerClick size={13} />
              </div>
              {componentSettings()}
            </section>

            <section className="inspector-section">
              <div className="section-heading">
                <span>图层与操作</span>
                <Eye size={13} />
              </div>
              <div className="layer-actions">
                <button onClick={onBringForward}>
                  <ArrowUpToLine size={14} />
                  上移一层
                </button>
                <button onClick={onSendBackward}>
                  <ArrowDownToLine size={14} />
                  下移一层
                </button>
              </div>
              <div className="danger-actions">
                <button onClick={onDuplicate}>
                  <Link2 size={13} />
                  复制组件
                </button>
                <button className="danger" onClick={onDelete}>
                  <Trash2 size={13} />
                  删除
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'properties' && selectedNodes.length > 1 && (
          <>
            <section className="inspector-section">
              <div className="section-heading">
                <span>批量对齐</span>
                <span className="section-note">{selectedNodes.length} 个组件</span>
              </div>
              <div className="align-grid">
                <button onClick={() => onAlign('left')}>
                  <AlignStartVertical size={16} />
                  左对齐
                </button>
                <button onClick={() => onAlign('hcenter')}>
                  <AlignCenterVertical size={16} />
                  水平居中
                </button>
                <button onClick={() => onAlign('right')}>
                  <AlignEndVertical size={16} />
                  右对齐
                </button>
                <button onClick={() => onAlign('top')}>
                  <AlignStartHorizontal size={16} />
                  顶对齐
                </button>
                <button onClick={() => onAlign('vcenter')}>
                  <AlignCenterHorizontal size={16} />
                  垂直居中
                </button>
                <button onClick={() => onAlign('bottom')}>
                  <AlignEndHorizontal size={16} />
                  底对齐
                </button>
              </div>
            </section>
            <section className="inspector-section">
              <div className="section-heading">
                <span>批量操作</span>
              </div>
              <div className="danger-actions">
                <button onClick={onDuplicate}>
                  <Link2 size={13} />
                  复制
                </button>
                <button className="danger" onClick={onDelete}>
                  <Trash2 size={13} />
                  删除
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'properties' && !node && selectedNodes.length === 0 && (
          <>
            <section className="inspector-section">
              <div className="section-heading">
                <span>当前页面</span>
                <span className="section-note">{page.nodes.length} 组件</span>
              </div>
              <Field label="页面名称">
                <input
                  className="text-input"
                  value={page.name}
                  onChange={(event) => onUpdatePage({ name: event.target.value })}
                />
              </Field>
              <Field label="页面说明">
                <input
                  className="text-input"
                  value={page.subtitle}
                  onChange={(event) => onUpdatePage({ subtitle: event.target.value })}
                />
              </Field>
            </section>

            <section className="project-overview-card">
              <div className="overview-head">
                <span className="overview-icon">
                  <Database size={16} />
                </span>
                <div>
                  <span className="eyebrow">HMI PROJECT</span>
                  <h3>{project.site}</h3>
                </div>
                <span className="version-pill">{project.version}</span>
              </div>
              <div className="overview-stats">
                <div>
                  <strong>{project.pages.length}</strong>
                  <span>页面</span>
                </div>
                <div>
                  <strong>{page.nodes.length}</strong>
                  <span>组件</span>
                </div>
                <div>
                  <strong>{boundCount}</strong>
                  <span>已绑定</span>
                </div>
                <div>
                  <strong>{points.length}</strong>
                  <span>点位</span>
                </div>
              </div>
              <div className={`overview-check ${status === 'connected' ? 'is-live' : ''}`}>
                {status === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span>
                  {status === 'connected'
                    ? 'WebSocket 实时数据已接入'
                    : '演示数据模式 · 点击顶部连接数据源'}
                </span>
              </div>
            </section>

            <section className="inspector-section">
              <div className="section-heading">
                <span>项目数据</span>
                <span className="section-note">{totalBindings} 个绑定</span>
              </div>
              <div className="project-data-list">
                <div>
                  <span>可写点位</span>
                  <strong>{writableCount}</strong>
                </div>
                <div>
                  <span>数据协议</span>
                  <strong>WebSocket JSON</strong>
                </div>
                <div>
                  <span>刷新方式</span>
                  <strong>服务端推送</strong>
                </div>
              </div>
            </section>

            <div className="inspector-tip-card">
              <Sparkles size={15} />
              <div>
                <strong>组态提示</strong>
                <p>
                  所有数据展示组件都可以绑定点位。按钮、滑块、开关、下拉框和数字输入在预览模式下可写回点位。
                </p>
              </div>
            </div>
          </>
        )}

        {tab === 'data' && node && (
          <>
            <section className={`binding-card ${point ? 'has-point' : ''}`}>
              <div className="binding-card-top">
                <span className="eyebrow">POINT BINDING</span>
                <span className={`quality-pill quality-${point?.quality ?? 'bad'}`}>
                  {point ? 'LIVE' : 'UNBOUND'}
                </span>
              </div>
              {point ? (
                <>
                  <div className="binding-value-row">
                    <strong style={{ color: pointTone(point) }}>
                      {formatPointValue(point)}
                      <span>{point.unit}</span>
                    </strong>
                    <span className="binding-realtime">
                      <span className="live-dot is-running" />
                      实时
                    </span>
                  </div>
                  <div className="binding-meta">
                    <span>{point.name}</span>
                    <span>{point.device}</span>
                  </div>
                  <div className="binding-foot">
                    <span className={`point-type type-${point.pointType.toLowerCase()}`}>
                      {point.pointType}
                    </span>
                    <span className="mono">{point.id}</span>
                    <span className="binding-time">
                      {point.writable ? '可写点位' : '只读点位'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="binding-empty">
                  <Unlink size={20} />
                  <p>尚未绑定点位</p>
                  <span>选择下方点位后，组件会随 WebSocket 数据自动更新。</span>
                </div>
              )}
            </section>

            <section className="inspector-section">
              <div className="section-heading">
                <span>点位绑定</span>
                <Database size={13} />
              </div>
              <div className="point-picker-wrap">
                <button
                  className="point-select-trigger"
                  onClick={() => setPointDropdownOpen((value) => !value)}
                >
                  <span>
                    {point ? (
                      <>
                        <strong>{point.name}</strong>
                        <small>
                          {point.device} · {point.id}
                        </small>
                      </>
                    ) : (
                      <span className="is-placeholder">选择点位…</span>
                    )}
                  </span>
                  <ChevronDown size={13} />
                </button>
                {point && (
                  <button
                    className="point-clear"
                    onClick={() => onBind(node.id, null)}
                    title="解除绑定"
                    aria-label="解除绑定"
                  >
                    <X size={12} />
                  </button>
                )}
                {pointDropdownOpen && (
                  <div className="point-dropdown">
                    <label className="point-search">
                      <Database size={12} />
                      <input
                        value={pointQuery}
                        onChange={(event) => setPointQuery(event.target.value)}
                        placeholder="搜索点位…"
                        autoFocus
                      />
                    </label>
                    <div className="point-dropdown-list">
                      {filteredPoints.map((item) => (
                        <button
                          key={item.id}
                          className={item.id === point?.id ? 'is-active' : ''}
                          onClick={() => {
                            onBind(node.id, item.id, node.binding.mode)
                            setPointDropdownOpen(false)
                          }}
                        >
                          <span className={`point-type type-${item.pointType.toLowerCase()}`}>
                            {item.pointType}
                          </span>
                          <span className="point-dropdown-copy">
                            <strong>{item.name}</strong>
                            <small>
                              {item.device} · {item.id}
                            </small>
                          </span>
                          <span className="point-dropdown-value">
                            {formatPointValue(item)}
                            <small>{item.unit}</small>
                          </span>
                        </button>
                      ))}
                      {!filteredPoints.length && <div className="point-dropdown-empty">没有匹配点位</div>}
                    </div>
                  </div>
                )}
              </div>
              {point && (
                <div className="point-binding-info">
                  <span className={`quality-dot quality-${point.quality}`} />
                  <span>数据质量：{point.quality === 'good' ? '良好' : point.quality === 'stale' ? '滞后' : '异常'}</span>
                  <span className="mono">{point.pointType}</span>
                </div>
              )}
            </section>

            {['rect', 'ellipse', 'panel', 'line'].includes(node.type) && (
              <section className="inspector-section">
                <div className="section-heading">
                  <span>数据驱动外观</span>
                  <CircleAlert size={13} />
                </div>
                <div className="bind-mode-grid">
                  {(
                    [
                      ['value', '仅显示值'],
                      ['visibility', '控制显示'],
                      ['fill', '控制颜色'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      className={node.binding.mode === mode ? 'is-active' : ''}
                      onClick={() => updateBindingMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {node.binding.mode === 'fill' && (
                  <>
                    <Field label="触发阈值" hint={point?.unit}>
                      <input
                        className="text-input mono"
                        type="number"
                        value={node.props.threshold ?? 1}
                        onChange={(event) => updateProps({ threshold: Number(event.target.value) })}
                      />
                    </Field>
                    <ColorField
                      label="激活颜色"
                      value={node.props.activeColor || '#ff7585'}
                      onChange={(value) => updateProps({ activeColor: value })}
                    />
                  </>
                )}
                {node.binding.mode === 'visibility' && (
                  <div className="inspector-note">
                    <Eye size={13} />
                    预览时根据布尔值或数值显示/隐藏该图形。
                  </div>
                )}
              </section>
            )}

            {['button', 'switch', 'slider', 'select', 'number'].includes(node.type) && (
              <div className="write-helper">
                <MousePointerClick size={15} />
                <div>
                  <strong>可写交互组件</strong>
                  <p>
                    在预览模式下操作该组件，会通过 WebSocket 发送
                    <code>point.write</code> 消息；演示模式下仅更新本地模拟值。
                  </p>
                </div>
              </div>
            )}

            {node.type === 'image' && (
              <div className="inspector-note">
                <ImageIcon size={13} />
                绑定点位后，请到“属性”页上传各状态对应的图片。布尔点位使用两张，数字点位按区间，枚举点位按值。
              </div>
            )}

            <section className="inspector-section">
              <div className="section-heading">
                <span>推荐点位</span>
                <span className="section-note">同设备优先</span>
              </div>
              <div className="recommended-points">
                {recommendedPoints(points, node, point)
                  .slice(0, 5)
                  .map((item) => (
                    <button
                      key={item.id}
                      className={`recommended-point ${item.id === point?.id ? 'is-bound' : ''}`}
                      onClick={() => onBind(node.id, item.id, node.binding.mode)}
                    >
                      <span className="recommended-info">
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.device}</small>
                        </span>
                        <span className="recommended-reading">
                          {formatPointValue(item)}
                          <small>{item.unit}</small>
                        </span>
                      </span>
                      <span className="recommended-bind">
                        {item.id === point?.id ? <CheckCircle2 size={13} /> : <Link2 size={13} />}
                        {item.id === point?.id ? '已绑定' : '绑定'}
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          </>
        )}

        {tab === 'data' && !node && (
          <div className="inspector-placeholder">
            <Database size={22} />
            <h3>选择单个组件</h3>
            <p>绑定点位后，组件的数值、图形、颜色或可见性会随数据实时更新。</p>
          </div>
        )}
      </div>

      <div className="inspector-footer">
        <span className="save-indicator">
          <span className={`live-dot ${status === 'connected' ? 'is-running' : 'is-demo'}`} />
          {status === 'connected' ? '实时数据推送中' : '本地演示数据'}
        </span>
        <span>{project.version}</span>
      </div>
    </aside>
  )
}

function pointTone(point?: PointDefinition) {
  if (!point) return '#6d8496'
  if (isBooleanPoint(point)) return isOn(point) ? '#42e6bc' : '#ff7f89'
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
    default:
      return '#48b8ff'
  }
}

function recommendedPoints(
  points: PointDefinition[],
  node: GraphNode,
  current?: PointDefinition,
) {
  const deviceMatch = current ? points.filter((point) => point.device === current.device) : []
  const control = ['button', 'switch', 'slider', 'select', 'number'].includes(node.type)
  const shape = ['rect', 'ellipse', 'panel'].includes(node.type)
  const display = points.filter((point) => {
    if (control) return point.writable
    if (shape) return isBooleanPoint(point) || typeof point.value === 'number'
    return !point.writable || point.writable
  })
  const merged = [current, ...deviceMatch, ...display, ...points].filter(
    (point): point is PointDefinition => Boolean(point),
  )
  const seen = new Set<string>()
  return merged.filter((point) => {
    if (seen.has(point.id)) return false
    seen.add(point.id)
    return true
  })
}
