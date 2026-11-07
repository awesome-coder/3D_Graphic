import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Cloud,
  Command,
  Database,
  Keyboard,
  Layers3,
  Radio,
  ServerCog,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import type {
  CanvasPage,
  ComponentType,
  GraphNode,
  InspectorTab,
  LibraryTab,
  NodeBinding,
  PointDefinition,
  PointValue,
  Project,
  Selection,
  ToolMode,
  WriteLog,
} from './types'
import { buildInitialProject } from './data/initialProject'
import { COMPONENT_MAP, createGraphNode, DEFAULT_STYLE } from './data/components'
import {
  getNodeBounds,
  nowTimeLabel,
  uid,
  valueLabel,
} from './lib/graph'
import { createImageStatesForPoint } from './lib/imageRules'
import { useLiveData } from './hooks/useLiveData'
import { Header } from './components/Header'
import { LibraryPanel } from './components/LibraryPanel'
import { Canvas } from './components/Canvas'
import { Inspector } from './components/Inspector'
import { BottomPanel, type BottomTab } from './components/BottomPanel'
import { PreviewMode } from './components/PreviewMode'
import { ConnectionModal } from './components/ConnectionModal'

const STORAGE_KEY = 'aeron-hmi-project-v2'
const EMPTY_SELECTION: Selection = []

function loadProject(): Project {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildInitialProject()
    const parsed = JSON.parse(raw) as Partial<Project>
    if (parsed.schema !== 2 || !Array.isArray(parsed.pages) || !parsed.pages.length) {
      return buildInitialProject()
    }
    const fallback = buildInitialProject()
    return {
      ...fallback,
      ...parsed,
      schema: 2,
      pages: parsed.pages,
      points:
        Array.isArray(parsed.points) && parsed.points.length ? parsed.points : fallback.points,
    } as Project
  } catch {
    return buildInitialProject()
  }
}

function normalizeImportedProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('文件内容不是有效的项目对象')
  const raw = value as Partial<Project>
  if (!Array.isArray(raw.pages) || !raw.pages.length) throw new Error('项目缺少页面数据')
  if (!Array.isArray(raw.points) || !raw.points.length) throw new Error('项目缺少点位数据')
  const pages: CanvasPage[] = raw.pages.map((page, pageIndex) => {
    if (!page || !Array.isArray(page.nodes)) {
      throw new Error(`第 ${pageIndex + 1} 个页面数据结构不完整`)
    }
    const nodes: GraphNode[] = page.nodes
      .filter((node) => node && COMPONENT_MAP.has(node.type))
      .map((node) => ({
        ...node,
        id: node.id || uid('node'),
        tag: node.tag || 'NODE',
        label: node.label || '组件',
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
        w: Math.max(32, Number(node.w) || 80),
        h: Math.max(24, Number(node.h) || 40),
        rotation: Number(node.rotation) || 0,
        style: { ...DEFAULT_STYLE, ...node.style },
        props: node.props ?? {},
        binding: node.binding ?? { pointId: null, mode: 'value' },
      }))
    return {
      id: page.id || uid('page'),
      name: page.name || `页面 ${pageIndex + 1}`,
      subtitle: page.subtitle || '',
      nodes,
    }
  })
  const points: PointDefinition[] = raw.points.map((point) => ({
    ...point,
    value: point.value ?? 0,
    min: Number(point.min) || 0,
    max: Number(point.max) || 100,
    precision: Number(point.precision) || 0,
    writable: Boolean(point.writable),
    quality: point.quality || 'good',
    history: Array.isArray(point.history) ? point.history : [],
  }))
  const project: Project = {
    schema: 2,
    name: raw.name || '导入的组态项目',
    site: raw.site || '未命名站点',
    version: raw.version || 'v1.0.0',
    updatedAt: new Date().toISOString(),
    pages,
    points,
  }
  for (const page of project.pages) {
    for (const node of page.nodes) {
      if (node.type !== 'image') continue
      const point = project.points.find((item) => item.id === node.binding.pointId)
      const previous =
        node.props.imageStates?.length
          ? node.props.imageStates
          : node.props.imageUrl
            ? [
                {
                  id: uid('img'),
                  label: '默认图片',
                  url: node.props.imageUrl,
                },
              ]
            : []
      node.props = {
        ...node.props,
        objectFit: node.props.objectFit ?? 'contain',
        imageStates: createImageStatesForPoint(point, previous),
      }
    }
  }
  return project
}

