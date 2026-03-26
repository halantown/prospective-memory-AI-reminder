/** Timeline Editor — visual editor for block timeline events with save/preview/validation. */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Copy,
  FileJson,
  Wand2,
} from 'lucide-react'

// ── Types ──

interface TimelineEvent {
  t: number
  type: string
  data: Record<string, unknown>
}

interface TimelineData {
  block_number?: number
  condition?: string
  guest?: string
  day_story?: string
  duration_seconds: number
  events: TimelineEvent[]
}

interface TimelineFileInfo {
  filename: string
  source: 'file'
  block_number?: number
  condition?: string
  event_count?: number
  duration_seconds?: number
  error?: string
}

interface GeneratedCombo {
  block_number: number
  condition: string
  source: 'generator'
  guest: string
}

interface EventSchema {
  event_types: Record<string, { description: string; data_fields: Record<string, unknown> }>
  duration_default: number
  blocks: number[]
  conditions: string[]
}

// ── Helpers ──

const API = '/api/admin/timelines'

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.errors?.join('; ') || `HTTP ${res.status}`)
  }
  return res.json()
}

const EVENT_COLORS: Record<string, string> = {
  block_start: 'bg-green-500',
  block_end: 'bg-red-500',
  ongoing_task_event: 'bg-amber-400',
  robot_speak: 'bg-blue-400',
  phone_message: 'bg-purple-400',
  pm_trigger: 'bg-rose-500',
  pm_watch_activity: 'bg-teal-400',
  fake_trigger: 'bg-gray-400',
}

