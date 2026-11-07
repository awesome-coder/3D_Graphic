import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Copy,
  Grid3X3,
  Hand,
  Lock,
  Magnet,
  Maximize,
  MousePointer2,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type {
  CanvasPage,
  ComponentType,
  GraphNode,
  PointDefinition,
  PointValue,
  Selection,
  ToolMode,
} from '../types'
import { clamp, getNodeBounds, GRID_SIZE, snap } from '../lib/graph'
import { COMPONENT_MAP } from '../data/components'
import { WidgetRenderer } from './WidgetRenderer'

interface CanvasProps {
  page: CanvasPage
  points: Map<string, PointDefinition>
  tool: ToolMode
  onToolChange: (tool: ToolMode) => void
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  onMoveNodes: (updates: Array<{ id: string; x: number; y: number }>) => void
  onResizeNode: (
    id: string,
    geometry: { x: number; y: number; w: number; h: number },
  ) => void
  onDropComponent: (type: ComponentType, x: number, y: number) => void
  beginTransaction: () => void
  endTransaction: () => void
  onDeleteSelection: () => void
  onDuplicateSelection: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  snapEnabled: boolean
  onToggleSnap: () => void
  showGrid: boolean
  onToggleGrid: () => void
  onWrite?: (pointId: string, value: PointValue, source: string) => void
  preview?: boolean
}

type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se'

const RESIZE_DIRECTIONS: ResizeDirection[] = ['nw', 'ne', 'sw', 'se']

