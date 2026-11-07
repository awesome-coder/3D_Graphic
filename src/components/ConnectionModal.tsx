import {
  CheckCircle2,
  Copy,
  DatabaseZap,
  PlugZap,
  Radio,
  RefreshCw,
  ServerCog,
  TerminalSquare,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import type { ConnectionStatus, DataMode, WsEvent } from '../types'

interface ConnectionModalProps {
  url: string
  status: ConnectionStatus
  mode: DataMode
  autoReconnect: boolean
  events: WsEvent[]
  messageCount: number
  lastMessageAt: string | null
  lastError: string | null
  onUrlChange: (url: string) => void
  onAutoReconnectChange: (enabled: boolean) => void
  onConnect: () => void
  onDisconnect: () => void
  onUseDemo: () => void
  onClose: () => void
  onCopyCommand: () => void
}

function statusCopy(status: ConnectionStatus, mode: DataMode) {
  if (status === 'connected') return { label: '实时连接正常', caption: '服务端推送将直接更新组态点位', tone: 'is-live' }
  if (status === 'connecting') return { label: '正在建立连接', caption: '等待 WebSocket 握手', tone: 'is-connecting' }
  if (status === 'error') return { label: '连接失败', caption: '请检查地址或确认服务端已启动', tone: 'is-error' }
  if (status === 'disconnected') return { label: '连接已断开', caption: '可重新连接或切换到演示数据', tone: 'is-error' }
  return {
    label: mode === 'demo' ? '本地演示模式' : '未连接',
    caption: mode === 'demo' ? '内置模拟数据每 1.5 秒刷新' : '等待连接数据源',
    tone: 'is-demo',
  }
}

export function ConnectionModal({
  url,
  status,
  mode,
  autoReconnect,
  events,
  messageCount,
  lastMessageAt,
  lastError,
  onUrlChange,
  onAutoReconnectChange,
  onConnect,
  onDisconnect,
  onUseDemo,
  onClose,
  onCopyCommand,
}: ConnectionModalProps) {
  const state = statusCopy(status, mode)
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <div className="modal connection-modal" role="dialog" aria-modal="true" aria-label="WebSocket 数据源">
        <div className="modal-head">
          <span className={`modal-icon ${status === 'connected' ? 'is-mint' : 'is-blue'}`}>
            {status === 'connected' ? <Wifi size={19} /> : <PlugZap size={19} />}
          </span>
          <div>
            <span className="eyebrow">LIVE DATA SOURCE</span>
            <h2>WebSocket 数据源</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <div className={`connection-status-hero ${state.tone}`}>
          <span className="connection-hero-orb">
            {status === 'connected' ? <Wifi size={16} /> : status === 'connecting' ? <RefreshCw size={16} className="spin" /> : <WifiOff size={16} />}
          </span>
          <div>
            <strong>{state.label}</strong>
            <span>{state.caption}</span>
            {lastError && <small>{lastError}</small>}
          </div>
          <span className="connection-hero-meta">
            <span>{messageCount} messages</span>
            <span>{lastMessageAt ?? '—'}</span>
          </span>
        </div>

        <div className="connection-form">
          <label className="connection-field">
            <span>WebSocket 地址</span>
            <div className="connection-url-row">
              <ServerCog size={14} />
              <input
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onConnect()
                }}
                placeholder="ws://127.0.0.1:8787"
                spellCheck={false}
              />
              <span className="url-prefix">WS</span>
            </div>
          </label>
          <div className="connection-options">
            <div className="switch-row">
              <span>
                <RefreshCw size={13} />
                断线自动重连
              </span>
              <button
                type="button"
                className={`toggle ${autoReconnect ? 'is-on' : ''}`}
                onClick={() => onAutoReconnectChange(!autoReconnect)}
                role="switch"
                aria-checked={autoReconnect}
              >
                <span />
              </button>
            </div>
            <span className="connection-hint">连接成功后自动停用内置演示数据</span>
          </div>
          <div className="connection-actions">
            <button className="ghost-button" onClick={onUseDemo}>
              <DatabaseZap size={13} />
              使用演示数据
            </button>
            {status === 'connected' ? (
              <button className="danger-button" onClick={onDisconnect}>
                <WifiOff size={13} />
                断开连接
              </button>
            ) : (
              <button className="primary-button" onClick={onConnect} disabled={!url.trim() || status === 'connecting'}>
                <PlugZap size={13} />
                {status === 'connecting' ? '连接中…' : '连接数据源'}
              </button>
            )}
          </div>
        </div>

        <div className="mock-server-tip">
          <div className="mock-tip-head">
            <span className="mock-tip-icon">
              <TerminalSquare size={15} />
            </span>
            <div>
              <strong>本地演示 WebSocket 服务</strong>
              <span>运行下方命令后，将地址设为 ws://127.0.0.1:8787</span>
            </div>
            <button className="copy-command" onClick={onCopyCommand} title="复制命令">
              <Copy size={12} />
              复制
            </button>
          </div>
          <code>npm run ws</code>
        </div>

        <div className="protocol-panel">
          <div className="protocol-head">
            <span className="eyebrow">PROTOCOL</span>
            <span>服务端 → 组态</span>
            <span>客户端 → 服务端</span>
          </div>
          <div className="protocol-grid">
            <div>
              <span className="protocol-label">点位快照</span>
              <pre>{`{
  "type": "points.snapshot",
  "points": {
    "p-supply-temp": 16.8,
    "p-unit-running": true
  }
}`}</pre>
            </div>
            <div>
              <span className="protocol-label">单点更新</span>
              <pre>{`{
  "type": "point.update",
  "id": "p-supply-temp",
  "value": 16.9
}`}</pre>
            </div>
            <div>
              <span className="protocol-label">控件写入</span>
              <pre>{`{
  "type": "point.write",
  "id": "p-fan-speed",
  "value": 42,
  "source": "HMI"
}`}</pre>
            </div>
          </div>
          <span className="protocol-note">
            兼容直接对象映射、snapshot 快照以及单点 update 三种消息格式。
          </span>
        </div>

        <div className="connection-log">
          <div className="connection-log-head">
            <span>
              <Radio size={12} />
              连接事件
            </span>
            <span>{events.length} 条</span>
          </div>
          <div className="connection-log-list">
            {events.map((event) => (
              <div className={`connection-log-row direction-${event.direction}`} key={event.id}>
                <span className="mono">{event.time}</span>
                <span className={`log-direction ${event.direction}`}>
                  {event.direction === 'in' ? 'IN' : event.direction === 'out' ? 'OUT' : 'SYS'}
                </span>
                <span>{event.message}</span>
              </div>
            ))}
            {!events.length && (
              <div className="connection-log-empty">
                <CheckCircle2 size={13} />
                连接事件会显示在这里
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