const EVENT_LABELS: Record<string, string> = {
  block_start: '▶ Block Start',
  block_end: '⏹ Block End',
  ongoing_task_event: '🥩 Ongoing Task',
  robot_speak: '🤖 Robot Speak',
  phone_message: '📱 Phone Message',
  pm_trigger: '🎯 PM Trigger',
  pm_watch_activity: '👁 Activity Watch',
  fake_trigger: '🎭 Fake Trigger',
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatGameClock(seconds: number): string {
  const tickNum = Math.floor(seconds / 10)
  const hour = 17 + Math.floor(tickNum / 60)
  const min = tickNum % 60
  return `${hour}:${min.toString().padStart(2, '0')}`
}

// ── Main Component ──

export default function TimelineEditorPage() {
  const [files, setFiles] = useState<TimelineFileInfo[]>([])
  const [combos, setCombos] = useState<GeneratedCombo[]>([])
  const [schema, setSchema] = useState<EventSchema | null>(null)
  const [timeline, setTimeline] = useState<TimelineData | null>(null)
  const [activeFilename, setActiveFilename] = useState<string | null>(null)
  const [isGenerated, setIsGenerated] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  // Load initial data
  useEffect(() => {
    Promise.all([
      apiFetch<{ files: TimelineFileInfo[]; generated: GeneratedCombo[] }>(`${API}`),
      apiFetch<EventSchema>(`${API}/schema`),
    ]).then(([list, sch]) => {
      setFiles(list.files)
      setCombos(list.generated)
      setSchema(sch)
    }).catch(e => setError(e.message))
  }, [])

  const loadFile = useCallback(async (filename: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<TimelineData>(`${API}/file/${filename}`)
      setTimeline(data)
      setActiveFilename(filename)
      setIsGenerated(false)
      setDirty(false)
      setExpandedEvent(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const generatePreview = useCallback(async (blockNum: number, condition: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<TimelineData>(`${API}/preview`, {
        method: 'POST',
        body: JSON.stringify({ block_number: blockNum, condition }),
      })
      setTimeline(data)
      setActiveFilename(`block_${blockNum}_${condition.toLowerCase()}.json`)
      setIsGenerated(true)
      setDirty(true)
      setExpandedEvent(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const saveTimeline = useCallback(async () => {
    if (!timeline || !activeFilename) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`${API}/file/${activeFilename}`, {
        method: 'PUT',
        body: JSON.stringify({
          duration_seconds: timeline.duration_seconds,
          events: timeline.events,
        }),
      })
      setDirty(false)
      setIsGenerated(false)
      setSuccess('Timeline saved successfully!')
      // Refresh file list
      const list = await apiFetch<{ files: TimelineFileInfo[]; generated: GeneratedCombo[] }>(`${API}`)
      setFiles(list.files)
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }, [timeline, activeFilename])

  // ── Event mutations ──

  const updateEvent = useCallback((index: number, patch: Partial<TimelineEvent>) => {
    if (!timeline) return
    const events = [...timeline.events]
    events[index] = { ...events[index], ...patch }
    setTimeline({ ...timeline, events })
    setDirty(true)
  }, [timeline])

  const updateEventData = useCallback((index: number, key: string, value: unknown) => {
    if (!timeline) return
    const events = [...timeline.events]
    events[index] = {
      ...events[index],
      data: { ...events[index].data, [key]: value },
    }
    setTimeline({ ...timeline, events })
    setDirty(true)
  }, [timeline])

  const removeEventDataKey = useCallback((index: number, key: string) => {
    if (!timeline) return
    const events = [...timeline.events]
    const newData = { ...events[index].data }
    delete newData[key]
    events[index] = { ...events[index], data: newData }
    setTimeline({ ...timeline, events })
    setDirty(true)
  }, [timeline])

  const deleteEvent = useCallback((index: number) => {
    if (!timeline) return
    const events = timeline.events.filter((_, i) => i !== index)
    setTimeline({ ...timeline, events })
    setDirty(true)
    setExpandedEvent(null)
  }, [timeline])

  const addEvent = useCallback((type: string = 'robot_speak', t: number = 0) => {
    if (!timeline) return
    const defaultData: Record<string, Record<string, unknown>> = {
      robot_speak: { text: '', log_tag: 'neutral' },
      ongoing_task_event: { task: 'steak', event: 'place_steak', pan: 1, room: 'kitchen' },
      phone_message: { message_id: '' },
      pm_trigger: { trigger_id: '', trigger_event: '' },
      fake_trigger: { trigger_type: 'visitor', content: '', duration: 5 },
    }
    const newEvent: TimelineEvent = { t, type, data: defaultData[type] || {} }
    const events = [...timeline.events, newEvent].sort((a, b) => a.t - b.t)
    setTimeline({ ...timeline, events })
    setDirty(true)
    // Expand the newly added event
    const newIndex = events.indexOf(newEvent)
    setExpandedEvent(newIndex)
  }, [timeline])

  const duplicateEvent = useCallback((index: number) => {
    if (!timeline) return
    const src = timeline.events[index]
    const newEvent: TimelineEvent = {
      t: src.t + 5,
      type: src.type,
      data: JSON.parse(JSON.stringify(src.data)),
    }
    const events = [...timeline.events, newEvent].sort((a, b) => a.t - b.t)
    setTimeline({ ...timeline, events })
    setDirty(true)
  }, [timeline])

  // ── Filtered/sorted events ──

  const sortedEvents = useMemo(() => {
    if (!timeline) return []
    const evts = timeline.events.map((e, i) => ({ ...e, _origIndex: i }))
    evts.sort((a, b) => a.t - b.t)
    if (filterType === 'all') return evts
    return evts.filter(e => e.type === filterType)
  }, [timeline, filterType])

  // ── Stats ──

  const stats = useMemo(() => {
    if (!timeline) return null
    const typeCounts: Record<string, number> = {}
    for (const e of timeline.events) {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1
    }
    return {
      total: timeline.events.length,
      duration: timeline.duration_seconds,
      typeCounts,
    }
  }, [timeline])

  // ── Render ──

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-slate-400 hover:text-slate-600">
              <ArrowLeft size={20} />
            </a>
            <h1 className="text-xl font-bold text-slate-800">
              ⏱ Timeline Editor
            </h1>
            {activeFilename && (
              <span className="text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {activeFilename}
              </span>
            )}
            {dirty && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                Unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {timeline && (
              <>
                <button
                  onClick={saveTimeline}
                  disabled={saving || !dirty}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg
                             hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setTimeline(null); setActiveFilename(null); setDirty(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg
                             hover:bg-slate-200 text-sm"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto px-4 mt-3"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle size={16} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto px-4 mt-3"
          >
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle size={16} />
              {success}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {!timeline ? (
          /* ── Source Picker ── */
          <div className="space-y-6">
            {/* Static files */}
            <section>
              <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <FileJson size={18} /> Static Timeline Files
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {files.map(f => (
                  <button
                    key={f.filename}
                    onClick={() => loadFile(f.filename)}
                    className="bg-white rounded-xl border border-slate-200 p-4 text-left
                               hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="font-mono text-sm font-medium text-slate-700">{f.filename}</div>
                    {f.error ? (
                      <div className="text-xs text-red-500 mt-1">{f.error}</div>
                    ) : (
                      <div className="text-xs text-slate-500 mt-1">
                        {f.event_count} events · {f.duration_seconds}s
                        {f.condition && ` · ${f.condition}`}
                      </div>
                    )}
                  </button>
                ))}
                {files.length === 0 && (
                  <p className="text-slate-400 text-sm">No timeline files found</p>
                )}
              </div>
            </section>

            {/* Generator */}
            <section>
              <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Wand2 size={18} /> Generate Timeline Preview
              </h2>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {combos.map(c => (
                  <button
                    key={`${c.block_number}-${c.condition}`}
                    onClick={() => generatePreview(c.block_number, c.condition)}
                    className="bg-white rounded-xl border border-slate-200 p-4 text-left
                               hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="font-medium text-slate-700">
                      Block {c.block_number} · {c.condition}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Guest: {c.guest} · Generated
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* ── Editor ── */
          <div className="space-y-6">
            {/* Stats bar */}
            {stats && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap gap-4 items-center text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock size={14} />
                    Duration: <strong>{stats.duration}s</strong> ({formatTime(stats.duration)})
                  </div>
                  <div className="text-slate-400">|</div>
                  <div className="text-slate-600">
                    Total events: <strong>{stats.total}</strong>
                  </div>
                  <div className="text-slate-400">|</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.typeCounts).sort().map(([type, count]) => (
                      <span
                        key={type}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white ${EVENT_COLORS[type] || 'bg-gray-400'}`}
                      >
                        {EVENT_LABELS[type] || type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Duration editor */}
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <label className="text-slate-500">Block Duration (s):</label>
                  <input
                    type="number"
                    value={timeline.duration_seconds}
                    onChange={e => {
                      setTimeline({ ...timeline, duration_seconds: parseInt(e.target.value) || 600 })
                      setDirty(true)
                    }}
                    className="w-24 border border-slate-300 rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Visual timeline bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">Visual Timeline</h3>
              <div className="relative h-12 bg-slate-100 rounded-lg overflow-hidden">
                {/* Time markers */}
                {[0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600].map(t => (
                  <div
                    key={t}
                    className="absolute top-0 h-full border-l border-slate-300 border-dashed"
                    style={{ left: `${(t / timeline.duration_seconds) * 100}%` }}
                  >
                    <span className="absolute -top-0.5 left-0.5 text-[9px] text-slate-400">
                      {formatTime(t)}
                    </span>
                  </div>
                ))}
                {/* Event markers */}
                {timeline.events.map((evt, i) => (
                  <div
                    key={i}
                    className={`absolute bottom-0 w-1.5 cursor-pointer transition-all hover:scale-y-125 ${EVENT_COLORS[evt.type] || 'bg-gray-400'}`}
                    style={{
                      left: `${(evt.t / timeline.duration_seconds) * 100}%`,
                      height: expandedEvent === i ? '100%' : '60%',
                      opacity: filterType === 'all' || filterType === evt.type ? 1 : 0.2,
                    }}
                    title={`${formatTime(evt.t)} — ${EVENT_LABELS[evt.type] || evt.type}`}
                    onClick={() => setExpandedEvent(expandedEvent === i ? null : i)}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                {Object.entries(EVENT_LABELS).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(filterType === type ? 'all' : type)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all
                      ${filterType === type ? 'ring-2 ring-blue-400 bg-blue-50' : 'hover:bg-slate-100'}`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-sm ${EVENT_COLORS[type]}`} />
                    {label}
                  </button>
                ))}
                {filterType !== 'all' && (
                  <button
                    onClick={() => setFilterType('all')}
                    className="text-blue-600 hover:underline"
                  >
                    Show All
                  </button>
                )}
              </div>
            </div>

            {/* Add event + controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-600">Add Event:</span>
              {['ongoing_task_event', 'robot_speak', 'phone_message', 'pm_trigger', 'fake_trigger'].map(type => (
                <button
                  key={type}
                  onClick={() => addEvent(type, 0)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-white font-medium
                    ${EVENT_COLORS[type]} hover:opacity-90`}
                >
                  <Plus size={12} />
                  {EVENT_LABELS[type]?.replace(/^.\s/, '') || type}
                </button>
              ))}
            </div>

            {/* Event table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 w-16 text-slate-500 font-medium">Time</th>
                    <th className="text-left px-3 py-2 w-16 text-slate-500 font-medium">Clock</th>
                    <th className="text-left px-3 py-2 w-40 text-slate-500 font-medium">Type</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-medium">Summary</th>
                    <th className="text-right px-3 py-2 w-24 text-slate-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.map((evt, displayIdx) => {
                    const origIndex = (evt as any)._origIndex as number
                    const isExpanded = expandedEvent === origIndex
                    return (
                      <EventRow
                        key={`${origIndex}-${evt.t}-${evt.type}`}
                        event={evt}
                        index={origIndex}
                        duration={timeline.duration_seconds}
                        isExpanded={isExpanded}
                        schema={schema}
                        onToggle={() => setExpandedEvent(isExpanded ? null : origIndex)}
                        onUpdate={(patch) => updateEvent(origIndex, patch)}
                        onUpdateData={(k, v) => updateEventData(origIndex, k, v)}
                        onRemoveDataKey={(k) => removeEventDataKey(origIndex, k)}
                        onDelete={() => deleteEvent(origIndex)}
                        onDuplicate={() => duplicateEvent(origIndex)}
                      />
                    )
                  })}
                  {sortedEvents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No events{filterType !== 'all' ? ` of type "${filterType}"` : ''}. Click "Add Event" above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ── Event Row Component ──

function EventRow({
  event,
  index,
  duration,
  isExpanded,
  schema,
  onToggle,
  onUpdate,
  onUpdateData,
  onRemoveDataKey,
  onDelete,
  onDuplicate,
}: {
  event: TimelineEvent
  index: number
  duration: number
  isExpanded: boolean
  schema: EventSchema | null
  onToggle: () => void
  onUpdate: (patch: Partial<TimelineEvent>) => void
  onUpdateData: (key: string, value: unknown) => void
  onRemoveDataKey: (key: string) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const summary = useMemo(() => eventSummary(event), [event])
  const color = EVENT_COLORS[event.type] || 'bg-gray-400'

  return (
    <>
      <tr
        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors
          ${isExpanded ? 'bg-blue-50' : ''}`}
        onClick={onToggle}
      >
        {/* Time */}
        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
          <input
            type="number"
            value={event.t}
            onChange={e => onUpdate({ t: parseFloat(e.target.value) || 0 })}
            className="w-14 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono
                       focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            min={0}
            max={duration}
            step={5}
          />
        </td>
        {/* Game Clock */}
        <td className="px-3 py-2 text-xs text-slate-400 font-mono">
          {formatGameClock(event.t)}
        </td>
        {/* Type */}
        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
          <select
            value={event.type}
            onChange={e => onUpdate({ type: e.target.value })}
            className={`text-xs text-white font-medium rounded px-2 py-1 ${color} appearance-none cursor-pointer`}
          >
            {Object.entries(EVENT_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </td>
        {/* Summary */}
        <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-xs">
          {summary}
        </td>
        {/* Actions */}
        <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <button onClick={onDuplicate} className="p-1 text-slate-400 hover:text-blue-600" title="Duplicate">
              <Copy size={13} />
            </button>
            <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-600" title="Delete">
              <Trash2 size={13} />
            </button>
            <button onClick={onToggle} className="p-1 text-slate-400 hover:text-slate-600">
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded data editor */}
      {isExpanded && (
        <tr className="bg-blue-50/50">
          <td colSpan={5} className="px-4 py-3">
            <DataEditor
              data={event.data}
              eventType={event.type}
              schema={schema}
              onUpdateData={onUpdateData}
              onRemoveDataKey={onRemoveDataKey}
            />
          </td>
        </tr>
      )}
    </>
  )
}


// ── Data Editor ──

function DataEditor({
  data,
  eventType,
  schema,
  onUpdateData,
  onRemoveDataKey,
}: {
  data: Record<string, unknown>
  eventType: string
  schema: EventSchema | null
  onUpdateData: (key: string, value: unknown) => void
  onRemoveDataKey: (key: string) => void
}) {
  const [newKey, setNewKey] = useState('')
  const schemaFields = schema?.event_types?.[eventType]?.data_fields || {}

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-500 mb-1">
        Event Data
        {schema?.event_types?.[eventType] && (
          <span className="ml-2 text-slate-400 font-normal">
            — {schema.event_types[eventType].description}
          </span>
        )}
      </div>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 w-32 shrink-0">{key}:</span>
          {typeof value === 'object' && value !== null ? (
            <textarea
              value={JSON.stringify(value, null, 2)}
              onChange={e => {
                try {
                  onUpdateData(key, JSON.parse(e.target.value))
                } catch {
                  // Let user continue typing
                }
              }}
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs font-mono
                         focus:ring-1 focus:ring-blue-400 min-h-[60px]"
            />
          ) : (
            <input
              type={typeof value === 'number' ? 'number' : 'text'}
              value={String(value ?? '')}
              onChange={e => {
                const v = typeof value === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value
                onUpdateData(key, v)
              }}
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs font-mono
                         focus:ring-1 focus:ring-blue-400"
            />
          )}
          <button
            onClick={() => onRemoveDataKey(key)}
            className="p-1 text-slate-300 hover:text-red-500"
            title="Remove field"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      {/* Suggested missing fields from schema */}
      {Object.keys(schemaFields)
        .filter(k => !(k in data))
        .map(k => (
          <button
            key={k}
            onClick={() => onUpdateData(k, '')}
            className="text-xs text-blue-500 hover:underline flex items-center gap-1"
          >
            <Plus size={10} /> Add "{k}"
          </button>
        ))}
      {/* Add custom field */}
      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder="new field name"
          className="w-32 border border-slate-300 rounded px-2 py-1 text-xs"
          onKeyDown={e => {
            if (e.key === 'Enter' && newKey.trim()) {
              onUpdateData(newKey.trim(), '')
              setNewKey('')
            }
          }}
        />
        <button
          onClick={() => { if (newKey.trim()) { onUpdateData(newKey.trim(), ''); setNewKey('') } }}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add Field
        </button>
      </div>
    </div>
  )
}


// ── Helpers ──

function eventSummary(event: TimelineEvent): string {
  const d = event.data
  switch (event.type) {
    case 'block_start': return 'Start of block'
    case 'block_end': return 'End of block'
    case 'ongoing_task_event':
      return `${d.task}/${d.event} — Pan ${d.pan ?? '?'} (${d.room})`
    case 'robot_speak': {
      const text = String(d.text || '')
      const tag = d.log_tag ? ` [${d.log_tag}]` : ''
      return text.length > 60 ? text.slice(0, 60) + '…' + tag : text + tag
    }
    case 'phone_message':
      return `Message: ${d.message_id}`
    case 'pm_trigger':
      return `Trigger: ${d.trigger_id || d.task_id} — ${d.trigger_event || ''}`
    case 'pm_watch_activity':
      return `Watch: ${d.task_id} (${d.watch_condition}) fallback=${d.fallback_time}s`
    case 'fake_trigger':
      return `Fake: ${d.trigger_type} — ${d.content}`
    default:
      return JSON.stringify(d).slice(0, 80)
  }
}
