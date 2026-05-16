/** Feature-rich admin dashboard — overview, sortable table, expandable rows, actions. */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  RotateCcw,
  XCircle,
  RefreshCw,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  Plus,
  Download,
  ExternalLink,
  FlaskConical,
  BarChart2,
  Search,
} from 'lucide-react'
import {
  createParticipant,
  getAssignmentCounts,
  exportPerParticipant,
  exportAggregated,
  createTestSession,
  adminFetch,
} from '../../services/api'
import { TRIGGER_SCHEDULE } from '../../constants/pmTasks'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ParticipantRow {
  session_id: string
  participant_id: string
  condition: string
  status: 'registered' | 'in_progress' | 'completed' | 'dropped'
  token: string
  is_online: boolean
  created_at: string | null
}

interface Overview {
  total_participants: number
  completed: number
  in_progress: number
}

interface Trial {
  id: number
  trial_number: number
  task_id: string
  has_reminder: boolean
  is_filler: boolean
  score: number | null
  trigger_fired_at: number | null
  responded_at: number | null
  task_config: Record<string, unknown>
}

interface Block {
  block_number: number
  condition: string
  status: string
  day_story: string
  trials: Trial[]
}

interface ParticipantDetail {
  session_id: string
  participant_id: string
  condition: string
  status: string
  token: string
  is_online: boolean
  created_at: string | null
  blocks: Block[]
}

type SortKey = 'status' | 'created_at' | 'participant_id'
type SortDir = 'asc' | 'desc'
type AdminTab = 'participants' | 'latin_square' | 'test_mode'

interface ConfirmAction {
  kind: 'reset' | 'drop'
  participant: ParticipantRow
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  registered: 1,
  completed: 2,
  dropped: 3,
}

