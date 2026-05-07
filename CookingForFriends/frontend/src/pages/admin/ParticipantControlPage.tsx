/** Participant Control Page — full detail view with logs, attempts, and admin controls. */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Types ────────────────────────────────────────────── */

interface ParticipantDetail {
  session_id: string
  participant_id: string
  condition: string
  status: string
  token: string
  is_online: boolean
  created_at: string | null
  blocks: BlockDetail[]
}

interface BlockDetail {
  block_number: number
  condition: string
  status: string
  day_story: string
  trials: TrialDetail[]
}

interface TrialDetail {
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

interface InteractionLog {
  id: number
  block_id: number
  timestamp: number
  event_type: string
  event_data: Record<string, unknown> | null
  room: string | null
}

interface PhoneLog {
  id: number
  block_id: number
  message_id: string
  sender: string
  message_type: string
  category: string
  sent_at: number
  read_at: number | null
  replied_at: number | null
  user_choice: number | null
  correct_answer: number | null
  reply_correct: boolean | null
  response_time_ms: number | null
  status: string | null
}

interface PMAttempt {
  id: number
  trial_id: number
  block_id: number
  trigger_fired_at: number
  trigger_received_at: number | null
  first_action_time: number | null
  first_room_switch_at: number | null
  first_pm_room_entered_at: number | null
  target_selected_at: number | null
  action_completed_at: number | null
  room_sequence: string[] | null
  room: string | null
  target_selected: string | null
  action_performed: string | null
  action_correct: boolean | null
  total_elapsed_ms: number | null
  score: number | null
}

interface Snapshot {
  id: number
  block_id: number
  timestamp: number
  state: Record<string, unknown>
}

/* ── Helpers ──────────────────────────────────────────── */

const API = '/api/admin'

async function safeFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function safePost<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `${res.status} ${res.statusText}`)
  }
  return res.json()
}

