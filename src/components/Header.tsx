import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Cloud,
  Download,
  Eye,
  FileJson,
  Keyboard,
  MoreHorizontal,
  Plus,
  Radio,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type { CanvasPage, ConnectionStatus, DataMode, Project } from '../types'

interface HeaderProps {
  project: Project
  pages: CanvasPage[]
  activePageId: string
  lastSavedLabel: string
  status: ConnectionStatus
  mode: DataMode
  onPageSelect: (pageId: string) => void
  onAddPage: () => void
  onOpenConnection: () => void
  onPreview: () => void
  onSave: () => void
  onExport: () => void
  onImport: (text: string) => void
  onShowShortcuts: () => void
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 34 34">
        <path d="M17 2.5 30 10v14L17 31.5 4 24V10L17 2.5Z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".45" />
        <path d="M17 8 24.5 12v8.5L17 25l-7.5-4.5V12L17 8Z" fill="currentColor" opacity=".1" />
        <path d="M11.2 21.5 17 10l5.8 11.5M13.7 18.5h6.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function connectionDisplay(status: ConnectionStatus, mode: DataMode) {
  if (status === 'connected') return { label: 'WebSocket 已连接', caption: '实时点位', tone: 'is-connected', icon: Wifi }
  if (status === 'connecting') return { label: '正在连接', caption: '请稍候', tone: 'is-connecting', icon: Radio }
  if (status === 'error') return { label: '连接异常', caption: '点击检查', tone: 'is-error', icon: WifiOff }
  if (status === 'disconnected') return { label: 'WebSocket 已断开', caption: '演示已暂停', tone: 'is-error', icon: WifiOff }
  if (mode === 'live') return { label: '实时模式', caption: '等待连接', tone: 'is-demo', icon: Radio }
  return { label: '演示数据', caption: '未连接 WS', tone: 'is-demo', icon: Radio }
}

export function Header({
  project,
  pages,
  activePageId,
  lastSavedLabel,
  status,
  mode,
  onPageSelect,
  onAddPage,
  onOpenConnection,
  onPreview,
  onSave,
  onExport,
  onImport,
  onShowShortcuts,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const connection = connectionDisplay(status, mode)
  const ConnectionIcon = connection.icon

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    onImport(await file.text())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const time = clock.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const date = clock.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' })

  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <div className="brand-text">
          <div className="brand-name">
            AERON<span>HMI</span>
          </div>
          <div className="brand-subtitle">工业组态 · 可视化中心</div>
        </div>
        <span className="brand-divider" />
        <div className="project-crumb">
          <span className="crumb-muted">项目</span>
          <span className="crumb-slash">/</span>
          <span className="crumb-current">{project.site}</span>
          <span className="environment-pill">ONLINE</span>
        </div>
      </div>

      <nav className="page-tabs" aria-label="组态页面">
        {pages.map((page, index) => (
          <button
            key={page.id}
            className={`page-tab ${activePageId === page.id ? 'is-active' : ''}`}
            onClick={() => onPageSelect(page.id)}
            title={page.subtitle}
          >
            <span className="page-tab-index">{String(index + 1).padStart(2, '0')}</span>
            <span>{page.name}</span>
          </button>
        ))}
        <button className="page-add" onClick={onAddPage} title="新建组态页面" aria-label="新建组态页面">
          <Plus size={14} />
        </button>
      </nav>

      <div className="header-actions">
        <div className="header-clock" title={date}>
          <span className="clock-time mono">{time}</span>
          <span className="clock-date">{date}</span>
        </div>

        <button
          className={`connection-chip ${connection.tone}`}
          onClick={onOpenConnection}
          title="配置 WebSocket 数据源"
        >
          <span className="connection-chip-icon">
            <ConnectionIcon size={14} />
          </span>
          <span className="connection-chip-copy">
            <strong>{connection.label}</strong>
            <small>{connection.caption}</small>
          </span>
          <ChevronDown size={11} />
        </button>

        <button className="ghost-button preview-button" onClick={onPreview} title="运行预览 (P)">
          <Eye size={14} />
          预览
        </button>

        <button
          className="icon-button save-button"
          onClick={onSave}
          title={`${lastSavedLabel} · 保存项目 (Ctrl+S)`}
          aria-label="立即保存"
        >
          <Cloud size={15} />
        </button>

        <div className="header-menu-wrap" ref={menuRef}>
          <button
            className="icon-button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="项目菜单"
            title="项目菜单"
          >
            <MoreHorizontal size={16} />
            <ChevronDown size={10} className="menu-chevron" />
          </button>
          {menuOpen && (
            <div className="header-dropdown">
              <span className="dropdown-eyebrow">PROJECT</span>
              <button
                onClick={() => {
                  onExport()
                  setMenuOpen(false)
                }}
              >
                <Download size={14} />
                导出项目 JSON
                <span>⌘E</span>
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click()
                  setMenuOpen(false)
                }}
              >
                <Upload size={14} />
                导入项目文件
              </button>
              <button
                onClick={() => {
                  onShowShortcuts()
                  setMenuOpen(false)
                }}
              >
                <Keyboard size={14} />
                键盘快捷键
                <span>?</span>
              </button>
              <span className="dropdown-separator" />
              <button
                onClick={() => {
                  onSave()
                  setMenuOpen(false)
                }}
              >
                <FileJson size={14} />
                保存快照
                <span>⌘S</span>
              </button>
              <div className="dropdown-meta">
                {status === 'connected' ? <Wifi size={12} /> : <Radio size={12} />}
                {status === 'connected' ? 'WebSocket 数据源已接入' : '当前使用本地演示数据'}
              </div>
            </div>
          )}
        </div>

        <div className="user-avatar" title="李工 · 组态工程师">
          LQ
          <span />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden-file-input"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </header>
  )
}