function findFreePosition(nodes: GraphNode[], width: number, height: number) {
  const bounds = getNodeBounds(nodes)
  const centerX = bounds.x + bounds.w / 2 - width / 2
  const centerY = bounds.y + bounds.h / 2 - height / 2
  const padding = 18
  const isFree = (x: number, y: number) =>
    nodes.every(
      (node) =>
        x + width + padding < node.x ||
        x > node.x + node.w + padding ||
        y + height + padding < node.y ||
        y > node.y + node.h + padding,
    )
  const minX = bounds.x + 24
  const maxX = Math.max(minX, bounds.x + bounds.w - width - 24)
  const minY = bounds.y + 76
  const maxY = Math.max(minY, bounds.y + bounds.h - height - 24)
  for (const radius of [0, 64, 128, 192, 256, 320, 384, 448, 512]) {
    const steps = radius === 0 ? 1 : 12
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2
      const x = Math.round(Math.min(maxX, Math.max(minX, centerX + Math.cos(angle) * radius)))
      const y = Math.round(Math.min(maxY, Math.max(minY, centerY + Math.sin(angle) * radius)))
      if (isFree(x, y)) return { x, y }
    }
  }
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, centerX))),
    y: Math.round(Math.min(maxY, Math.max(minY, centerY))),
  }
}

interface Toast {
  id: string
  message: string
  detail?: string
  tone: 'success' | 'warning' | 'error'
}