const conditionColor = (c: string) => {
  if (c === 'EE1') return 'bg-blue-100 text-blue-700'
  if (c === 'EE0') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

const statusBadge = (s: string) => {
  if (s === 'completed') return 'bg-green-100 text-green-700'
  if (s === 'in_progress') return 'bg-blue-100 text-blue-700'
  if (s === 'dropped') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-600'
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

/* ------------------------------------------------------------------ */
/*  Confirmation Modal                                                 */
/* ------------------------------------------------------------------ */

function ConfirmModal({
  action,
  onConfirm,
  onCancel,
}: {
  action: ConfirmAction
  onConfirm: () => void
  onCancel: () => void
}) {
  const isReset = action.kind === 'reset'
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            {isReset ? (
              <RotateCcw className="w-6 h-6 text-amber-500" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500" />
            )}
            <h3 className="text-lg font-semibold text-slate-800">
              {isReset ? 'Reset Participant?' : 'Drop Participant?'}
            </h3>
          </div>
          <p className="text-sm text-slate-600 mb-1">
            Participant:{' '}
            <span className="font-mono font-medium">{action.participant.participant_id}</span>
          </p>
          <p className="text-sm text-slate-500 mb-6">
            {isReset
              ? 'This will reset the participant back to REGISTERED status. All progress will be cleared.'
              : 'This will mark the participant as DROPPED. This action should only be used for participants who cannot continue.'}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                isReset
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {isReset ? 'Reset' : 'Drop'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  badge,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  badge?: number
}) {
  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          {badge !== undefined && badge > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              {badge} online
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Expanded Detail View                                               */
/* ------------------------------------------------------------------ */

function ParticipantDetailView({ sessionId }: { sessionId: string }) {
  const [detail, setDetail] = useState<ParticipantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminFetch(`/api/admin/participant/${sessionId}/detail`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        if (!cancelled) {
          setDetail(d)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (loading)
    return (
      <div className="p-6 text-sm text-slate-400 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading details…
      </div>
    )
  if (error)
    return (
      <div className="p-6 text-sm text-red-500 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> Failed to load: {error}
      </div>
    )
  if (!detail) return null

  return (
    <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
      {detail.blocks.map((block) => (
        <div
          key={block.block_number}
          className="bg-slate-50 rounded-xl border border-slate-200 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">
              Block {block.block_number}
            </h4>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionColor(block.condition)}`}>
                {block.condition}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(block.status)}`}>
                {block.status}
              </span>
            </div>
          </div>
          {block.day_story && (
            <p className="text-xs text-slate-500 mb-3 italic truncate" title={block.day_story}>
              {block.day_story}
            </p>
          )}
          <div className="space-y-1.5">
            {block.trials.map((trial) => (
              <div
                key={trial.id}
                className="flex items-center gap-2 text-xs bg-white rounded-lg border border-slate-100 px-3 py-2"
              >
                <span className="font-mono font-medium text-slate-700 w-24 truncate" title={trial.task_id}>
                  {trial.task_id}
                </span>
                {trial.has_reminder && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                    PM
                  </span>
                )}
                {trial.is_filler && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                    filler
                  </span>
                )}
                <span className="ml-auto font-medium text-slate-600">
                  {trial.score !== null ? trial.score : '—'}
                </span>
                {trial.responded_at !== null ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                ) : trial.trigger_fired_at !== null ? (
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200" />
                )}
              </div>
            ))}
            {block.trials.length === 0 && (
              <p className="text-xs text-slate-400 italic py-2">No trials yet</p>
            )}
          </div>
        </div>
      ))}
      {detail.blocks.length === 0 && (
        <div className="col-span-3 text-center py-6 text-sm text-slate-400">
          No blocks recorded yet.
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Latin Square Tab                                                   */
/* ------------------------------------------------------------------ */

function LatinSquareTab() {
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAssignmentCounts().then((d) => { setCounts(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const conditions = ['EE1', 'EE0']
  const orders = ['A', 'B', 'C', 'D']

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Assignment Counts (Condition × Order)</h3>
        {loading ? (
          <div className="text-slate-400 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <table className="text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-500" />
                {orders.map((o) => (
                  <th key={o} className="px-6 py-2 font-semibold text-slate-700 text-center">{o}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conditions.map((c) => (
                <tr key={c} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conditionColor(c)}`}>{c}</span>
                  </td>
                  {orders.map((o) => (
                    <td key={o} className="px-6 py-3 text-center font-bold text-slate-800">
                      {counts[c]?.[o] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Trigger Schedule</h3>
        <div className="space-y-2">
          {TRIGGER_SCHEDULE.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-4 py-2">
              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-bold">{i + 1}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${entry.type === 'real' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {entry.type === 'real' ? `Real (pos ${entry.task_position})` : `Fake (${entry.trigger_type})`}
              </span>
              <span className="text-slate-500">+{entry.delay_after_previous_s}s after previous</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Test Mode Tab                                                      */
/* ------------------------------------------------------------------ */

function TestModeTab() {
  const [condition, setCondition] = useState('EE1')
  const [order, setOrder] = useState('A')
  const [startPhase, setStartPhase] = useState('MAIN_EXPERIMENT')
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{ session_id: string; token: string; entry_url: string } | null>(null)

  const PHASES = [
    'WELCOME',
    'CONSENT',
    'DEMOGRAPHICS',
    'MSE_PRE',
    'STORY_INTRO',
    'ENCODING_VIDEO_1',
    'TUTORIAL_PHONE',
    'MAIN_EXPERIMENT',
    'POST_MANIP_CHECK',
    'DEBRIEF',
  ]

  const handleCreate = async () => {
    setCreating(true)
    try {
      const r = await createTestSession({ condition, order, start_phase: startPhase })
      setResult(r)
    } catch (e) { console.error(e) }
    setCreating(false)
  }

  const handleOpen = () => {
    if (!result) return
    navigator.clipboard?.writeText(result.token).catch((e) => {
      console.warn('[Admin] Failed to copy test token', e)
    })
    window.open(window.location.origin, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        ⚠️ Test sessions are excluded from real data by default. Use the Data Export tab to include them if needed.
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Create Test Session</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Condition</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="EE1">EE1</option>
              <option value="EE0">EE0</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Order</label>
            <select value={order} onChange={(e) => setOrder(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {['A','B','C','D'].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Start Phase</label>
            <select value={startPhase} onChange={(e) => setStartPhase(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <button onClick={handleCreate} disabled={creating}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors text-sm">
          {creating ? 'Creating…' : 'Create Test Session'}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl space-y-2">
            <p className="text-sm font-medium text-slate-800">Session created!</p>
            <p className="text-xs text-slate-500">
              Token: <span className="font-mono font-bold text-slate-700">{result.token}</span>
            </p>
            <button onClick={handleOpen}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              <Copy className="w-4 h-4" />
              Copy Token & Open Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Export Dropdown                                                     */
/* ------------------------------------------------------------------ */

function ExportDropdown() {
  const [open, setOpen] = useState(false)
  const [includeTest, setIncludeTest] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const dl = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePerParticipant = async () => {
    setLoading('per')
    try {
      const blob = await exportPerParticipant(includeTest)
      dl(blob, `per-participant-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) { console.error(e) }
    setLoading(null)
  }

  const handleAggregated = async () => {
    setLoading('agg')
    try {
      const blob = await exportAggregated(includeTest)
      dl(blob, `aggregated-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) { console.error(e) }
    setLoading(null)
  }

  const handleJSON = async () => {
    setLoading('json')
    try {
      const res = await adminFetch('/api/admin/data/export')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      dl(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        `experiment-export-${new Date().toISOString().slice(0, 10)}.json`,
      )
    } catch (e) { console.error(e) }
    setLoading(null)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-60 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
          <label className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-600 border-b border-slate-100 cursor-pointer">
            <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} className="w-3.5 h-3.5 rounded" />
            Include test sessions
          </label>
          <button onClick={handlePerParticipant} disabled={loading !== null}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:text-slate-300 transition-colors">
            {loading === 'per' ? 'Exporting…' : 'Per-Participant CSV'}
          </button>
          <button onClick={handleAggregated} disabled={loading !== null}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:text-slate-300 transition-colors">
            {loading === 'agg' ? 'Exporting…' : 'Aggregated CSV'}
          </button>
          <button onClick={handleJSON} disabled={loading !== null}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:text-slate-300 transition-colors border-t border-slate-100">
            {loading === 'json' ? 'Exporting…' : 'Full JSON'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<AdminTab>('participants')
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [creating, setCreating] = useState(false)
  const [lastCreated, setLastCreated] = useState<{
    participant_id: string
    token: string
    entry_url?: string
    task_order?: string
  } | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [refreshing, setRefreshing] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [onlineOnly, setOnlineOnly] = useState(false)

  const [showManualCreate, setShowManualCreate] = useState(false)
  const [manualCondition, setManualCondition] = useState('EE1')
  const [manualOrder, setManualOrder] = useState('A')
  const [manualCreating, setManualCreating] = useState(false)

  /* ---------- data fetching ---------- */

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [pRes, oRes] = await Promise.all([
        adminFetch('/api/admin/participants'),
        adminFetch('/api/admin/experiment/overview'),
      ])
      if (pRes.ok) setParticipants(await pRes.json())
      if (oRes.ok) setOverview(await oRes.json())
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const interval = setInterval(refreshWhenVisible, 5000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refresh])

  /* ---------- derived counts ---------- */

  const droppedCount = useMemo(
    () => participants.filter((p) => p.status === 'dropped').length,
    [participants],
  )
  const onlineCount = useMemo(
    () => participants.filter((p) => p.is_online).length,
    [participants],
  )

  /* ---------- sorting ---------- */

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...participants]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'status') {
        cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      } else if (sortKey === 'created_at') {
        cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '')
      } else {
        cmp = a.participant_id.localeCompare(b.participant_id)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [participants, sortKey, sortDir])

  /* ---------- filtering ---------- */

  const filtered = useMemo(() => {
    return sorted.filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !p.participant_id.toLowerCase().includes(q) &&
          !p.token.toLowerCase().includes(q) &&
          !p.condition.toLowerCase().includes(q)
        ) return false
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (onlineOnly && !p.is_online) return false
      return true
    })
  }, [sorted, search, statusFilter, onlineOnly])

  /* ---------- actions ---------- */

  const handleCreate = async () => {
    setCreating(true)
    try {
      const result = await createParticipant()
      setLastCreated({ participant_id: result.participant_id, token: result.token, entry_url: result.entry_url, task_order: result.task_order })
      refresh()
    } catch (err) {
      console.error('Failed to create participant:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleManualCreate = async () => {
    setManualCreating(true)
    try {
      const result = await createParticipant({ condition: manualCondition, order: manualOrder })
      setLastCreated({ participant_id: result.participant_id, token: result.token, entry_url: result.entry_url })
      refresh()
    } catch (e) { console.error(e) }
    setManualCreating(false)
  }

  const handleCopyToken = async (token: string) => {
    await copyToClipboard(token)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    const { kind, participant } = confirmAction
    const url = `/api/admin/participant/${participant.session_id}/${kind}`
    try {
      const res = await adminFetch(url, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      refresh()
    } catch (err) {
      console.error(`Failed to ${kind} participant:`, err)
    } finally {
      setConfirmAction(null)
    }
  }

  /* ---------- column sort header helper ---------- */

  const SortHeader = ({
    label,
    sortKeyName,
    className = '',
  }: {
    label: string
    sortKeyName: SortKey
    className?: string
  }) => (
    <th
      className={`text-left px-4 py-3 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-800 transition-colors ${className}`}
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyName &&
          (sortDir === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          ))}
      </span>
    </th>
  )

  /* ---------- render ---------- */

  return (
    <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* ---- Created token banner ---- */}
      <AnimatePresence>
        {lastCreated && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between"
          >
            <div>
              <p className="text-green-800 font-semibold">
                ✓ Created: {lastCreated.participant_id}
              </p>
              <p className="text-green-600 text-sm">
                Give this token to the participant
              </p>
              {lastCreated.entry_url && (
                <p className="text-xs text-green-600 font-mono truncate mt-1">{lastCreated.entry_url}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-mono font-bold text-green-700 tracking-widest select-all">
                {lastCreated.token}
              </span>
              <button
                onClick={() => handleCopyToken(lastCreated.token)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-200 hover:bg-green-300 text-green-800 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copiedToken === lastCreated.token ? 'Copied!' : 'Copy Token'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Overview cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={overview?.total_participants ?? participants.length} icon={Users} color="bg-slate-100 text-slate-600" />
        <StatCard label="In Progress" value={overview?.in_progress ?? 0} icon={Clock} color="bg-blue-100 text-blue-600" badge={onlineCount} />
        <StatCard label="Completed" value={overview?.completed ?? 0} icon={CheckCircle} color="bg-green-100 text-green-600" />
        <StatCard label="Dropped" value={droppedCount} icon={AlertCircle} color="bg-red-100 text-red-600" />
      </div>

      {/* ---- Tab bar + actions ---- */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-1">
          {([
            { id: 'participants' as AdminTab, label: 'Participants', icon: Users },
            { id: 'latin_square' as AdminTab, label: 'Latin Square', icon: BarChart2 },
            { id: 'test_mode' as AdminTab, label: 'Test Mode', icon: FlaskConical },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-cooking-500 text-cooking-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          <ExportDropdown />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-cooking-500 hover:bg-cooking-600 disabled:bg-cooking-200 text-white font-medium rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            {creating ? 'Creating…' : 'New Participant'}
          </button>
          <button
            onClick={() => setShowManualCreate(!showManualCreate)}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              showManualCreate ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            Manual
          </button>
          <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* ---- Manual create form ---- */}
      <AnimatePresence>
        {showManualCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-end gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Condition</label>
                <select value={manualCondition} onChange={(e) => setManualCondition(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="EE1">EE1</option>
                  <option value="EE0">EE0</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Order</label>
                <select value={manualOrder} onChange={(e) => setManualOrder(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {['A', 'B', 'C', 'D'].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <button onClick={handleManualCreate} disabled={manualCreating}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium">
                {manualCreating ? 'Creating…' : 'Create Manual'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Participants filter bar ---- */}
      {activeTab === 'participants' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, token, condition…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cooking-200 focus:border-cooking-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">All statuses</option>
            <option value="registered">Registered</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="dropped">Dropped</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} className="w-4 h-4 rounded" />
            Online only
          </label>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {participants.length}</span>
        </div>
      )}

      {/* ---- Tab content ---- */}
      {activeTab === 'participants' && (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-8" />
                <SortHeader label="ID" sortKeyName="participant_id" />
                <th className="text-left px-4 py-3 font-medium text-slate-600">Token</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Condition</th>
                <SortHeader label="Status" sortKeyName="status" />
                <th className="text-center px-4 py-3 font-medium text-slate-600">Online</th>
                <SortHeader label="Created" sortKeyName="created_at" />
                <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">
                      {participants.length === 0 ? 'No participants yet' : 'No matches'}
                    </p>
                    <p className="text-xs mt-1">
                      {participants.length === 0
                        ? 'Click "New Participant" to create one.'
                        : 'Try adjusting your filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isExpanded = expandedId === p.session_id
                  return (
                    <React.Fragment key={p.session_id}>
                      <tr
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-cooking-50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : p.session_id)}
                      >
                        <td className="pl-3 pr-1 py-3 text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{p.participant_id}</td>
                        <td className="px-4 py-3 font-mono tracking-wider text-cooking-600 text-xs">{p.token}</td>
                        <td className="px-4 py-3 text-slate-600">{p.condition}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.is_online ? <Wifi className="w-4 h-4 text-green-500 mx-auto" /> : <WifiOff className="w-4 h-4 text-slate-300 mx-auto" />}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {p.created_at
                            ? new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button title="Copy Token" onClick={() => handleCopyToken(p.token)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
                              {copiedToken === p.token ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button title="Open Detail Page" onClick={() => navigate(`/admin/participant/${p.session_id}`)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button title="Reset" onClick={() => setConfirmAction({ kind: 'reset', participant: p })}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors">
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            {p.status !== 'dropped' && p.status !== 'completed' && (
                              <button title="Drop" onClick={() => setConfirmAction({ kind: 'drop', participant: p })}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="p-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden border-b border-slate-200 bg-slate-50/50"
                              >
                                <ParticipantDetailView sessionId={p.session_id} />
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'latin_square' && <LatinSquareTab />}
      {activeTab === 'test_mode' && <TestModeTab />}

      {/* ---- Confirmation Modal ---- */}
      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </main>
  )
}
