import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Maximize2,
  MousePointerClick,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type {
  CanvasPage,
  ComponentType,
  ConnectionStatus,
  DataMode,
  GraphNode,
  PointDefinition,
  PointValue,
  Project,
  Selection,
} from '../types'
import { Canvas } from './Canvas'

interface PreviewModeProps {
  project: Project
  page: CanvasPage
  pages: CanvasPage[]
  points: Map<string, PointDefinition>
  status: ConnectionStatus
  mode: DataMode
  onExit: () => void
  onPageSelect: (pageId: string) => void
  onWrite: (pointId: string, value: PointValue, source: string) => void
}

const NOOP = () => undefined
const EMPTY_SELECTION: Selection = []

export function PreviewMode({
  project,
  page,
  pages,
  points,
  status,
  mode,
  onExit,
  onPageSelect,
  onWrite,
}: PreviewModeProps) {
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onExit])

  const time = clock.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const date = clock.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  })

  return (
    <div className="preview-shell hmi-runtime">
      <header className="preview-header hmi-runtime-header">
        <div className="preview-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 34 34">
              <path d="M17 2.5 30 10v14L17 31.5 4 24V10L17 2.5Z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".45" />
              <path d="M11.2 21.5 17 10l5.8 11.5M13.7 18.5h6.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span className="preview-eyebrow">AERON · RUNTIME</span>
            <h1>{project.site}</h1>
          </div>
          <span className="preview-live-pill">
            <span className={`live-dot ${status === 'connected' ? 'is-running' : 'is-demo'}`} />
            {status === 'connected' ? 'LIVE' : 'DEMO'}
          </span>
        </div>

        <nav className="runtime-page-tabs">
          {pages.map((item) => (
            <button
              key={item.id}
              className={page.id === item.id ? 'is-active' : ''}
              onClick={() => onPageSelect(item.id)}
            >
              {item.name}
            </button>
          ))}
        </nav>

        <div className="preview-head-center">
          <div className="preview-clock">
            <span className="mono">{time}</span>
            <small>{date}</small>
          </div>
          <span className={`runtime-connection ${status === 'connected' ? 'is-live' : 'is-demo'}`}>
            {status === 'connected' ? <Wifi size={13} /> : <WifiOff size={13} />}
            {status === 'connected' ? 'WebSocket 实时' : mode === 'demo' ? '演示数据' : '数据源离线'}
          </span>
        </div>

        <div className="preview-actions">
          <span className="runtime-hint">
            <MousePointerClick size={12} />
            互动控件可操作
          </span>
          <button
            className="preview-icon-button"
            title="全屏"
            aria-label="全屏"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else void document.documentElement.requestFullscreen()
            }}
          >
            <Maximize2 size={15} />
          </button>
          <button className="preview-exit" onClick={onExit}>
            <ArrowLeft size={14} />
            退出预览
          </button>
        </div>
      </header>

      <main className="runtime-stage">
        <Canvas
          page={page}
          points={points}
          tool={'select'}
          onToolChange={NOOP}
          selection={EMPTY_SELECTION}
          onSelectionChange={NOOP}
          onMoveNodes={NOOP}
          onResizeNode={NOOP}
          onDropComponent={(_type: ComponentType, _x: number, _y: number) => undefined}
          beginTransaction={NOOP}
          endTransaction={NOOP}
          onDeleteSelection={NOOP}
          onDuplicateSelection={NOOP}
          onUndo={NOOP}
          onRedo={NOOP}
          canUndo={false}
          canRedo={false}
          snapEnabled={false}
          onToggleSnap={NOOP}
          showGrid={false}
          onToggleGrid={NOOP}
          onWrite={onWrite}
          preview
        />
        <div className="runtime-page-caption">
          <span className="runtime-page-index">RUNNING</span>
          <strong>{page.name}</strong>
          <span>{page.subtitle}</span>
        </div>
      </main>

      <footer className="preview-footer runtime-footer">
        <span className="preview-footer-left">
          {status === 'connected' ? <Wifi size={12} /> : <Radio size={12} />}
          {status === 'connected' ? 'WebSocket 数据推送正常' : '本地演示数据 · 1.5s 刷新'}
          <span className="footer-sep" />
          点位 {points.size} 个
        </span>
        <span className="preview-footer-center">
          <span className={`live-dot ${status === 'connected' ? 'is-running' : 'is-demo'}`} />
          运行画面 · 控件写入已启用
        </span>
        <span className="preview-footer-right">
          <span>{project.version}</span>
          <span className="footer-sep" />
          <span>WebSocket HMI</span>
          <span className="footer-sep" />
          <span className="mono">{time}</span>
        </span>
      </footer>
    </div>
  )
}