export default function App() {
  const [project, setProject] = useState<Project>(loadProject)
  const projectRef = useRef(project)
  projectRef.current = project
  const live = useLiveData(project.points)
  const livePointsRef = useRef(live.points)
  livePointsRef.current = live.points
  const [activePageId, setActivePageId] = useState(project.pages[0]?.id ?? '')
  const activePageIdRef = useRef(activePageId)
  activePageIdRef.current = activePageId
  const [selection, setSelection] = useState<Selection>([])
  const [tool, setTool] = useState<ToolMode>('select')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('properties')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('components')
  const [bottomTab, setBottomTab] = useState<BottomTab>('points')
  const [bottomCollapsed, setBottomCollapsed] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [undoStack, setUndoStack] = useState<Array<{ pages: CanvasPage[]; activePageId: string }>>([])
  const [redoStack, setRedoStack] = useState<Array<{ pages: CanvasPage[]; activePageId: string }>>([])
  const transactionRef = useRef<{ pages: CanvasPage[]; activePageId: string } | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [writeLogs, setWriteLogs] = useState<WriteLog[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastTimers = useRef<number[]>([])
  const [lastSavedLabel, setLastSavedLabel] = useState('已自动保存')
  const [savePulse, setSavePulse] = useState(false)
  const [focusedPointId, setFocusedPointId] = useState<string | null>(null)
  const previousStatus = useRef(live.status)

  const activePage = project.pages.find((page) => page.id === activePageId) ?? project.pages[0]
  const selectedNodes = useMemo(
    () => (activePage ? activePage.nodes.filter((node) => selection.includes(node.id)) : []),
    [activePage, selection],
  )
  const pointMap = live.pointMap
  const bindingCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const page of project.pages) {
      for (const node of page.nodes) {
        if (node.binding.pointId) {
          counts[node.binding.pointId] = (counts[node.binding.pointId] ?? 0) + 1
        }
      }
    }
    return counts
  }, [project.pages])

  const showToast = useCallback(
    (message: string, detail?: string, tone: Toast['tone'] = 'success') => {
      const id = uid('toast')
      setToasts((previous) => [...previous.slice(-2), { id, message, detail, tone }])
      const timer = window.setTimeout(() => {
        setToasts((previous) => previous.filter((toast) => toast.id !== id))
      }, 3200)
      toastTimers.current.push(timer)
    },
    [],
  )

  useEffect(() => {
    return () => toastTimers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const snapshotForUndo = useCallback(() => {
    const snapshot = {
      pages: structuredClone(projectRef.current.pages),
      activePageId: activePageIdRef.current,
    }
    setUndoStack((previous) => [...previous.slice(-39), snapshot])
    setRedoStack([])
  }, [])

  const commitPages = useCallback(
    (updater: (pages: CanvasPage[]) => CanvasPage[], recordHistory = true) => {
      if (recordHistory) snapshotForUndo()
      setProject((previous) => {
        const pages = updater(previous.pages)
        if (pages === previous.pages) return previous
        return { ...previous, pages, updatedAt: new Date().toISOString() }
      })
    },
    [snapshotForUndo],
  )

  const saveNow = useCallback(
    (notify = false) => {
      try {
        const snapshot: Project = {
          ...projectRef.current,
          points: livePointsRef.current,
          updatedAt: new Date().toISOString(),
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
        setLastSavedLabel(`已保存 ${nowTimeLabel(false)}`)
        setSavePulse(true)
        window.setTimeout(() => setSavePulse(false), 600)
        if (notify) showToast('项目已保存', '页面、组件与点位绑定已写入本地工作区。')
      } catch {
        showToast('保存失败', '本地存储不可用或空间不足。', 'error')
      }
    },
    [showToast],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => saveNow(false), 1200)
    return () => window.clearTimeout(timer)
  }, [project, saveNow])

  useEffect(() => {
    const handler = () => saveNow(false)
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveNow])

  useEffect(() => {
    if (live.status === previousStatus.current) return
    const previous = previousStatus.current
    previousStatus.current = live.status
    if (live.status === 'connected') {
      showToast('WebSocket 已连接', '实时点位开始推送，组态将自动更新。')
    } else if (live.status === 'error') {
      showToast('数据源连接失败', live.lastError ?? '请检查 WebSocket 地址与服务状态。', 'error')
    } else if (live.status === 'disconnected' && previous === 'connected') {
      showToast('WebSocket 连接已断开', '数据更新已暂停，可切换到本地演示数据。', 'warning')
    }
  }, [live.lastError, live.status, showToast])

  const handleSelectionChange = useCallback((next: Selection) => {
    setSelection(next)
  }, [])

  const handlePageSelect = useCallback((pageId: string) => {
    setActivePageId(pageId)
    setSelection(EMPTY_SELECTION)
    setInspectorTab('properties')
  }, [])

  const handleAddNode = useCallback(
    (type: ComponentType, x?: number, y?: number) => {
      const page = projectRef.current.pages.find((item) => item.id === activePageIdRef.current)
      if (!page) return
      const definition = COMPONENT_MAP.get(type)
      if (!definition) return
      let nextX = x
      let nextY = y
      if (nextX === undefined || nextY === undefined) {
        const free = findFreePosition(page.nodes, definition.defaultW, definition.defaultH)
        nextX = free.x
        nextY = free.y
      }
      const node = createGraphNode(type, Math.round(nextX), Math.round(nextY), page.nodes)
      snapshotForUndo()
      setProject((previous) => ({
        ...previous,
        updatedAt: new Date().toISOString(),
        pages: previous.pages.map((item) =>
          item.id === activePageIdRef.current ? { ...item, nodes: [...item.nodes, node] } : item,
        ),
      }))
      setSelection([node.id])
      setInspectorTab('properties')
      showToast('已添加组件', `${node.label} · 拖拽调整位置，右侧可配置属性。`)
    },
    [showToast, snapshotForUndo],
  )

  const handleMoveNodes = useCallback((updates: Array<{ id: string; x: number; y: number }>) => {
    const positionMap = new Map(updates.map((item) => [item.id, item]))
    setProject((previous) => ({
      ...previous,
      pages: previous.pages.map((page) =>
        page.id === activePageIdRef.current
          ? {
              ...page,
              nodes: page.nodes.map((node) => {
                const position = positionMap.get(node.id)
                return position ? { ...node, x: position.x, y: position.y } : node
              }),
            }
          : page,
      ),
    }))
  }, [])

  const handleResizeNode = useCallback(
    (id: string, geometry: { x: number; y: number; w: number; h: number }) => {
      setProject((previous) => ({
        ...previous,
        pages: previous.pages.map((page) =>
          page.id === activePageIdRef.current
            ? {
                ...page,
                nodes: page.nodes.map((node) => (node.id === id ? { ...node, ...geometry } : node)),
              }
            : page,
        ),
      }))
    },
    [],
  )

  const beginTransaction = useCallback(() => {
    if (transactionRef.current) return
    transactionRef.current = {
      pages: structuredClone(projectRef.current.pages),
      activePageId: activePageIdRef.current,
    }
  }, [])

  const endTransaction = useCallback(() => {
    const snapshot = transactionRef.current
    transactionRef.current = null
    if (!snapshot) return
    window.setTimeout(() => {
      if (JSON.stringify(snapshot.pages) !== JSON.stringify(projectRef.current.pages)) {
        setUndoStack((previous) => [...previous.slice(-39), snapshot])
        setRedoStack([])
      }
    }, 0)
  }, [])

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<GraphNode>) => {
      snapshotForUndo()
      setProject((previous) => ({
        ...previous,
        updatedAt: new Date().toISOString(),
        pages: previous.pages.map((page) =>
          page.id === activePageIdRef.current
            ? {
                ...page,
                nodes: page.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
              }
            : page,
        ),
      }))
    },
    [snapshotForUndo],
  )

  const handleUpdatePage = useCallback(
    (patch: Partial<CanvasPage>) => {
      snapshotForUndo()
      setProject((previous) => ({
        ...previous,
        updatedAt: new Date().toISOString(),
        pages: previous.pages.map((page) =>
          page.id === activePageIdRef.current ? { ...page, ...patch } : page,
        ),
      }))
    },
    [snapshotForUndo],
  )

  const handleBind = useCallback(
    (nodeId: string, pointId: string | null, mode?: NodeBinding['mode']) => {
      const node = projectRef.current.pages
        .flatMap((page) => page.nodes)
        .find((item) => item.id === nodeId)
      if (!node) return
      const point = pointId ? live.points.find((item) => item.id === pointId) : null
      let nextMode = mode ?? node.binding.mode
      if (
        pointId &&
        ['rect', 'ellipse', 'panel', 'line'].includes(node.type) &&
        nextMode === 'value'
      ) {
        nextMode = 'visibility'
      }
      const nextProps =
        node.type === 'image'
          ? {
              ...node.props,
              imageStates: createImageStatesForPoint(point, node.props.imageStates),
            }
          : node.props
      snapshotForUndo()
      setProject((previous) => ({
        ...previous,
        updatedAt: new Date().toISOString(),
        pages: previous.pages.map((page) =>
          page.id === activePageIdRef.current
            ? {
                ...page,
                nodes: page.nodes.map((item) =>
                  item.id === nodeId
                    ? {
                        ...item,
                        binding: { pointId, mode: nextMode },
                        ...(node.type === 'image' ? { props: nextProps } : {}),
                      }
                    : item,
                ),
              }
            : page,
        ),
      }))
      if (point) {
        const isControl = ['button', 'switch', 'slider', 'select', 'number'].includes(node.type)
        if (isControl && !point.writable) {
          showToast('点位不可写', `${point.name} 是只读点位，控件写入将被拒绝。`, 'warning')
        } else {
          showToast(
            '点位绑定成功',
            `${node.label} → ${point.device} · ${point.name}`,
          )
        }
      } else {
        showToast('已解除点位绑定', `${node.label} 将不再随数据更新。`)
      }
    },
    [live.points, showToast, snapshotForUndo],
  )

  const handleWrite = useCallback(
    (pointId: string, value: PointValue, source: string) => {
      const point = live.points.find((item) => item.id === pointId)
      if (!point) return
      if (!point.writable) {
        showToast('写入被拒绝', `${point.name} 未标记为可写点位。`, 'warning')
        return
      }
      const success = live.writePoint(pointId, value, source)
      const transport = live.mode === 'live' ? 'websocket' : 'demo'
      const log: WriteLog = {
        id: uid('write'),
        time: nowTimeLabel(),
        pointId,
        pointName: point.name,
        valueLabel: valueLabel(point, value),
        source,
        transport,
        status: !success ? 'error' : transport === 'websocket' ? 'sent' : 'local',
      }
      setWriteLogs((previous) => [log, ...previous].slice(0, 120))
      setBottomTab('writes')
      setBottomCollapsed(false)
      if (success) {
        showToast(
          '点位写入成功',
          `${point.name} → ${log.valueLabel} · ${transport === 'websocket' ? 'WebSocket' : '本地演示'}`,
        )
      } else {
        showToast('点位写入失败', 'WebSocket 尚未连接，可在顶部切换演示或重新连接。', 'error')
      }
    },
    [live, showToast],
  )

  const handleDeleteSelection = useCallback(() => {
    if (!activePage || !selection.length) return
    const ids = new Set(selection)
    snapshotForUndo()
    setProject((previous) => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      pages: previous.pages.map((page) =>
        page.id === activePage.id
          ? { ...page, nodes: page.nodes.filter((node) => !ids.has(node.id)) }
          : page,
      ),
    }))
    setSelection([])
    showToast('已删除所选组件', `共移除 ${ids.size} 个组件。`)
  }, [activePage, selection, showToast, snapshotForUndo])

  const handleDuplicateSelection = useCallback(() => {
    if (!activePage || !selection.length) return
    const selected = activePage.nodes.filter((node) => selection.includes(node.id))
    if (!selected.length) return
    let existing = [...activePage.nodes]
    const clones = selected.map((node) => {
      const template = createGraphNode(node.type, node.x + 24, node.y + 24, existing)
      const clone: GraphNode = {
        ...structuredClone(node),
        id: uid('node'),
        tag: template.tag,
        x: node.x + 24,
        y: node.y + 24,
        locked: false,
      }
      existing = [...existing, clone]
      return clone
    })
    const cloneIds = clones.map((node) => node.id)
    snapshotForUndo()
    setProject((previous) => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      pages: previous.pages.map((page) =>
        page.id === activePage.id ? { ...page, nodes: [...page.nodes, ...clones] } : page,
      ),
    }))
    setSelection(cloneIds)
    showToast('已复制组件', `共 ${clones.length} 个组件，位置偏移 24 px。`)
  }, [activePage, selection, showToast, snapshotForUndo])

  const handleAlign = useCallback(
    (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
      if (!activePage || selectedNodes.length < 2) return
      const left = Math.min(...selectedNodes.map((node) => node.x))
      const right = Math.max(...selectedNodes.map((node) => node.x + node.w))
      const top = Math.min(...selectedNodes.map((node) => node.y))
      const bottom = Math.max(...selectedNodes.map((node) => node.y + node.h))
      const ids = new Set(selectedNodes.map((node) => node.id))
      snapshotForUndo()
      setProject((previous) => ({
        ...previous,
        updatedAt: new Date().toISOString(),
        pages: previous.pages.map((page) =>
          page.id === activePage.id
            ? {
                ...page,
                nodes: page.nodes.map((node) => {
                  if (!ids.has(node.id)) return node
                  switch (mode) {
                    case 'left':
                      return { ...node, x: left }
                    case 'hcenter':
                      return { ...node, x: Math.round((left + right) / 2 - node.w / 2) }
                    case 'right':
                      return { ...node, x: right - node.w }
                    case 'top':
                      return { ...node, y: top }
                    case 'vcenter':
                      return { ...node, y: Math.round((top + bottom) / 2 - node.h / 2) }
                    case 'bottom':
                      return { ...node, y: bottom - node.h }
                  }
                }),
              }
            : page,
        ),
      }))
    },
    [activePage, selectedNodes, snapshotForUndo],
  )

  const handleBringForward = useCallback(() => {
    if (!activePage || selectedNodes.length !== 1) return
    const id = selectedNodes[0].id
    const index = activePage.nodes.findIndex((node) => node.id === id)
    if (index < 0 || index >= activePage.nodes.length - 1) return
    snapshotForUndo()
    setProject((previous) => ({
      ...previous,
      pages: previous.pages.map((page) => {
        if (page.id !== activePage.id) return page
        const nodes = [...page.nodes]
        const [item] = nodes.splice(index, 1)
        nodes.splice(index + 1, 0, item)
        return { ...page, nodes }
      }),
    }))
  }, [activePage, selectedNodes, snapshotForUndo])

  const handleSendBackward = useCallback(() => {
    if (!activePage || selectedNodes.length !== 1) return
    const id = selectedNodes[0].id
    const index = activePage.nodes.findIndex((node) => node.id === id)
    if (index <= 0) return
    snapshotForUndo()
    setProject((previous) => ({
      ...previous,
      pages: previous.pages.map((page) => {
        if (page.id !== activePage.id) return page
        const nodes = [...page.nodes]
        const [item] = nodes.splice(index, 1)
        nodes.splice(index - 1, 0, item)
        return { ...page, nodes }
      }),
    }))
  }, [activePage, selectedNodes, snapshotForUndo])

  const handleUndo = useCallback(() => {
    if (!undoStack.length) return
    const entry = undoStack[undoStack.length - 1]
    const current = {
      pages: structuredClone(projectRef.current.pages),
      activePageId: activePageIdRef.current,
    }
    setUndoStack((previous) => previous.slice(0, -1))
    setRedoStack((previous) => [...previous.slice(-39), current])
    setProject((previous) => ({ ...previous, pages: structuredClone(entry.pages) }))
    setActivePageId(
      entry.pages.some((page) => page.id === entry.activePageId)
        ? entry.activePageId
        : entry.pages[0]?.id ?? '',
    )
    setSelection([])
  }, [undoStack])

  const handleRedo = useCallback(() => {
    if (!redoStack.length) return
    const entry = redoStack[redoStack.length - 1]
    const current = {
      pages: structuredClone(projectRef.current.pages),
      activePageId: activePageIdRef.current,
    }
    setRedoStack((previous) => previous.slice(0, -1))
    setUndoStack((previous) => [...previous.slice(-39), current])
    setProject((previous) => ({ ...previous, pages: structuredClone(entry.pages) }))
    setActivePageId(
      entry.pages.some((page) => page.id === entry.activePageId)
        ? entry.activePageId
        : entry.pages[0]?.id ?? '',
    )
    setSelection([])
  }, [redoStack])

  const handleAddPage = useCallback(() => {
    const index = projectRef.current.pages.length + 1
    const page: CanvasPage = {
      id: uid('page'),
      name: `新页面 ${index}`,
      subtitle: '自定义监控画面',
      nodes: [],
    }
    snapshotForUndo()
    setProject((previous) => ({
      ...previous,
      updatedAt: new Date().toISOString(),
      pages: [...previous.pages, page],
    }))
    setActivePageId(page.id)
    setSelection([])
    setInspectorTab('properties')
    showToast('已新建页面', '从左侧拖入图形或控件开始组态。')
  }, [showToast, snapshotForUndo])

  const handleNudge = useCallback(
    (dx: number, dy: number) => {
      if (!selection.length) return
      snapshotForUndo()
      const ids = new Set(selection)
      setProject((previous) => ({
        ...previous,
        pages: previous.pages.map((page) =>
          page.id === activePageIdRef.current
            ? {
                ...page,
                nodes: page.nodes.map((node) =>
                  ids.has(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node,
                ),
              }
            : page,
        ),
      }))
    },
    [selection, snapshotForUndo],
  )

  const handleExport = useCallback(() => {
    const snapshot: Project = {
      ...projectRef.current,
      points: livePointsRef.current,
      updatedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `aeron-hmi-${snapshot.site}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    showToast('项目已导出', '页面、组件、点位与绑定关系已打包为 JSON。')
  }, [showToast])

  const handleImport = useCallback(
    (text: string) => {
      try {
        const imported = normalizeImportedProject(JSON.parse(text))
        setProject(imported)
        live.resetPoints(imported.points)
        setActivePageId(imported.pages[0].id)
        setSelection([])
        setUndoStack([])
        setRedoStack([])
        setInspectorTab('properties')
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(imported))
        setLastSavedLabel('已保存')
        showToast('项目导入成功', `${imported.pages.length} 个页面 · ${imported.points.length} 个点位。`)
      } catch (error) {
        showToast(
          '导入失败',
          error instanceof Error ? error.message : '项目文件格式不正确。',
          'error',
        )
      }
    },
    [live, showToast],
  )

  const copyWsCommand = useCallback(() => {
    navigator.clipboard
      ?.writeText('npm run ws')
      .then(() => showToast('命令已复制', '在项目目录运行 npm run ws 启动本地 WebSocket 服务。'))
      .catch(() => showToast('复制失败', '请手动运行 npm run ws。', 'warning'))
  }, [showToast])

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (connectionOpen) {
          setConnectionOpen(false)
          return
        }
        if (shortcutsOpen) {
          setShortcutsOpen(false)
          return
        }
        if (previewMode) {
          setPreviewMode(false)
          return
        }
        setSelection([])
        return
      }
      if (isTypingTarget(event.target)) return
      if (previewMode) return
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) handleRedo()
        else handleUndo()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        handleRedo()
        return
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveNow(true)
        return
      }
      if (meta && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        handleExport()
        return
      }
      if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        handleDuplicateSelection()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        handleDeleteSelection()
        return
      }
      if (event.key === '?') {
        setShortcutsOpen(true)
        return
      }
      if (event.key.toLowerCase() === 'p') {
        setPreviewMode(true)
        setSelection([])
        return
      }
      if (!meta && event.key.toLowerCase() === 'v') {
        setTool('select')
        return
      }
      if (!meta && event.key.toLowerCase() === 'h') {
        setTool('pan')
        return
      }
      if (event.key.startsWith('Arrow') && selection.length) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 2
        if (event.key === 'ArrowLeft') handleNudge(-step, 0)
        if (event.key === 'ArrowRight') handleNudge(step, 0)
        if (event.key === 'ArrowUp') handleNudge(0, -step)
        if (event.key === 'ArrowDown') handleNudge(0, step)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    connectionOpen,
    handleDeleteSelection,
    handleDuplicateSelection,
    handleExport,
    handleNudge,
    handleRedo,
    handleUndo,
    previewMode,
    saveNow,
    selection.length,
    shortcutsOpen,
  ])

  if (!activePage) {
    return <div className="fatal-error">项目数据不可用，请刷新页面或重新导入项目文件。</div>
  }

  const selectedCount = selection.length
  const connected = live.status === 'connected'
  const sourceLabel =
    live.status === 'connected'
      ? 'WebSocket 实时数据'
      : live.status === 'connecting'
        ? '正在连接…'
        : live.status === 'error'
          ? '连接异常'
          : live.status === 'disconnected'
            ? '连接已断开'
            : '本地演示数据'

  return (
    <div className="app-shell">
      <Header
        project={project}
        pages={project.pages}
        activePageId={activePage.id}
        lastSavedLabel={lastSavedLabel}
        status={live.status}
        mode={live.mode}
        onPageSelect={handlePageSelect}
        onAddPage={handleAddPage}
        onOpenConnection={() => setConnectionOpen(true)}
        onPreview={() => {
          setPreviewMode(true)
          setSelection([])
        }}
        onSave={() => saveNow(true)}
        onExport={handleExport}
        onImport={handleImport}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />

      <div className="studio-body">
        <LibraryPanel
          points={live.points}
          selection={selection}
          status={live.status}
          mode={live.mode}
          libraryTab={libraryTab}
          onLibraryTabChange={setLibraryTab}
          onAddComponent={(type) => handleAddNode(type)}
          onSelectPoint={(pointId) => {
            setFocusedPointId(pointId)
            setBottomTab('points')
            setBottomCollapsed(false)
          }}
          onQuickBind={(pointId) => {
            if (selectedNodes.length !== 1) {
              showToast('请先选择一个组件', '在画布中选中组件，再使用点位快速绑定。', 'warning')
              return
            }
            handleBind(selectedNodes[0].id, pointId)
            setInspectorTab('data')
          }}
        />

        <div className="canvas-column">
          <Canvas
            page={activePage}
            points={pointMap}
            tool={tool}
            onToolChange={setTool}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            onMoveNodes={handleMoveNodes}
            onResizeNode={handleResizeNode}
            onDropComponent={(type, x, y) => handleAddNode(type, x, y)}
            beginTransaction={beginTransaction}
            endTransaction={endTransaction}
            onDeleteSelection={handleDeleteSelection}
            onDuplicateSelection={handleDuplicateSelection}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            snapEnabled={snapEnabled}
            onToggleSnap={() => setSnapEnabled((value) => !value)}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((value) => !value)}
          />

          <BottomPanel
            tab={bottomTab}
            onTabChange={setBottomTab}
            collapsed={bottomCollapsed}
            onCollapsedChange={setBottomCollapsed}
            points={live.points}
            writeLogs={writeLogs}
            bindingCounts={bindingCounts}
            status={live.status}
            mode={live.mode}
            url={live.url}
            messageCount={live.messageCount}
            lastMessageAt={live.lastMessageAt}
            lastError={live.lastError}
            events={live.events}
            focusedPointId={focusedPointId}
            onOpenConnection={() => setConnectionOpen(true)}
            onClearWrites={() => setWriteLogs([])}
          />
        </div>

        <Inspector
          tab={inspectorTab}
          onTabChange={setInspectorTab}
          page={activePage}
          project={project}
          selectedNodes={selectedNodes}
          points={live.points}
          pointMap={pointMap}
          status={live.status}
          onUpdateNode={handleUpdateNode}
          onBind={handleBind}
          onAlign={handleAlign}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
          onDuplicate={handleDuplicateSelection}
          onDelete={handleDeleteSelection}
          onUpdatePage={handleUpdatePage}
        />
      </div>

      <footer className="status-bar">
        <span className="status-left">
          <button
            className={`status-connection ${connected ? 'is-live' : ''}`}
            onClick={() => setConnectionOpen(true)}
          >
            {connected ? <Wifi size={12} /> : <Radio size={12} />}
            {sourceLabel}
          </button>
          <span className="status-separator" />
          <span>
            {live.points.length} 点位 · {Object.keys(bindingCounts).length} 已绑定
          </span>
          <span className="status-separator" />
          <span>{writeLogs.length} 条写入记录</span>
        </span>
        <span className="status-center">
          <span>{activePage.name}</span>
          <span className="status-separator" />
          <span>{activePage.nodes.length} 组件</span>
          <span className="status-separator" />
          <span>{selectedCount ? `已选择 ${selectedCount} 个` : '未选择组件'}</span>
        </span>
        <span className="status-right">
          <span className="status-grid">
            <Layers3 size={11} />
            网格 8
            <span className={snapEnabled ? 'is-on' : ''}>吸附 {snapEnabled ? '开' : '关'}</span>
          </span>
          <span className="status-separator" />
          <span className={`status-datasource ${connected ? 'is-live' : ''}`}>
            {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {connected ? 'WS PUSH' : 'DEMO 1.5s'}
          </span>
          <span className="status-separator" />
          <button className="status-help" onClick={() => setConnectionOpen(true)} title="数据源连接">
            <ServerCog size={11} />
            数据源
          </button>
          <span className="status-separator" />
          <button className="status-help" onClick={() => setShortcutsOpen(true)} title="键盘快捷键">
            <Command size={11} />
            快捷键
          </button>
          <span className="status-separator" />
          <span className={`status-save ${savePulse ? 'is-pulsing' : ''}`}>
            <Cloud size={11} />
            {lastSavedLabel}
          </span>
        </span>
      </footer>

      {previewMode && (
        <PreviewMode
          project={project}
          page={activePage}
          pages={project.pages}
          points={pointMap}
          status={live.status}
          mode={live.mode}
          onExit={() => setPreviewMode(false)}
          onPageSelect={handlePageSelect}
          onWrite={handleWrite}
        />
      )}

      {connectionOpen && (
        <ConnectionModal
          url={live.url}
          status={live.status}
          mode={live.mode}
          autoReconnect={live.autoReconnect}
          events={live.events}
          messageCount={live.messageCount}
          lastMessageAt={live.lastMessageAt}
          lastError={live.lastError}
          onUrlChange={live.setUrl}
          onAutoReconnectChange={live.setAutoReconnect}
          onConnect={() => live.connect()}
          onDisconnect={live.disconnect}
          onUseDemo={live.useDemo}
          onClose={() => setConnectionOpen(false)}
          onCopyCommand={copyWsCommand}
        />
      )}

      {shortcutsOpen && (
        <div
          className="modal-backdrop"
          onPointerDown={(event) => {
            if (event.currentTarget === event.target) setShortcutsOpen(false)
          }}
        >
          <div className="modal shortcuts-modal" role="dialog" aria-modal="true" aria-label="键盘快捷键">
            <div className="modal-head">
              <span className="modal-icon is-blue">
                <Keyboard size={19} />
              </span>
              <div>
                <span className="eyebrow">SHORTCUTS</span>
                <h2>键盘快捷键</h2>
              </div>
              <button className="modal-close" onClick={() => setShortcutsOpen(false)} aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className="shortcut-grid">
              {[
                ['选择工具', 'V'],
                ['平移工具', 'H'],
                ['运行预览', 'P'],
                ['撤销', '⌘ / Ctrl + Z'],
                ['重做', '⌘ / Ctrl + Shift + Z'],
                ['复制组件', '⌘ / Ctrl + D'],
                ['保存项目', '⌘ / Ctrl + S'],
                ['导出项目', '⌘ / Ctrl + E'],
                ['删除所选', 'Delete'],
                ['微调位置', '方向键'],
                ['快速微调', 'Shift + 方向键'],
                ['关闭 / 退出', 'Esc'],
              ].map(([action, key]) => (
                <div className="shortcut-row" key={action}>
                  <span>{action}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
            </div>
            <div className="shortcut-footer">
              <Database size={13} />
              双击画布空白处可适应视图；在预览模式下操作按钮、滑块等控件会写回点位。
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <span className="toast-icon">
              {toast.tone === 'success' ? <Check size={14} /> : <TriangleAlert size={14} />}
            </span>
            <span>
              <strong>{toast.message}</strong>
              {toast.detail && <small>{toast.detail}</small>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
