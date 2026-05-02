/** Feature-rich admin dashboard — overview, sortable table, expandable rows, actions. */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  RadioTower,
} from 'lucide-react'
import {
  createParticipant,
  getAssignmentCounts,
  getLiveSessions,
  exportPerParticipant,
  exportAggregated,
  createTestSession,
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
type AdminTab = 'participants' | 'token_management' | 'latin_square' | 'live_sessions' | 'data_export' | 'test_mode'

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
  if (c === 'CONTROL') return 'bg-slate-100 text-slate-600'
  if (c === 'AF') return 'bg-blue-100 text-blue-700'
  return 'bg-purple-100 text-purple-700'
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
          className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
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
    fetch(`/api/admin/participant/${sessionId}/detail`)
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
/*  Token Management Tab                                              */
/* ------------------------------------------------------------------ */

function TokenManagementTab() {
  const [creating, setCreating] = useState(false)
  const [lastCreated, setLastCreated] = useState<{ participant_id: string; token: string; entry_url?: string; task_order?: string } | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [manualCondition, setManualCondition] = useState<string>('EC+')
  const [manualOrder, setManualOrder] = useState<string>('A')
  const [manualCreating, setManualCreating] = useState(false)
  const [manualResult, setManualResult] = useState<{ participant_id: string; token: string; entry_url?: string } | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/participants')
    if (r.ok) setParticipants(await r.json())
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const result = await createParticipant()
      setLastCreated({ participant_id: result.participant_id, token: result.token, entry_url: result.entry_url, task_order: result.task_order })
      load()
    } catch (e) { console.error(e) }
    setCreating(false)
  }

  const handleManualCreate = async () => {
    setManualCreating(true)
    try {
      const result = await createParticipant({ condition: manualCondition, order: manualOrder })
      setManualResult({ participant_id: result.participant_id, token: result.token, entry_url: result.entry_url })
      load()
    } catch (e) { console.error(e) }
    setManualCreating(false)
  }

  const copy = async (text: string) => {
    await copyToClipboard(text)
    setCopiedToken(text)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Create participant */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-800">Auto-assign participant</p>
          <p className="text-sm text-slate-500">Latin-square assigns condition + order</p>
        </div>
        <button onClick={handleCreate} disabled={creating}
          className="flex items-center gap-2 px-5 py-2 bg-cooking-500 hover:bg-cooking-600 disabled:bg-cooking-200 text-white font-medium rounded-lg transition-colors text-sm">
          <Plus className="w-4 h-4" />
          {creating ? 'Creating…' : 'Create Participant'}
        </button>
      </div>

      {lastCreated && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-2">
          <p className="font-semibold text-green-800">✓ Created: {lastCreated.participant_id}</p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-green-700 tracking-widest">{lastCreated.token}</span>
            <button onClick={() => copy(lastCreated.token)}
              className="text-xs px-2 py-1 bg-green-200 hover:bg-green-300 text-green-800 rounded">
              {copiedToken === lastCreated.token ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {lastCreated.entry_url && (
            <p className="text-xs text-green-600 font-mono truncate">{lastCreated.entry_url}</p>
          )}
        </div>
      )}

      {/* Manual override */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="font-semibold text-slate-800 mb-3">Manual Override</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Condition</label>
            <select value={manualCondition} onChange={(e) => setManualCondition(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              <option value="EC+">EC+</option>
              <option value="EC-">EC-</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Order</label>
            <select value={manualOrder} onChange={(e) => setManualOrder(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              {['A','B','C','D'].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="pt-4">
            <button onClick={handleManualCreate} disabled={manualCreating}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-sm">
              {manualCreating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
        {manualResult && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm">
            <span className="font-medium">{manualResult.participant_id}</span>
            {' — '}
            <span className="font-mono font-bold">{manualResult.token}</span>
            {manualResult.entry_url && <p className="text-xs text-slate-500 truncate mt-1">{manualResult.entry_url}</p>}
          </div>
        )}
      </div>

      {/* Participants table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Token</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Condition</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Copy URL</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.session_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800 text-xs">{p.participant_id}</td>
                <td className="px-4 py-2 font-mono text-xs text-cooking-600">{p.token}</td>
                <td className="px-4 py-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conditionColor(p.condition)}`}>
                    {p.condition}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => copy(`${window.location.origin}/?token=${p.token}`)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

  const conditions = ['EC+', 'EC-']
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
/*  Live Sessions Tab                                                  */
/* ------------------------------------------------------------------ */

function LiveSessionsTab() {
  const [sessions, setSessions] = useState<Array<{
    session_id: string; participant_id: string; condition: string; task_order: string;
    current_phase: string; elapsed_s: number; disconnected_at: number | null;
  }>>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await getLiveSessions()
      setSessions(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <div className="text-slate-400 flex items-center gap-2 p-4"><RefreshCw className="w-4 h-4 animate-spin" /> Loading…</div>

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-medium text-slate-600">Participant</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Condition</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Order</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Phase</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Elapsed</th>
            <th className="text-center px-4 py-3 font-medium text-slate-600">Connection</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-12 text-slate-400">No active sessions</td></tr>
          ) : sessions.map((s) => (
            <tr key={s.session_id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800 text-xs">{s.participant_id}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conditionColor(s.condition)}`}>{s.condition}</span>
              </td>
              <td className="px-4 py-3 text-slate-600 font-medium">{s.task_order}</td>
              <td className="px-4 py-3 text-slate-600 text-xs">{s.current_phase}</td>
              <td className="px-4 py-3 text-slate-600 text-xs">
                {s.elapsed_s > 0 ? `${Math.floor(s.elapsed_s / 60)}m ${s.elapsed_s % 60}s` : '—'}
              </td>
              <td className="px-4 py-3 text-center">
                {s.disconnected_at ? (
                  <span title="Disconnected"><WifiOff className="w-4 h-4 text-red-400 mx-auto" /></span>
                ) : (
                  <span title="Connected"><Wifi className="w-4 h-4 text-green-500 mx-auto" /></span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Data Export Tab                                                    */
/* ------------------------------------------------------------------ */

function DataExportTab() {
  const [includeTest, setIncludeTest] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const download = async (blob: Blob, filename: string) => {
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
      download(blob, `per-participant-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) { console.error(e) }
    setLoading(null)
  }

  const handleAggregated = async () => {
    setLoading('agg')
    try {
      const blob = await exportAggregated(includeTest)
      download(blob, `aggregated-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) { console.error(e) }
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
        <input type="checkbox" id="include-test" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)}
          className="w-4 h-4 rounded" />
        <label htmlFor="include-test" className="text-sm text-slate-700 cursor-pointer">Include test sessions</label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={handlePerParticipant} disabled={loading !== null}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors">
          <Download className="w-5 h-5" />
          {loading === 'per' ? 'Exporting…' : 'Export Per-Participant CSV'}
        </button>
        <button onClick={handleAggregated} disabled={loading !== null}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors">
          <Download className="w-5 h-5" />
          {loading === 'agg' ? 'Exporting…' : 'Export Aggregated CSV'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Test Mode Tab                                                      */
/* ------------------------------------------------------------------ */

function TestModeTab() {
  const [condition, setCondition] = useState('EC+')
  const [order, setOrder] = useState('A')
  const [startPhase, setStartPhase] = useState('welcome')
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<{ session_id: string; token: string; entry_url: string } | null>(null)

  const PHASES = ['welcome', 'consent', 'introduction', 'encoding', 'playing', 'post_questionnaire', 'debrief']

  const handleCreate = async () => {
    setCreating(true)
    try {
      const r = await createTestSession({ condition, order, start_phase: startPhase })
      setResult(r)
    } catch (e) { console.error(e) }
    setCreating(false)
  }

  const handleOpen = () => {
    if (result?.entry_url) window.open(result.entry_url, '_blank', 'noopener,noreferrer')
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
              <option value="EC+">EC+</option>
              <option value="EC-">EC-</option>
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
            <p className="text-xs text-slate-500">Token: <span className="font-mono font-bold text-slate-700">{result.token}</span></p>
            <p className="text-xs font-mono text-slate-500 truncate">{result.entry_url}</p>
            <button onClick={handleOpen}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('participants')
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [creating, setCreating] = useState(false)
  const [lastCreated, setLastCreated] = useState<{
    participant_id: string
    token: string
  } | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [refreshing, setRefreshing] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  /* ---------- data fetching ---------- */

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [pRes, oRes] = await Promise.all([
        fetch('/api/admin/participants'),
        fetch('/api/admin/experiment/overview'),
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
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
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

  /* ---------- actions ---------- */

  const handleCreate = async () => {
    setCreating(true)
    try {
      const result = await createParticipant()
      setLastCreated({ participant_id: result.participant_id, token: result.token })
      refresh()
    } catch (err) {
      console.error('Failed to create participant:', err)
    } finally {
      setCreating(false)
    }
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
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      refresh()
    } catch (err) {
      console.error(`Failed to ${kind} participant:`, err)
    } finally {
      setConfirmAction(null)
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/admin/data/export')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `experiment-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
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
    <div className="min-h-screen bg-slate-50">
      {/* ---- Header ---- */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-slate-800">
              🍳 Cooking for Friends — Dashboard
            </h1>
            <nav className="flex gap-1">
              <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-cooking-100 text-cooking-700">
                Dashboard
              </button>
              <button
                onClick={() => (window.location.href = '/config')}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Config
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2 bg-cooking-500 hover:bg-cooking-600 disabled:bg-cooking-200
                         text-white font-medium rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              {creating ? 'Creating…' : 'New Participant'}
            </button>
            <RefreshCw
              className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`}
            />
          </div>
        </div>

        {/* ---- Tab bar ---- */}
        <div className="max-w-7xl mx-auto px-6 border-t border-slate-100 flex gap-1 overflow-x-auto">
          {([
            { id: 'participants', label: 'Participants', icon: Users },
            { id: 'token_management', label: 'Token Management', icon: Copy },
            { id: 'latin_square', label: 'Latin Square', icon: BarChart2 },
            { id: 'live_sessions', label: 'Live Sessions', icon: RadioTower },
            { id: 'data_export', label: 'Data Export', icon: Download },
            { id: 'test_mode', label: 'Test Mode', icon: FlaskConical },
          ] as { id: AdminTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
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
      </header>

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

        {/* ---- Overview cards (always visible) ---- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total"
            value={overview?.total_participants ?? participants.length}
            icon={Users}
            color="bg-slate-100 text-slate-600"
          />
          <StatCard
            label="In Progress"
            value={overview?.in_progress ?? 0}
            icon={Clock}
            color="bg-blue-100 text-blue-600"
            badge={onlineCount}
          />
          <StatCard
            label="Completed"
            value={overview?.completed ?? 0}
            icon={CheckCircle}
            color="bg-green-100 text-green-600"
          />
          <StatCard
            label="Dropped"
            value={droppedCount}
            icon={AlertCircle}
            color="bg-red-100 text-red-600"
          />
        </div>

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
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No participants yet</p>
                    <p className="text-xs mt-1">
                      Click "New Participant" to create one.
                    </p>
                  </td>
                </tr>
              ) : (
                sorted.map((p) => {
                  const isExpanded = expandedId === p.session_id
                  return (
                    <React.Fragment key={p.session_id}>
                      {/* Main row */}
                      <tr
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-cooking-50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() =>
                          setExpandedId(isExpanded ? null : p.session_id)
                        }
                      >
                        <td className="pl-3 pr-1 py-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {p.participant_id}
                        </td>
                        <td className="px-4 py-3 font-mono tracking-wider text-cooking-600 text-xs">
                          {p.token}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.condition}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge(p.status)}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.is_online ? (
                            <Wifi className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {p.created_at
                            ? new Date(p.created_at).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex items-center justify-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              title="Copy Token"
                              onClick={() => handleCopyToken(p.token)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              {copiedToken === p.token ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              title="Open Detail Page"
                              onClick={() => (window.location.href = `/admin/participant/${p.session_id}`)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              title="Reset"
                              onClick={() =>
                                setConfirmAction({ kind: 'reset', participant: p })
                              }
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            {p.status !== 'dropped' && p.status !== 'completed' && (
                              <button
                                title="Drop"
                                onClick={() =>
                                  setConfirmAction({ kind: 'drop', participant: p })
                                }
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="p-0">
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

        {activeTab === 'token_management' && <TokenManagementTab />}
        {activeTab === 'latin_square' && <LatinSquareTab />}
        {activeTab === 'live_sessions' && <LiveSessionsTab />}
        {activeTab === 'data_export' && <DataExportTab />}
        {activeTab === 'test_mode' && <TestModeTab />}
      </main>

      {/* ---- Confirmation Modal ---- */}
      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
