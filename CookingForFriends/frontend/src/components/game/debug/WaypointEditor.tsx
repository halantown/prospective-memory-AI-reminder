/**
 * WaypointEditor — dev-only overlay for annotating waypoints on the floor plan.
 *
 * Rendered INSIDE the zoom div (absolute inset-0) so click coordinates map
 * directly to image-% space regardless of zoom level:
 *
 *   imgX% = (clientX − rect.left) / rect.width  × 100
 *   imgY% = (clientY − rect.top)  / rect.height × 100
 *
 * The JSON export panel is rendered via a React portal to document.body so it
 * escapes the CSS transform and appears at a fixed viewport position.
 *
 * Interaction:
 *   • Click background   → create node (edit popup opens automatically)
 *   • Click node         → select (yellow ring); click another → create edge
 *   • Double-click node  → re-open edit popup
 *   • Right-click node   → delete node + its edges
 *   • Click edge dot     → delete edge
 *   • Escape             → deselect
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

type Facing = 'up' | 'down' | 'left' | 'right'

interface WPNode {
  id: string
  name: string
  x: number       // % of image width
  y: number       // % of image height
  room: string | null
  station: boolean
  facing: Facing
}

interface WPEdge { from: string; to: string }

interface WaypointEditorProps {
  currentRoom: string | null
  isActive: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WaypointEditor({ currentRoom, isActive }: WaypointEditorProps) {
  const [nodes, setNodes] = useState<WPNode[]>([])
  const [edges, setEdges] = useState<WPEdge[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [counter, setCounter] = useState(1)
  const [copied, setCopied] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // Dismiss selection on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedId(null); setEditingId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Coordinate extraction ───────────────────────────────────────────────────

  const getImgCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10
    return { x, y }
  }

  // ── Click handlers ─────────────────────────────────────────────────────────

  const handleBgClick = useCallback((e: React.MouseEvent) => {
    if (selectedId) { setSelectedId(null); return }
    const coords = getImgCoords(e)
    if (!coords) return
    const id = `wp_${counter}`
    const newNode: WPNode = {
      id,
      name: id,
      x: coords.x,
      y: coords.y,
      room: currentRoom,
      station: false,
      facing: 'down',
    }
    setNodes(prev => [...prev, newNode])
    setCounter(c => c + 1)
    setEditingId(id)
  }, [counter, currentRoom, selectedId])

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (selectedId && selectedId !== nodeId) {
      const already = edges.some(
        edge => (edge.from === selectedId && edge.to === nodeId)
             || (edge.from === nodeId  && edge.to === selectedId),
      )
      if (!already) setEdges(prev => [...prev, { from: selectedId, to: nodeId }])
      setSelectedId(null)
    } else {
      setSelectedId(prev => prev === nodeId ? null : nodeId)
    }
  }, [selectedId, edges])

  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    setEditingId(nodeId)
    setSelectedId(null)
  }, [])

  const handleNodeRightClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setEdges(prev => prev.filter(edge => edge.from !== nodeId && edge.to !== nodeId))
    if (selectedId === nodeId) setSelectedId(null)
    if (editingId === nodeId) setEditingId(null)
  }, [selectedId, editingId])

  const handleEdgeDelete = useCallback((e: React.MouseEvent, from: string, to: string) => {
    e.stopPropagation()
    setEdges(prev => prev.filter(
      edge => !((edge.from === from && edge.to === to) || (edge.from === to && edge.to === from)),
    ))
  }, [])

  // ── JSON export ────────────────────────────────────────────────────────────

  const getJson = useCallback((): string => {
    const waypointsObj: Record<string, object> = {}
    for (const n of nodes) {
      const key = n.name || n.id
      const entry: Record<string, unknown> = { x: n.x, y: n.y, room: n.room }
      if (n.station) { entry.station = true; entry.facing = n.facing }
      waypointsObj[key] = entry
    }
    const edgesArr = edges.map(({ from, to }) => [
      nodes.find(n => n.id === from)?.name || from,
      nodes.find(n => n.id === to)?.name   || to,
    ])
    return JSON.stringify({ waypoints: waypointsObj, edges: edgesArr }, null, 2)
  }, [nodes, edges])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(getJson())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [getJson])

  const updateNode = useCallback((id: string, patch: Partial<WPNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  }, [])

  if (!isActive) return null

  const editingNode = editingId ? nodes.find(n => n.id === editingId) : null

  return (
    <>
      {/* ── Interactive overlay (inside zoom div, follows transform) ── */}
      <div
        className="absolute inset-0"
        style={{ zIndex: 55, cursor: selectedId ? 'crosshair' : 'cell' }}
        onContextMenu={e => e.preventDefault()}
      >
        {/* SVG: edges + node circles */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          style={{ overflow: 'visible' }}
        >
          {/* Transparent background rect captures "add node" clicks */}
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="transparent"
            onClick={handleBgClick}
          />

          {/* Edges */}
          {edges.map(({ from, to }) => {
            const a = nodes.find(n => n.id === from)
            const b = nodes.find(n => n.id === to)
            if (!a || !b) return null
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            return (
              <g key={`edge-${from}-${to}`}>
                <line
                  x1={`${a.x}%`} y1={`${a.y}%`}
                  x2={`${b.x}%`} y2={`${b.y}%`}
                  stroke="#FCD34D" strokeWidth="1.5" strokeDasharray="5 3"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Midpoint circle — click to delete edge */}
                <circle
                  cx={`${mx}%`} cy={`${my}%`} r="4"
                  fill="#EF4444" stroke="#fff" strokeWidth="1"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => handleEdgeDelete(e as unknown as React.MouseEvent, from, to)}
                />
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const isSelected = node.id === selectedId
            return (
              <g key={node.id}>
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={`${node.x}%`} cy={`${node.y}%`} r="13"
                    fill="none" stroke="#FCD34D" strokeWidth="2" strokeDasharray="4 2"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Main circle */}
                <circle
                  cx={`${node.x}%`} cy={`${node.y}%`} r="8"
                  fill={node.station ? '#F97316' : '#3B82F6'}
                  stroke="white" strokeWidth="1.5"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => handleNodeClick(e as unknown as React.MouseEvent, node.id)}
                  onDoubleClick={(e) => handleNodeDoubleClick(e as unknown as React.MouseEvent, node.id)}
                  onContextMenu={(e) => handleNodeRightClick(e as unknown as React.MouseEvent, node.id)}
                />
                {/* Label */}
                <text
                  x={`${node.x}%`} y={`${node.y}%`}
                  textAnchor="middle"
                  fontSize="8" fill="white" fontFamily="monospace" fontWeight="bold"
                  dy="-12"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.name}
                </text>
                {/* Station indicator */}
                {node.station && (
                  <text
                    x={`${node.x}%`} y={`${node.y}%`}
                    textAnchor="middle"
                    fontSize="7" fill="#FCD34D" fontFamily="monospace"
                    dy="20"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ⭐{node.facing}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* ── Inline edit popup for new/double-clicked node ── */}
        {editingNode && (
          <div
            className="absolute"
            style={{
              left: `${editingNode.x}%`,
              top: `${editingNode.y}%`,
              transform: 'translate(-50%, -130%)',
              zIndex: 60,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-slate-900 border border-amber-500/70 rounded-lg px-2 py-1.5 shadow-2xl flex flex-col gap-1 min-w-[140px]">
              <div className="text-[9px] text-amber-300 font-bold mb-0.5">
                Edit waypoint
              </div>
              {/* Name */}
              <input
                autoFocus
                className="bg-slate-800 text-white rounded px-1 py-0.5 text-[10px] outline-none border border-slate-600 focus:border-amber-400 w-full"
                placeholder="name"
                value={editingNode.name}
                onChange={e => updateNode(editingNode.id, { name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null) }}
              />
              {/* Room (read-only) */}
              <div className="text-[9px] text-slate-400">room: {editingNode.room ?? 'overview'}</div>
              {/* Station toggle */}
              <label className="text-[10px] text-slate-300 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingNode.station}
                  onChange={e => updateNode(editingNode.id, { station: e.target.checked })}
                />
                station
              </label>
              {/* Facing (only if station) */}
              {editingNode.station && (
                <select
                  className="bg-slate-800 text-white rounded px-1 py-0.5 text-[10px] border border-slate-600 outline-none"
                  value={editingNode.facing}
                  onChange={e => updateNode(editingNode.id, { facing: e.target.value as Facing })}
                >
                  {(['up', 'down', 'left', 'right'] as Facing[]).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              )}
              {/* Done */}
              <button
                className="text-[9px] text-amber-400 hover:text-amber-200 text-right mt-0.5"
                onClick={() => setEditingId(null)}
              >
                ✓ done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── JSON panel (portal → outside CSS transform) ── */}
      {createPortal(
        <div
          className="fixed top-4 right-4 w-80 bg-slate-950/96 backdrop-blur-sm border border-amber-500/40 rounded-xl shadow-2xl flex flex-col"
          style={{ zIndex: 9999, maxHeight: '80vh' }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-300">⚙ Waypoint Editor</span>
            <span className="text-[10px] text-slate-400">
              {nodes.length} nodes · {edges.length} edges
            </span>
          </div>

          {/* JSON preview */}
          <div className="flex-1 overflow-auto p-2 min-h-0">
            <pre className="text-[9px] text-green-300 font-mono leading-relaxed whitespace-pre-wrap break-all">
              {getJson()}
            </pre>
          </div>

          {/* Actions */}
          <div className="px-3 py-2 border-t border-slate-800 flex gap-2">
            <button
              className="flex-1 text-xs py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 font-semibold transition-colors"
              onClick={handleCopy}
            >
              {copied ? '✓ Copied!' : '📋 Copy JSON'}
            </button>
            <button
              className="text-xs py-1.5 px-2.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
              onClick={() => { setNodes([]); setEdges([]); setSelectedId(null); setEditingId(null) }}
            >
              Clear
            </button>
          </div>

          {/* Help text */}
          <div className="px-3 pb-2 text-[9px] text-slate-500 leading-relaxed">
            <div>🖱 Click map → add node</div>
            <div>Click node → select · Click 2nd node → edge</div>
            <div>Double-click node → edit · Right-click → delete</div>
            <div>Click red edge dot → delete edge · Esc → deselect</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