function fmtEpoch(epoch: number | null): string {
  if (!epoch) return '—'
  const d = new Date(epoch * 1000)
  const base = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${base}.${ms}`
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

const STATUS_COLORS: Record<string, string> = {
  registered: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  dropped: 'bg-red-100 text-red-700',
  pending: 'bg-slate-100 text-slate-600',
  encoding: 'bg-purple-100 text-purple-700',
  playing: 'bg-blue-100 text-blue-700',
  microbreak: 'bg-amber-100 text-amber-700',
}

const CONDITION_COLORS: Record<string, string> = {
  'EC+': 'bg-blue-100 text-blue-700',
  'EC-': 'bg-amber-100 text-amber-700',
}

type TabKey = 'overview' | 'logs' | 'phone' | 'pm' | 'snapshots'

/* ── Main Component ───────────────────────────────────── */

export default function ParticipantControlPage({ participantId }: { participantId: string }) {
  const [detail, setDetail] = useState<ParticipantDetail | null>(null)
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [phoneLogs, setPhoneLogs] = useState<PhoneLog[]>([])
  const [pmAttempts, setPmAttempts] = useState<PMAttempt[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState('')
  const [logBlockFilter, setLogBlockFilter] = useState<number | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const d = await safeFetch<ParticipantDetail>(`${API}/participant/${participantId}/detail`)
      setDetail(d)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [participantId])

  // Load on mount and auto-refresh every 5s
  useEffect(() => {
    loadData()
    refreshRef.current = setInterval(loadData, 5000)
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [loadData])

  // Load tab-specific data on tab change
  useEffect(() => {
    if (activeTab === 'logs' && logs.length === 0) {
      safeFetch<InteractionLog[]>(`${API}/participant/${participantId}/logs`).then(setLogs).catch(() => {})
    }
    if (activeTab === 'phone' && phoneLogs.length === 0) {
      safeFetch<PhoneLog[]>(`${API}/participant/${participantId}/phone-logs`).then(setPhoneLogs).catch(() => {})
    }
    if (activeTab === 'pm' && pmAttempts.length === 0) {
      safeFetch<PMAttempt[]>(`${API}/participant/${participantId}/pm-attempts`).then(setPmAttempts).catch(() => {})
    }
    if (activeTab === 'snapshots' && snapshots.length === 0) {
      safeFetch<Snapshot[]>(`${API}/participant/${participantId}/snapshots`).then(setSnapshots).catch(() => {})
    }
  }, [activeTab, participantId])

  const refreshTab = useCallback(async () => {
    if (activeTab === 'logs') {
      safeFetch<InteractionLog[]>(`${API}/participant/${participantId}/logs`).then(setLogs)
    } else if (activeTab === 'phone') {
      safeFetch<PhoneLog[]>(`${API}/participant/${participantId}/phone-logs`).then(setPhoneLogs)
    } else if (activeTab === 'pm') {
      safeFetch<PMAttempt[]>(`${API}/participant/${participantId}/pm-attempts`).then(setPmAttempts)
    } else if (activeTab === 'snapshots') {
      safeFetch<Snapshot[]>(`${API}/participant/${participantId}/snapshots`).then(setSnapshots)
    }
    await loadData()
  }, [activeTab, participantId, loadData])

  const doAction = useCallback(async (label: string, url: string) => {
    try {
      setActionMsg(`${label}…`)
      await safePost(url)
      setActionMsg(`✓ ${label} succeeded`)
      await loadData()
      // Reload tab data
      setTimeout(refreshTab, 500)
    } catch (e: unknown) {
      setActionMsg(`✗ ${label}: ${e instanceof Error ? e.message : 'failed'}`)
    }
    setTimeout(() => setActionMsg(null), 4000)
  }, [loadData, refreshTab])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading participant…</div>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-6 max-w-md text-center">
          <p className="text-red-500 font-medium mb-2">Error loading participant</p>
          <p className="text-slate-500 text-sm">{error || 'Unknown error'}</p>
          <a href="/admin" className="inline-block mt-4 text-blue-600 hover:underline text-sm">← Back to Dashboard</a>
        </div>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: '📋 Overview' },
    { key: 'logs', label: '📝 Interaction Logs', count: logs.length },
    { key: 'phone', label: '📱 Phone Messages', count: phoneLogs.length },
    { key: 'pm', label: '🎯 PM Attempts', count: pmAttempts.length },
    { key: 'snapshots', label: '📸 Snapshots', count: snapshots.length },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/admin" className="text-slate-400 hover:text-slate-600 transition-colors">
                ← Dashboard
              </a>
              <div>
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  {detail.participant_id}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[detail.status] || ''}`}>
                    {detail.status}
                  </span>
                  {detail.is_online && (
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" title="Online" />
                  )}
                </h1>
                <p className="text-sm text-slate-500">
                  Condition: {detail.condition} · Token <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{detail.token}</code>
                </p>
              </div>
            </div>

            {/* Admin Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => doAction('Force Trigger', `${API}/participant/${participantId}/force-trigger`)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                ⚡ Force Trigger
              </button>
              <button
                onClick={() => doAction('Send Message', `${API}/participant/${participantId}/send-message`)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                💬 Send Message
              </button>
              <button
                onClick={() => doAction('Advance Block', `${API}/participant/${participantId}/advance-block`)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
              >
                ⏭ Advance Block
              </button>
              <button
                onClick={() => { if (confirm('Reset all progress?')) doAction('Reset', `${API}/participant/${participantId}/reset`) }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
              >
                🔄 Reset
              </button>
              <button
                onClick={() => { if (confirm('Drop this participant?')) doAction('Drop', `${API}/participant/${participantId}/drop`) }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                🚫 Drop
              </button>
            </div>
          </div>

          {/* Action feedback */}
          <AnimatePresence>
            {actionMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-2 text-sm font-medium px-3 py-1.5 rounded-lg inline-block ${
                  actionMsg.startsWith('✓') ? 'bg-green-50 text-green-700' :
                  actionMsg.startsWith('✗') ? 'bg-red-50 text-red-700' :
                  'bg-blue-50 text-blue-700'
                }`}
              >
                {actionMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-1 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={refreshTab}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 px-3 py-2"
            title="Refresh"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {activeTab === 'overview' && <OverviewTab detail={detail} />}
        {activeTab === 'logs' && (
          <LogsTab
            logs={logs}
            filter={logFilter}
            setFilter={setLogFilter}
            blockFilter={logBlockFilter}
            setBlockFilter={setLogBlockFilter}
            blocks={detail.blocks}
          />
        )}
        {activeTab === 'phone' && <PhoneTab logs={phoneLogs} />}
        {activeTab === 'pm' && <PMAttemptsTab attempts={pmAttempts} detail={detail} />}
        {activeTab === 'snapshots' && <SnapshotsTab snapshots={snapshots} />}
      </div>
    </div>
  )
}

/* ── Overview Tab ─────────────────────────────────────── */

function OverviewTab({ detail }: { detail: ParticipantDetail }) {
  return (
    <div className="space-y-4">
      {/* Info cards */}
      <div className="grid grid-cols-4 gap-4">
        <InfoCard label="Session ID" value={detail.session_id} mono />
        <InfoCard label="Created" value={fmtDate(detail.created_at)} />
        <InfoCard label="Condition" value={detail.condition} />
        <InfoCard label="Status" value={detail.status} />
      </div>

      {/* Blocks */}
      <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-3">Blocks & PM Trials</h3>
      <div className="grid grid-cols-3 gap-4">
        {detail.blocks.map((block) => (
          <div key={block.block_number} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800">Block {block.block_number}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${CONDITION_COLORS[block.condition] || ''}`}>
                  {block.condition}
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[block.status] || 'bg-slate-100 text-slate-600'}`}>
                {block.status}
              </span>
            </div>
            <div className="px-4 py-2 text-xs text-slate-500">{block.day_story}</div>
            <div className="divide-y divide-slate-50">
              {block.trials.map((t) => (
                <div key={t.id} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">T{t.trial_number}</span>
                    <span className="text-slate-700">{t.task_id || '—'}</span>
                    {t.has_reminder && <span className="text-xs text-indigo-600">📢</span>}
                    {t.is_filler && <span className="text-xs text-slate-400">filler</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.score != null ? (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        t.score >= 5 ? 'bg-green-100 text-green-700' :
                        t.score >= 3 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{t.score}/6</span>
                    ) : t.trigger_fired_at ? (
                      <span className="text-xs text-amber-500">⏱ triggered</span>
                    ) : (
                      <span className="text-xs text-slate-300">○</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Logs Tab ─────────────────────────────────────────── */

function LogsTab({
  logs, filter, setFilter, blockFilter, setBlockFilter, blocks,
}: {
  logs: InteractionLog[]
  filter: string
  setFilter: (v: string) => void
  blockFilter: number | null
  setBlockFilter: (v: number | null) => void
  blocks: BlockDetail[]
}) {
  const blockIds = new Map(blocks.map((b) => [b.block_number, b]))

  const filtered = logs.filter((l) => {
    if (blockFilter != null) {
      const block = blocks.find((b) => {
        // We need block_id to block_number mapping — approximate by position
        return blocks.indexOf(b) + 1 === blockFilter
      })
      // If we don't have block_id mapping, just show all
      if (block && l.block_id !== 0) {
        // best-effort filter
      }
    }
    if (filter) {
      const q = filter.toLowerCase()
      return (
        l.event_type.toLowerCase().includes(q) ||
        l.room?.toLowerCase().includes(q) ||
        JSON.stringify(l.event_data || {}).toLowerCase().includes(q)
      )
    }
    return true
  })

  // Event type color coding
  const typeColor = (t: string): string => {
    if (t.includes('pm_') || t.includes('trigger')) return 'text-purple-700 bg-purple-50'
    if (t.includes('phone') || t.includes('message')) return 'text-blue-700 bg-blue-50'
    if (t.includes('steak') || t.includes('kitchen')) return 'text-orange-700 bg-orange-50'
    if (t.includes('dining') || t.includes('table')) return 'text-green-700 bg-green-50'
    if (t.includes('room')) return 'text-cyan-700 bg-cyan-50'
    return 'text-slate-700 bg-slate-50'
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by event type, room, or data…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <span className="text-xs text-slate-400">{filtered.length} of {logs.length} events</span>
      </div>

      {/* Logs table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs table-fixed">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-slate-500 font-medium w-[100px]">Time</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium w-[150px]">Event Type</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium w-[80px]">Room</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-1.5 font-mono text-slate-500">{fmtEpoch(log.timestamp)}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${typeColor(log.event_type)}`}>
                      {log.event_type}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">{log.room || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500 truncate max-w-0">
                    <span title={JSON.stringify(log.event_data, null, 2)}>
                      {log.event_data ? JSON.stringify(log.event_data) : '—'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    {logs.length === 0 ? 'No interaction logs yet' : 'No logs match filter'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── Phone Messages Tab ───────────────────────────────── */

function PhoneTab({ logs }: { logs: PhoneLog[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-xs table-fixed">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-slate-500 font-medium w-[90px]">Sent</th>
              <th className="px-3 py-2 text-left text-slate-500 font-medium w-[80px]">Sender</th>
              <th className="px-3 py-2 text-left text-slate-500 font-medium w-[80px]">Type</th>
              <th className="px-3 py-2 text-left text-slate-500 font-medium w-[60px]">Msg ID</th>
              <th className="px-3 py-2 text-left text-slate-500 font-medium w-[80px]">Read</th>
              <th className="px-3 py-2 text-left text-slate-500 font-medium w-[80px]">Replied</th>
              <th className="px-3 py-2 text-left text-slate-500 font-medium">Reply</th>
              <th className="px-3 py-2 text-center text-slate-500 font-medium w-[50px]">✓</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-1.5 font-mono text-slate-500">{fmtEpoch(log.sent_at)}</td>
                <td className="px-3 py-1.5 text-slate-700 truncate">{log.sender}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                    log.message_type === 'question' ? 'bg-blue-50 text-blue-700' :
                    log.message_type === 'pm_trigger' ? 'bg-purple-50 text-purple-700' :
                    'bg-slate-50 text-slate-700'
                  }`}>
                    {log.message_type}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono text-slate-400 truncate">{log.message_id}</td>
                <td className="px-3 py-1.5 font-mono text-slate-500">
                  {log.read_at ? fmtEpoch(log.read_at) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 font-mono text-slate-500">
                  {log.replied_at ? fmtEpoch(log.replied_at) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 text-slate-600 truncate">
                  {log.user_choice !== null ? `Choice ${log.user_choice}` : '—'}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {log.reply_correct === true ? '✅' : log.reply_correct === false ? '❌' : '—'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">No phone messages logged</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── PM Attempts Tab ──────────────────────────────────── */

function PMAttemptsTab({ attempts, detail }: { attempts: PMAttempt[]; detail: ParticipantDetail }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  // Build trial→task mapping from detail blocks
  const trialMap = new Map<number, { task_id: string; block: number; condition: string }>()
  for (const block of detail.blocks) {
    for (const trial of block.trials) {
      trialMap.set(trial.id, {
        task_id: trial.task_id,
        block: block.block_number,
        condition: block.condition,
      })
    }
  }

  return (
    <div className="space-y-3">
      {attempts.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
          No PM attempts recorded yet
        </div>
      )}
      {attempts.map((a) => {
        const trial = trialMap.get(a.trial_id)
        const isExpanded = expanded === a.id
        return (
          <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : a.id)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">#{a.trial_id}</span>
                <span className="font-medium text-slate-700">{trial?.task_id || '—'}</span>
                {trial && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CONDITION_COLORS[trial.condition] || ''}`}>
                    B{trial.block} · {trial.condition}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {a.action_correct === true && <span className="text-green-600 text-xs font-medium">✓ Correct</span>}
                {a.action_correct === false && <span className="text-red-600 text-xs font-medium">✗ Incorrect</span>}
                {a.score != null && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    a.score >= 5 ? 'bg-green-100 text-green-700' :
                    a.score >= 3 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{a.score}/6</span>
                )}
                <span className="text-xs text-slate-400">{fmtDuration(a.total_elapsed_ms)}</span>
                <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-100 overflow-hidden"
                >
                  <div className="px-4 py-3 grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <h4 className="font-semibold text-slate-600 mb-2">⏱ Timing</h4>
                      <dl className="space-y-1">
                        <TimingRow label="Trigger fired" value={fmtEpoch(a.trigger_fired_at)} />
                        <TimingRow label="Trigger received" value={fmtEpoch(a.trigger_received_at)} />
                        <TimingRow label="First action" value={fmtEpoch(a.first_action_time)} />
                        <TimingRow label="First room switch" value={fmtEpoch(a.first_room_switch_at)} />
                        <TimingRow label="Entered PM room" value={fmtEpoch(a.first_pm_room_entered_at)} />
                        <TimingRow label="Target selected" value={fmtEpoch(a.target_selected_at)} />
                        <TimingRow label="Action completed" value={fmtEpoch(a.action_completed_at)} />
                      </dl>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-600 mb-2">🎯 Execution</h4>
                      <dl className="space-y-1">
                        <TimingRow label="Room" value={a.room || '—'} />
                        <TimingRow label="Target selected" value={a.target_selected || '—'} />
                        <TimingRow label="Action performed" value={a.action_performed || '—'} />
                        <TimingRow label="Correct" value={a.action_correct == null ? '—' : a.action_correct ? 'Yes' : 'No'} />
                        <TimingRow label="Total elapsed" value={fmtDuration(a.total_elapsed_ms)} />
                        <TimingRow label="Score" value={a.score != null ? `${a.score}/6` : '—'} />
                      </dl>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-600 mb-2">🗺️ Room Sequence</h4>
                      {a.room_sequence && a.room_sequence.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {a.room_sequence.map((r, i) => (
                            <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 text-xs">
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">No navigation recorded</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/* ── Snapshots Tab ────────────────────────────────────── */

function SnapshotsTab({ snapshots }: { snapshots: Snapshot[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {snapshots.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
          No game state snapshots yet
        </div>
      )}
      {snapshots.map((s) => (
        <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-50 text-sm"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-slate-400">#{s.id}</span>
              <span className="text-slate-700">{fmtEpoch(s.timestamp)}</span>
              <span className="text-xs text-slate-400">Block {s.block_id}</span>
            </div>
            <span className="text-slate-400 text-xs">{expanded === s.id ? '▲' : '▼'}</span>
          </button>
          <AnimatePresence>
            {expanded === s.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-100 overflow-hidden"
              >
                <pre className="px-4 py-3 text-xs text-slate-600 overflow-x-auto bg-slate-50 max-h-[300px] overflow-y-auto">
                  {JSON.stringify(s.state, null, 2)}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

/* ── Reusable Components ──────────────────────────────── */

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-sm font-medium text-slate-800 ${mono ? 'font-mono text-xs' : ''} truncate`}>{value}</div>
    </div>
  )
}

function TimingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono text-slate-700">{value}</dd>
    </div>
  )
}
