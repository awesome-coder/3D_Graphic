import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Database,
  PenLine,
  Radio,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import type {
  ConnectionStatus,
  DataMode,
  PointDefinition,
  WsEvent,
  WriteLog,
} from '../types'
import { formatPointValue } from '../lib/graph'

export type BottomTab = 'points' | 'writes' | 'source'

interface BottomPanelProps {
  tab: BottomTab
  onTabChange: (tab: BottomTab) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  points: PointDefinition[]
  writeLogs: WriteLog[]
  bindingCounts: Record<string, number>
  status: ConnectionStatus
  mode: DataMode
  url: string
  messageCount: number
  lastMessageAt: string | null
  lastError: string | null
  events: WsEvent[]
  focusedPointId?: string | null
  onOpenConnection: () => void
  onClearWrites: () => void
}

function statusText(status: ConnectionStatus, mode: DataMode) {
  if (status === 'connected') return 'WebSocket 已连接'
  if (status === 'connecting') return '正在连接'
  if (status === 'error') return '连接异常'
  if (status === 'disconnected') return '连接已断开'
  return mode === 'demo' ? '本地演示' : '等待连接'
}

export function BottomPanel({
  tab,
  onTabChange,
  collapsed,
  onCollapsedChange,
  points,
  writeLogs,
  bindingCounts,
  status,
  mode,
  url,
  messageCount,
  lastMessageAt,
  lastError,
  events,
  focusedPointId,
  onOpenConnection,
  onClearWrites,
}: BottomPanelProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'bound' | 'writable'>('all')

  useEffect(() => {
    if (!focusedPointId || tab !== 'points' || collapsed) return
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-point-row="${focusedPointId}"]`)
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [collapsed, focusedPointId, tab])

  const filteredPoints = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return points.filter((point) => {
      const matchesQuery =
        !needle ||
        point.name.toLowerCase().includes(needle) ||
        point.device.toLowerCase().includes(needle) ||
        point.id.toLowerCase().includes(needle)
      const matchesFilter =
        filter === 'all' ||
        (filter === 'bound' && (bindingCounts[point.id] ?? 0) > 0) ||
        (filter === 'writable' && point.writable)
      return matchesQuery && matchesFilter
    })
  }, [bindingCounts, filter, points, query])

  const switchTab = (next: BottomTab) => {
    onTabChange(next)
    if (collapsed) onCollapsedChange(false)
  }

  const boundPointCount = Object.keys(bindingCounts).filter((id) => bindingCounts[id] > 0).length
  const writablePoints = points.filter((point) => point.writable).length

  return (
    <section className={`bottom-panel ${collapsed ? 'is-collapsed' : ''}`}>
      <header className="bottom-panel-head">
        <div className="bottom-tabs" role="tablist">
          <button className={tab === 'points' ? 'is-active' : ''} onClick={() => switchTab('points')}>
            <Database size={13} />
            点位监视
            <span className="tab-count">{points.length}</span>
          </button>
          <button className={tab === 'writes' ? 'is-active' : ''} onClick={() => switchTab('writes')}>
            <PenLine size={13} />
            写入记录
            {writeLogs.length > 0 && <span className="tab-badge">{writeLogs.length}</span>}
          </button>
          <button className={tab === 'source' ? 'is-active' : ''} onClick={() => switchTab('source')}>
            <Radio size={13} />
            数据源
            <span className={`source-dot ${status === 'connected' ? 'is-live' : 'is-demo'}`} />
          </button>
        </div>

        <div className="bottom-head-actions">
          {tab === 'points' && !collapsed && (
            <>
              <label className="bottom-search">
                <Search size={12} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="筛选点位…"
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="清空">
                    <X size={10} />
                  </button>
                )}
              </label>
              <div className="range-switch">
                {(
                  [
                    ['all', '全部'],
                    ['bound', '已绑定'],
                    ['writable', '可写'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={filter === value ? 'is-active' : ''}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === 'writes' && !collapsed && (
            <button className="panel-text-button" onClick={onClearWrites} disabled={!writeLogs.length}>
              <X size={12} />
              清空记录
            </button>
          )}
          {tab === 'source' && !collapsed && (
            <button className="panel-text-button" onClick={onOpenConnection}>
              <Radio size={12} />
              连接设置
            </button>
          )}
          <span className="bottom-meta">
            {status === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
            {statusText(status, mode)}
          </span>
          <button
            className="collapse-button"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? '展开底部面板' : '收起底部面板'}
            title={collapsed ? '展开面板' : '收起面板'}
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="bottom-content">
          {tab === 'points' && (
            <div className="point-monitor-panel">
              <div className="point-table-head">
                <span>点位</span>
                <span>设备</span>
                <span>类型</span>
                <span>当前值</span>
                <span>单位</span>
                <span>绑定</span>
                <span>质量</span>
              </div>
              <div className="point-table-body">
                {filteredPoints.map((point) => (
                  <div
                    className={`point-table-row ${focusedPointId === point.id ? 'is-focused' : ''}`}
                    key={point.id}
                    data-point-row={point.id}
                  >
                    <span className="point-table-name">
                      <span className={`live-dot ${status === 'connected' ? 'is-running' : 'is-demo'}`} />
                      <span>
                        <strong>{point.name}</strong>
                        <small>{point.id}</small>
                      </span>
                    </span>
                    <span className="point-table-device mono">{point.device}</span>
                    <span>
                      <span className={`point-type type-${point.pointType.toLowerCase()}`}>
                        {point.pointType}
                      </span>
                    </span>
                    <span className={`point-table-value ${point.writable ? 'is-writable' : ''}`}>
                      {formatPointValue(point)}
                    </span>
                    <span className="point-table-unit">{point.unit || '—'}</span>
                    <span className="point-table-bindings">
                      {bindingCounts[point.id] ? `${bindingCounts[point.id]} 个` : '—'}
                    </span>
                    <span className={`quality-cell quality-${point.quality}`}>
                      <span className={`quality-dot quality-${point.quality}`} />
                      {point.quality === 'good' ? 'GOOD' : point.quality.toUpperCase()}
                    </span>
                  </div>
                ))}
                {!filteredPoints.length && (
                  <div className="panel-empty">
                    <Database size={18} />
                    <span>没有匹配的点位</span>
                  </div>
                )}
              </div>
              <div className="point-monitor-foot">
                <span>{boundPointCount} 个点位已被组件绑定</span>
                <span>{writablePoints} 个可写点位</span>
                <span className="point-monitor-refresh">
                  <RefreshCw size={10} />
                  {status === 'connected' ? '服务端推送' : '1.5s 模拟刷新'}
                </span>
              </div>
            </div>
          )}

          {tab === 'writes' && (
            <div className="write-panel">
              <div className="write-table-head">
                <span>时间</span>
                <span>点位</span>
                <span>写入值</span>
                <span>操作来源</span>
                <span>通道</span>
                <span>状态</span>
              </div>
              <div className="write-table-body">
                {writeLogs.map((log) => (
                  <div className="write-table-row" key={log.id}>
                    <span className="mono write-time">{log.time}</span>
                    <span className="write-point">
                      <strong>{log.pointName}</strong>
                      <small>{log.pointId}</small>
                    </span>
                    <span className="write-value">{log.valueLabel}</span>
                    <span>{log.source}</span>
                    <span className={`write-transport ${log.transport}`}>
                      {log.transport === 'websocket' ? 'WebSocket' : '演示'}
                    </span>
                    <span className={`write-status ${log.status}`}>
                      {log.status === 'sent' ? (
                        <>
                          <CircleCheck size={11} /> 已发送
                        </>
                      ) : log.status === 'error' ? (
                        '失败'
                      ) : (
                        '本地生效'
                      )}
                    </span>
                  </div>
                ))}
                {!writeLogs.length && (
                  <div className="panel-empty write-empty">
                    <PenLine size={20} />
                    <span>还没有写入操作</span>
                    <small>在预览模式中操作按钮、滑块或开关后，写入记录会出现在这里。</small>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'source' && (
            <div className="source-panel">
              <div className="source-status-card">
                <div className={`source-orb ${status === 'connected' ? 'is-live' : 'is-demo'}`}>
                  {status === 'connected' ? <Wifi size={18} /> : <Radio size={18} />}
                </div>
                <div className="source-status-copy">
                  <span className="eyebrow">DATA SOURCE</span>
                  <h3>{statusText(status, mode)}</h3>
                  <p className="mono">{url}</p>
                </div>
                <button className="source-config-button" onClick={onOpenConnection}>
                  配置连接
                </button>
                <div className="source-stats">
                  <div>
                    <span>消息数</span>
                    <strong>{messageCount}</strong>
                  </div>
                  <div>
                    <span>最后消息</span>
                    <strong>{lastMessageAt ?? '—'}</strong>
                  </div>
                  <div>
                    <span>工作模式</span>
                    <strong>{mode === 'live' ? '实时' : '演示'}</strong>
                  </div>
                </div>
              </div>
              <div className="source-protocol">
                <span className="source-panel-label">消息协议</span>
                <pre>{`{ "type": "points.snapshot",
  "points": { "p-supply-temp": 16.8 } }

{ "type": "point.update",
  "id": "p-supply-temp", "value": 16.8 }`}</pre>
                <span className="source-protocol-note">服务端可推送快照或单点更新，字段支持 number / boolean / string。</span>
              </div>
              <div className="source-events">
                <span className="source-panel-label">最近事件</span>
                {events.slice(0, 5).map((event) => (
                  <div className={`source-event direction-${event.direction}`} key={event.id}>
                    <span className="source-event-time mono">{event.time}</span>
                    <span className="source-event-dir">
                      {event.direction === 'in' ? 'IN' : event.direction === 'out' ? 'OUT' : 'SYS'}
                    </span>
                    <span className="source-event-message">{event.message}</span>
                  </div>
                ))}
                {!events.length && (
                  <div className="source-event-empty">
                    <Activity size={13} />
                    尚未收到 WebSocket 消息
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