export function Canvas({
  page,
  points,
  tool,
  onToolChange,
  selection,
  onSelectionChange,
  onMoveNodes,
  onResizeNode,
  onDropComponent,
  beginTransaction,
  endTransaction,
  onDeleteSelection,
  onDuplicateSelection,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  snapEnabled,
  onToggleSnap,
  showGrid,
  onToggleGrid,
  onWrite,
  preview = false,
}: CanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.86)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [marquee, setMarquee] = useState<{
    start: { x: number; y: number }
    current: { x: number; y: number }
    additive: boolean
  } | null>(null)
  const [dropHint, setDropHint] = useState<{ x: number; y: number } | null>(null)
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  zoomRef.current = zoom
  panRef.current = pan
  const userAdjustedView = useRef(false)
  const nodeMap = new Map(page.nodes.map((node) => [node.id, node]))
  const visibleNodes = page.nodes.filter((node) => !node.hidden)
  const boundCount = page.nodes.filter((node) => node.binding.pointId).length

  const fitView = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const nodes = page.nodes.filter((node) => !node.hidden)
    if (!nodes.length) {
      const emptyZoom = 0.86
      setZoom(emptyZoom)
      setPan({
        x: rect.width / 2 - 600 * emptyZoom,
        y: rect.height / 2 - 380 * emptyZoom,
      })
      userAdjustedView.current = false
      return
    }
    const bounds = getNodeBounds(nodes)
    const availableW = Math.max(300, rect.width - 80)
    const availableH = Math.max(220, rect.height - 94)
    const nextZoom = clamp(Math.min(availableW / bounds.w, availableH / bounds.h), 0.25, 1.4)
    setZoom(nextZoom)
    setPan({
      x: (rect.width - bounds.w * nextZoom) / 2 - bounds.x * nextZoom,
      y: (rect.height - bounds.h * nextZoom) / 2 - bounds.y * nextZoom,
    })
    userAdjustedView.current = false
  }, [page.nodes])

  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView

  useEffect(() => {
    setMarquee(null)
    onSelectionChange([])
    const frame = requestAnimationFrame(() => fitViewRef.current())
    return () => cancelAnimationFrame(frame)
    // Selection is reset only when another page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let width = viewport.clientWidth
    let height = viewport.clientHeight
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const nextWidth = Math.round(entry.contentRect.width)
      const nextHeight = Math.round(entry.contentRect.height)
      if (nextWidth === width && nextHeight === height) return
      width = nextWidth
      height = nextHeight
      if (!userAdjustedView.current) requestAnimationFrame(() => fitViewRef.current())
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      setIsSpaceDown(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    }
  }, [])

  const handleWheel = useCallback((event: WheelEvent) => {
    const viewport = viewportRef.current
    if (!viewport) return
    event.preventDefault()
    userAdjustedView.current = true
    const rect = viewport.getBoundingClientRect()
    const currentZoom = zoomRef.current
    const factor = Math.exp(-event.deltaY * 0.0014)
    const nextZoom = clamp(currentZoom * factor, 0.2, 2)
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top
    const worldX = (cursorX - panRef.current.x) / currentZoom
    const worldY = (cursorY - panRef.current.y) / currentZoom
    setZoom(nextZoom)
    setPan({ x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom })
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    userAdjustedView.current = true
    const rect = viewport.getBoundingClientRect()
    const currentZoom = zoomRef.current
    const nextZoom = clamp(currentZoom * factor, 0.2, 2)
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const worldX = (centerX - panRef.current.x) / currentZoom
    const worldY = (centerY - panRef.current.y) / currentZoom
    setZoom(nextZoom)
    setPan({ x: centerX - worldX * nextZoom, y: centerY - worldY * nextZoom })
  }

  const startPan = (clientX: number, clientY: number) => {
    userAdjustedView.current = true
    const origin = { ...panRef.current }
    setIsPanning(true)
    const onMove = (event: PointerEvent) => {
      setPan({
        x: origin.x + event.clientX - clientX,
        y: origin.y + event.clientY - clientY,
      })
    }
    const onUp = () => {
      setIsPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleViewportPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || tool === 'pan' || isSpaceDown) {
      event.preventDefault()
      startPan(event.clientX, event.clientY)
      return
    }
    if (event.button !== 0) return
    if (preview) return
    const additive = event.shiftKey
    if (!additive) onSelectionChange([])
    const start = clientToWorld(event.clientX, event.clientY)
    setMarquee({ start, current: start, additive })
    const onMove = (moveEvent: PointerEvent) => {
      const current = clientToWorld(moveEvent.clientX, moveEvent.clientY)
      setMarquee((previous) => (previous ? { ...previous, current } : previous))
    }
    const onUp = (upEvent: PointerEvent) => {
      const end = clientToWorld(upEvent.clientX, upEvent.clientY)
      const left = Math.min(start.x, end.x)
      const top = Math.min(start.y, end.y)
      const right = Math.max(start.x, end.x)
      const bottom = Math.max(start.y, end.y)
      const hit = page.nodes
        .filter(
          (node) =>
            !node.hidden &&
            node.x < right &&
            node.x + node.w > left &&
            node.y < bottom &&
            node.y + node.h > top,
        )
        .map((node) => node.id)
      if (hit.length || Math.abs(end.x - start.x) > 4 || Math.abs(end.y - start.y) > 4) {
        const previous = additive ? selection : []
        onSelectionChange(Array.from(new Set([...previous, ...hit])))
      }
      setMarquee(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleNodePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    node: GraphNode,
  ) => {
    if (event.button !== 0 || preview) return
    if (isSpaceDown || tool === 'pan') return
    if (event.target instanceof HTMLElement && event.target.closest('[data-resize]')) return
    event.stopPropagation()
    let nextIds = selection
    if (event.shiftKey) {
      nextIds = selection.includes(node.id)
        ? selection.filter((id) => id !== node.id)
        : [...selection, node.id]
      onSelectionChange(nextIds)
      return
    }
    if (!selection.includes(node.id)) {
      nextIds = [node.id]
      onSelectionChange(nextIds)
    }
    if (node.locked) return
    const ids = nextIds.filter((id) => {
      const item = nodeMap.get(id)
      return item && !item.locked
    })
    if (!ids.length) return
    beginTransaction()
    const origin = new Map(ids.map((id) => [id, { x: nodeMap.get(id)!.x, y: nodeMap.get(id)!.y }]))
    const startX = event.clientX
    const startY = event.clientY
    let moved = false
    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoomRef.current
      const dy = (moveEvent.clientY - startY) / zoomRef.current
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return
      moved = true
      onMoveNodes(
        ids.map((id) => {
          const initial = origin.get(id)!
          return {
            id,
            x: snap(initial.x + dx, snapEnabled),
            y: snap(initial.y + dy, snapEnabled),
          }
        }),
      )
    }
    const onUp = () => {
      endTransaction()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    node: GraphNode,
    direction: ResizeDirection,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    if (preview || node.locked) return
    beginTransaction()
    const startX = event.clientX
    const startY = event.clientY
    const initial = { x: node.x, y: node.y, w: node.w, h: node.h }
    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoomRef.current
      const dy = (moveEvent.clientY - startY) / zoomRef.current
      let nextX = initial.x
      let nextY = initial.y
      let nextW = initial.w
      let nextH = initial.h
      if (direction.includes('e')) nextW = initial.w + dx
      if (direction.includes('s')) nextH = initial.h + dy
      if (direction.includes('w')) {
        nextW = initial.w - dx
        nextX = initial.x + dx
      }
      if (direction.includes('n')) {
        nextH = initial.h - dy
        nextY = initial.y + dy
      }
      nextX = snap(nextX, snapEnabled)
      nextY = snap(nextY, snapEnabled)
      nextW = Math.max(32, snap(nextW, snapEnabled))
      nextH = Math.max(24, snap(nextH, snapEnabled))
      if (direction.includes('w') && nextW === 32) nextX = initial.x + initial.w - 32
      if (direction.includes('n') && nextH === 24) nextY = initial.y + initial.h - 24
      onResizeNode(node.id, {
        x: nextX,
        y: nextY,
        w: nextW,
        h: nextH,
      })
    }
    const onUp = () => {
      endTransaction()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDropHint(null)
    if (preview) return
    const type = event.dataTransfer.getData('application/x-aeron-component') as ComponentType
    if (!type || !COMPONENT_MAP.has(type)) return
    const definition = COMPONENT_MAP.get(type)!
    const world = clientToWorld(event.clientX, event.clientY)
    onDropComponent(type, world.x - definition.defaultW / 2, world.y - definition.defaultH / 2)
  }

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport tool-${tool} ${isSpaceDown ? 'space-down' : ''} ${
        isPanning ? 'is-panning' : ''
      } ${preview ? 'is-preview' : ''}`}
      style={{
        backgroundImage: showGrid
          ? 'radial-gradient(circle, rgba(122,156,185,.22) 1px, transparent 1.35px), linear-gradient(rgba(96,132,160,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(96,132,160,.035) 1px, transparent 1px)'
          : 'radial-gradient(ellipse at 50% 40%, rgba(42,113,127,.07), transparent 62%)',
        backgroundSize: showGrid
          ? `${GRID_SIZE * 4 * zoom}px ${GRID_SIZE * 4 * zoom}px, ${
              GRID_SIZE * 12 * zoom
            }px ${GRID_SIZE * 12 * zoom}px, ${GRID_SIZE * 12 * zoom}px ${GRID_SIZE * 12 * zoom}px`
          : 'auto',
        backgroundPosition: showGrid
          ? `${pan.x}px ${pan.y}px, ${pan.x}px ${pan.y}px, ${pan.x}px ${pan.y}px`
          : 'center',
      }}
      onPointerDown={handleViewportPointerDown}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('.graph-node, .canvas-toolbar, .zoom-control')) return
        fitView()
      }}
      onDragOver={(event) => {
        if (preview) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDropHint(clientToWorld(event.clientX, event.clientY))
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setDropHint(null)
      }}
      onDrop={handleDrop}
    >
      {!preview && (
        <div className="canvas-toolbar" onPointerDown={(event) => event.stopPropagation()}>
          <div className="toolbar-group">
            <button
              className={`tool-button ${tool === 'select' ? 'is-active' : ''}`}
              onClick={() => onToolChange('select')}
              title="选择工具 (V)"
              aria-label="选择工具"
            >
              <MousePointer2 size={15} />
            </button>
            <button
              className={`tool-button ${tool === 'pan' ? 'is-active' : ''}`}
              onClick={() => onToolChange('pan')}
              title="平移画布 (H / 空格)"
              aria-label="平移画布"
            >
              <Hand size={15} />
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="toolbar-group">
            <button className="tool-button" onClick={onUndo} disabled={!canUndo} title="撤销" aria-label="撤销">
              <Undo2 size={15} />
            </button>
            <button className="tool-button" onClick={onRedo} disabled={!canRedo} title="重做" aria-label="重做">
              <Redo2 size={15} />
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              className="tool-button"
              onClick={onDuplicateSelection}
              disabled={!selection.length}
              title="复制所选"
              aria-label="复制所选"
            >
              <Copy size={14} />
            </button>
            <button
              className="tool-button danger"
              onClick={onDeleteSelection}
              disabled={!selection.length}
              title="删除"
              aria-label="删除所选"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              className={`tool-button ${showGrid ? 'is-active' : ''}`}
              onClick={onToggleGrid}
              title="显示网格"
              aria-label="显示网格"
            >
              <Grid3X3 size={14} />
            </button>
            <button
              className={`tool-button ${snapEnabled ? 'is-active' : ''}`}
              onClick={onToggleSnap}
              title="对齐网格"
              aria-label="对齐网格"
            >
              <Magnet size={14} />
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="toolbar-context">
            <span className="live-dot is-running" />
            <span>编辑模式</span>
            <span className="toolbar-count">
              {page.nodes.length} 组件 · {boundCount} 已绑定
            </span>
          </div>
        </div>
      )}

      <div className="canvas-hint">
        {preview ? (
          <>
            <span>滚轮缩放</span>
            <span>拖拽画布平移</span>
            <span>操作控件可直接写回点位</span>
          </>
        ) : (
          <>
            <span>空格 + 拖拽平移</span>
            <span>滚轮缩放</span>
            <span>Shift 多选</span>
            <span>双击适应画布</span>
          </>
        )}
      </div>

      <div className="zoom-control" onPointerDown={(event) => event.stopPropagation()}>
        <button className="zoom-button" onClick={() => zoomBy(1 / 1.12)} aria-label="缩小" title="缩小">
          <ZoomOut size={14} />
        </button>
        <button className="zoom-value" onClick={fitView} title="适应画布">
          {Math.round(zoom * 100)}%
        </button>
        <button className="zoom-button" onClick={() => zoomBy(1.12)} aria-label="放大" title="放大">
          <ZoomIn size={14} />
        </button>
        <span className="zoom-divider" />
        <button className="zoom-button" onClick={fitView} aria-label="适应画布" title="适应画布">
          <Maximize size={14} />
        </button>
      </div>

      <div
        className="canvas-world"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {page.nodes.map((node, nodeIndex) => {
          if (node.hidden) return null
          const selected = selection.includes(node.id)
          const point = node.binding.pointId ? points.get(node.binding.pointId) : undefined
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              className={`graph-node ${selected ? 'is-selected' : ''} ${node.locked ? 'is-locked' : ''} ${
                preview ? 'is-preview' : ''
              }`}
              style={{
                left: node.x,
                top: node.y,
                width: node.w,
                height: node.h,
                transform: `rotate(${node.rotation}deg)`,
                zIndex: nodeIndex + 1,
              }}
              onPointerDown={(event) => handleNodePointerDown(event, node)}
            >
              <div
                className={`widget-root ${preview ? 'is-interactive' : ''}`}
                style={{ opacity: node.style.opacity }}
              >
                <WidgetRenderer node={node} point={point} interactive={preview} onWrite={onWrite} />
              </div>

              {!preview && (selected || node.locked) && (
                <span className="node-tag">
                  {node.tag}
                  {node.locked && <Lock size={9} />}
                </span>
              )}

              {!preview && selected && (
                <div className="selection-frame" aria-hidden="true">
                  <span className="selection-corner top-left" />
                  <span className="selection-corner top-right" />
                  <span className="selection-corner bottom-left" />
                  <span className="selection-corner bottom-right" />
                </div>
              )}

              {!preview &&
                selected &&
                !node.locked &&
                RESIZE_DIRECTIONS.map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    data-resize={direction}
                    className={`resize-handle resize-${direction}`}
                    onPointerDown={(event) => startResize(event, node, direction)}
                    aria-label={`从${direction}方向调整尺寸`}
                  />
                ))}
            </div>
          )
        })}

        {marquee && (
          <div
            className="marquee-selection"
            style={{
              left: Math.min(marquee.start.x, marquee.current.x),
              top: Math.min(marquee.start.y, marquee.current.y),
              width: Math.abs(marquee.current.x - marquee.start.x),
              height: Math.abs(marquee.current.y - marquee.start.y),
            }}
          />
        )}

        {dropHint && (
          <div
            className="drop-hint"
            style={{ left: dropHint.x - 80, top: dropHint.y - 50, width: 160, height: 100 }}
          >
            <span>放置组件</span>
          </div>
        )}
      </div>

      {visibleNodes.length === 0 && (
        <div className="canvas-empty-state">
          <div className="empty-glyph">
            <Grid3X3 size={18} />
          </div>
          <h3>从组件库开始组态</h3>
          <p>拖入图形、文字、数据展示或交互控件，并在右侧绑定实时点位。</p>
          <span>支持按钮、滑块、下拉框等写入控件</span>
        </div>
      )}
    </div>
  )
}
