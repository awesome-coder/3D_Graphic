import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Database,
  GripVertical,
  Layers3,
  Link2,
  PenLine,
  Radio,
  Search,
  Wifi,
  X,
} from 'lucide-react'
import type {
  ComponentCategory,
  ComponentDefinition,
  ComponentType,
  ConnectionStatus,
  DataMode,
  LibraryTab,
  PointDefinition,
  Selection,
} from '../types'
import { CATEGORY_META, CATEGORY_ORDER, COMPONENTS } from '../data/components'
import { formatPointValue } from '../lib/graph'
import { PaletteIcon } from './PaletteIcon'

interface LibraryPanelProps {
  points: PointDefinition[]
  selection: Selection
  status: ConnectionStatus
  mode: DataMode
  libraryTab: LibraryTab
  onLibraryTabChange: (tab: LibraryTab) => void
  onAddComponent: (type: ComponentType) => void
  onSelectPoint: (pointId: string) => void
  onQuickBind: (pointId: string) => void
}

export function LibraryPanel({
  points,
  selection,
  status,
  mode,
  libraryTab,
  onLibraryTabChange,
  onAddComponent,
  onSelectPoint,
  onQuickBind,
}: LibraryPanelProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ANALOG' | 'DIGITAL' | 'STRING'>('ALL')
  const [collapsed, setCollapsed] = useState<Set<ComponentCategory>>(new Set())

  const filteredComponents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return COMPONENTS
    return COMPONENTS.filter(
      (component) =>
        component.name.toLowerCase().includes(needle) ||
        component.description.toLowerCase().includes(needle) ||
        component.shortName.toLowerCase().includes(needle),
    )
  }, [query])

  const filteredPoints = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return points.filter((point) => {
      const matchesType =
        typeFilter === 'ALL' ||
        (typeFilter === 'ANALOG' && (point.pointType === 'AI' || point.pointType === 'AO')) ||
        (typeFilter === 'DIGITAL' && (point.pointType === 'DI' || point.pointType === 'DO')) ||
        (typeFilter === 'STRING' && point.pointType === 'STRING')
      const matchesQuery =
        !needle ||
        point.name.toLowerCase().includes(needle) ||
        point.device.toLowerCase().includes(needle) ||
        point.id.toLowerCase().includes(needle)
      return matchesType && matchesQuery
    })
  }, [points, query, typeFilter])

  const grouped = useMemo(() => {
    const map = new Map<ComponentCategory, ComponentDefinition[]>()
    for (const category of CATEGORY_ORDER) map.set(category, [])
    for (const component of filteredComponents) map.get(component.category)?.push(component)
    return map
  }, [filteredComponents])

  const toggleCategory = (category: ComponentCategory) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const quickBindEnabled = selection.length === 1
  const canWrite = status === 'connected' || mode === 'demo'

  return (
    <aside className="library-panel">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">LIBRARY</span>
          <h2>{libraryTab === 'components' ? '组件库' : '点位库'}</h2>
        </div>
        <span className="panel-count">
          {libraryTab === 'components' ? COMPONENTS.length : points.length}
        </span>
      </div>

      <div className="segmented library-tabs" role="tablist">
        <button
          className={libraryTab === 'components' ? 'is-active' : ''}
          onClick={() => onLibraryTabChange('components')}
          role="tab"
          aria-selected={libraryTab === 'components'}
        >
          <Layers3 size={13} />
          组件
        </button>
        <button
          className={libraryTab === 'points' ? 'is-active' : ''}
          onClick={() => onLibraryTabChange('points')}
          role="tab"
          aria-selected={libraryTab === 'points'}
        >
          <Database size={13} />
          点位
        </button>
      </div>

      <label className="search-box">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={libraryTab === 'components' ? '搜索图形、数值、按钮…' : '搜索点位、设备或 ID…'}
          aria-label={libraryTab === 'components' ? '搜索组件' : '搜索点位'}
        />
        {query ? (
          <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="清空搜索">
            <X size={12} />
          </button>
        ) : (
          <span className="search-kbd">/</span>
        )}
      </label>

      {libraryTab === 'points' && (
        <div className="point-filter-row">
          {(
            [
              ['ALL', '全部'],
              ['ANALOG', '模拟量'],
              ['DIGITAL', '开关量'],
              ['STRING', '枚举'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={typeFilter === value ? 'is-active' : ''}
              onClick={() => setTypeFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="library-scroll">
        {libraryTab === 'components' ? (
          <>
            {CATEGORY_ORDER.map((category) => {
              const items = grouped.get(category) ?? []
              if (!items.length) return null
              const isCollapsed = collapsed.has(category)
              return (
                <section className="component-category" key={category}>
                  <button className="category-heading" onClick={() => toggleCategory(category)}>
                    <span className="category-chevron">
                      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </span>
                    <span>{category}</span>
                    <span className="category-caption">{CATEGORY_META[category].caption}</span>
                    <span className="category-count">{items.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="component-grid">
                      {items.map((component) => (
                        <button
                          key={component.type}
                          className="component-card"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('application/x-aeron-component', component.type)
                            event.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => onAddComponent(component.type)}
                          title={`${component.description} · 点击或拖拽添加`}
                        >
                          <span className="component-icon" style={{ color: component.accent }}>
                            <PaletteIcon type={component.type} />
                          </span>
                          <span className="component-name">{component.name}</span>
                          <span className="component-short">{component.shortName}</span>
                          <GripVertical className="component-grip" size={11} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
            {!filteredComponents.length && (
              <div className="library-empty">
                <Search size={20} />
                <p>没有匹配的组件</p>
                <span>尝试搜索“滑块”或“数值”</span>
              </div>
            )}
          </>
        ) : (
          <div className="point-library">
            <div className="point-list-caption">
              <span>{filteredPoints.length} 个点位</span>
              <span className="point-live-note">
                <span className={`live-dot ${status === 'connected' ? 'is-running' : 'is-demo'}`} />
                {status === 'connected' ? 'WS LIVE' : 'DEMO'}
              </span>
            </div>
            {filteredPoints.map((point) => (
              <div
                key={point.id}
                className="point-row"
                role="button"
                tabIndex={0}
                onClick={() => onSelectPoint(point.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectPoint(point.id)
                  }
                }}
                title={`${point.id} · ${point.device}`}
              >
                <span className={`point-type type-${point.pointType.toLowerCase()}`}>{point.pointType}</span>
                <span className="point-main">
                  <span className="point-name">{point.name}</span>
                  <span className="point-device">
                    {point.device}
                    {point.writable && (
                      <span className="point-write-badge">
                        <PenLine size={8} /> 可写
                      </span>
                    )}
                  </span>
                </span>
                <span className="point-reading">
                  <span className="point-value">{formatPointValue(point)}</span>
                  <span className="point-unit">{point.unit}</span>
                  <span className={`quality-dot quality-${point.quality}`} />
                </span>
                {quickBindEnabled && (
                  <button
                    type="button"
                    className="point-bind"
                    onClick={(event) => {
                      event.stopPropagation()
                      onQuickBind(point.id)
                    }}
                    title="绑定到当前所选组件"
                    aria-label="绑定到当前所选组件"
                  >
                    <Link2 size={12} />
                  </button>
                )}
              </div>
            ))}
            {!filteredPoints.length && (
              <div className="library-empty">
                <Database size={20} />
                <p>没有匹配的点位</p>
                <span>切换筛选或检查搜索关键词</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="library-footer">
        <div className="gateway-row">
          <span className="gateway-icon">
            {status === 'connected' ? <Wifi size={13} /> : <Radio size={13} />}
          </span>
          <span>
            <strong>{status === 'connected' ? 'WebSocket 数据源' : '本地演示数据'}</strong>
            <small>{canWrite ? '控件可写回点位' : '等待数据源连接'}</small>
          </span>
          <span className={`gateway-status ${status === 'connected' ? 'is-live' : ''}`}>
            <span className={`live-dot ${status === 'connected' ? 'is-running' : 'is-demo'}`} />
            {status === 'connected' ? 'LIVE' : 'DEMO'}
          </span>
        </div>
        <div className="library-tip">
          <PenLine size={12} />
          <span>拖拽组件到画布，在右侧“数据”页绑定点位。</span>
        </div>
      </div>
    </aside>
  )
}
