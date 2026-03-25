/** Experiment configuration viewer — read-only display of all config, tasks, reminders, assignments. */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  Database,
  Grid3X3,
  MessageSquare,
  Download,
  Layers,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ── Types ──

interface ExperimentConfig {
  experiment: {
    blocks_per_participant: number
    pm_tasks_per_block: number
    block_duration_s: number
    execution_window_s: number
    late_window_s: number
    reminder_lead_s: number
  }
  phone: { lock_timeout_s: number }
  mouse_tracking: { sample_interval_ms: number; batch_interval_s: number }
  system: {
    snapshot_interval_s: number
    heartbeat_interval_s: number
    heartbeat_timeout_s: number
    token_length: number
  }
  latin_square: Record<string, string[]>
  groups: string[]
}

interface PMTask {
  task_id: string
  trigger_type: string
  trigger_event: string
  target_room: string
  target_object: string
  target_action: string
  distractor_object: string
  action_destination: string
  discriminating_cue: string
  trigger_time: number | null
  trigger_audio: string
  trigger_visual: string
  encoding_text: string
  activity_watch?: { watch_from: string; fallback_s: number }
}

interface Reminder {
  id: string
  task_type: string
  condition: string
  context_activity: string
  text: string
  is_placeholder: boolean
}

interface Assignment {
  participant_id: string
  group: string
  condition_order: string[]
  blocks: { block_number: number; condition: string; unreminded_task: string }[]
}

// ── Helpers ──

function formatSeconds(s: number): string {
  if (s >= 3600) return `${s}s (${(s / 3600).toFixed(1)} hr)`
  if (s >= 60) return `${s}s (${Math.round(s / 60)} min)`
  return `${s}s`
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${ms}ms (${ms / 1000}s)`
  return `${ms}ms`
}

const conditionBadge = (c: string) => {
  switch (c) {
    case 'CONTROL':
      return 'bg-slate-100 text-slate-600'
    case 'AF':
      return 'bg-blue-100 text-blue-700'
    case 'AFCB':
      return 'bg-purple-100 text-purple-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

// ── Collapsible Section ──

function Section({
  id,
  icon: Icon,
  title,
  subtitle,
  defaultOpen = false,
  onExpand,
  children,
}: {
  id: string
  icon: React.ElementType
  title: string
  subtitle?: string
  defaultOpen?: boolean
  onExpand?: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && onExpand) onExpand()
  }

  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-cooking-500" />
          <div className="text-left">
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={`${id}-content`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Component ──

export default function ConfigPage() {
  const [config, setConfig] = useState<ExperimentConfig | null>(null)
  const [tasks, setTasks] = useState<Record<string, PMTask[]> | null>(null)
  const [reminders, setReminders] = useState<Reminder[] | null>(null)
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false)
  const [activeBlock, setActiveBlock] = useState('1')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load config, tasks, reminders on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/admin/config').then((r) => r.json()),
      fetch('/api/admin/tasks').then((r) => r.json()),
      fetch('/api/admin/reminders').then((r) => r.json()),
    ])
      .then(([cfg, tsk, rem]) => {
        setConfig(cfg)
        setTasks(tsk)
        setReminders(rem)
      })
      .catch((err) => setError(err.message))
  }, [])

  // Lazy-load assignments
  const loadAssignments = useCallback(() => {
    if (assignmentsLoaded) return
    fetch('/api/admin/assignments')
      .then((r) => r.json())
      .then((data) => {
        setAssignments(data)
        setAssignmentsLoaded(true)
      })
      .catch((err) => console.error('Failed to load assignments:', err))
  }, [assignmentsLoaded])

  // Data export
  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/data/export')
      const data = await res.json()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const a = document.createElement('a')
      a.href = url
      a.download = `experiment_data_${ts}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 text-center max-w-md">
          <p className="text-red-500 font-medium mb-2">Failed to load configuration</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!config || !tasks || !reminders) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading configuration…</div>
      </div>
    )
  }

  const { experiment, phone, mouse_tracking, system, latin_square, groups } = config

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              🍳 Cooking for Friends — Configuration
            </h1>
            <p className="text-sm text-slate-500">
              Read-only view of experiment parameters, tasks, and reminders
            </p>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow border border-slate-200 p-1 w-fit">
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700
                       rounded-lg hover:bg-slate-50 transition-colors"
          >
            Dashboard
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-cooking-500 rounded-lg"
          >
            Config
          </button>
        </div>

        {/* Section 1: Experiment Parameters */}
        <Section id="params" icon={Settings} title="Experiment Parameters" subtitle="Timing, tracking, and system settings" defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ParamCard title="Experiment" icon={Layers} params={[
              ['Blocks per Participant', String(experiment.blocks_per_participant)],
              ['PM Tasks per Block', String(experiment.pm_tasks_per_block)],
              ['Block Duration', formatSeconds(experiment.block_duration_s)],
              ['Execution Window', formatSeconds(experiment.execution_window_s)],
              ['Late Window', formatSeconds(experiment.late_window_s)],
              ['Reminder Lead Time', formatSeconds(experiment.reminder_lead_s)],
            ]} />
            <ParamCard title="Phone" icon={Clock} params={[
              ['Lock Timeout', formatSeconds(phone.lock_timeout_s)],
            ]} />
            <ParamCard title="Mouse Tracking" icon={Grid3X3} params={[
              ['Sample Interval', formatMs(mouse_tracking.sample_interval_ms)],
              ['Batch Interval', formatSeconds(mouse_tracking.batch_interval_s)],
            ]} />
            <ParamCard title="System" icon={Database} params={[
              ['Snapshot Interval', formatSeconds(system.snapshot_interval_s)],
              ['Heartbeat Interval', formatSeconds(system.heartbeat_interval_s)],
              ['Heartbeat Timeout', formatSeconds(system.heartbeat_timeout_s)],
              ['Token Length', `${system.token_length} chars`],
            ]} />
          </div>
        </Section>

        {/* Section 2: Latin Square */}
        <Section id="latin" icon={Grid3X3} title="Latin Square" subtitle={`${groups.length} groups × ${experiment.blocks_per_participant} blocks`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Group</th>
                  {Array.from({ length: experiment.blocks_per_participant }, (_, i) => (
                    <th key={i} className="text-left px-4 py-3 font-medium text-slate-600">
                      Block {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-700">{g}</td>
                    {(latin_square[g] || []).map((cond, i) => (
                      <td key={i} className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${conditionBadge(cond)}`}>
                          {cond}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Section 3: PM Task Registry */}
        <Section id="tasks" icon={Layers} title="PM Task Registry" subtitle={`${Object.values(tasks).flat().length} tasks across ${Object.keys(tasks).length} blocks`}>
          {/* Block tabs */}
          <div className="flex gap-1 mb-4">
            {Object.keys(tasks).sort().map((blockNum) => (
              <button
                key={blockNum}
                onClick={() => setActiveBlock(blockNum)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeBlock === blockNum
                    ? 'bg-cooking-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Block {blockNum}
              </button>
            ))}
          </div>

          {/* Task cards */}
          <div className="grid gap-3">
            {(tasks[activeBlock] || []).map((task) => (
              <div key={task.task_id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-700">
                      {task.task_id}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      task.trigger_type === 'time'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {task.trigger_type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{task.trigger_visual}</span>
                </div>

                <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                  {task.encoding_text}
                </p>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                  <span>
                    <span className="font-medium text-slate-600">Room:</span> {task.target_room}
                  </span>
                  <span>
                    <span className="font-medium text-slate-600">Object:</span> {task.target_object}
                  </span>
                  <span>
                    <span className="font-medium text-slate-600">Action:</span> {task.target_action}
                  </span>
                  {task.trigger_type === 'time' && task.trigger_time !== null && (
                    <span>
                      <span className="font-medium text-slate-600">Trigger:</span>{' '}
                      {formatSeconds(task.trigger_time)}
                    </span>
                  )}
                  {task.trigger_type === 'activity' && task.activity_watch && (
                    <span>
                      <span className="font-medium text-slate-600">Watch:</span>{' '}
                      {task.activity_watch.watch_from} (fallback {task.activity_watch.fallback_s}s)
                    </span>
                  )}
                  {task.trigger_event && (
                    <span>
                      <span className="font-medium text-slate-600">Event:</span> {task.trigger_event}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Section 4: Reminders */}
        <Section id="reminders" icon={MessageSquare} title="Reminders" subtitle={`${reminders.length} reminder messages`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Task Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Condition</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Text</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Placeholder</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{r.task_type}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${conditionBadge(r.condition)}`}>
                        {r.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-md" title={r.text}>
                      {r.text.length > 80 ? `${r.text.slice(0, 80)}…` : r.text}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.is_placeholder && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          placeholder
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Section 5: Counterbalancing Assignments (lazy) */}
        <Section
          id="assignments"
          icon={Database}
          title="Counterbalancing Assignments"
          subtitle="Participant → group → condition mapping"
          onExpand={loadAssignments}
        >
          {!assignmentsLoaded ? (
            <div className="text-sm text-slate-400 py-4 text-center">Loading assignments…</div>
          ) : assignments && assignments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Participant</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Group</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Conditions</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Unreminded Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.participant_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{a.participant_id}</td>
                      <td className="px-4 py-3">{a.group}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {a.condition_order.map((c, i) => (
                            <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${conditionBadge(c)}`}>
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {a.blocks.map((b) => (
                            <span key={b.block_number} className="text-xs text-slate-500 font-mono">
                              B{b.block_number}: {b.unreminded_task || '—'}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-400 py-4 text-center">No assignments found.</div>
          )}
        </Section>

        {/* Section 6: Data Export */}
        <Section id="export" icon={Download} title="Data Export" subtitle="Download full experiment dataset">
          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-6 py-2.5 bg-cooking-500 hover:bg-cooking-600
                         disabled:bg-cooking-200 text-white font-medium rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting…' : 'Export All Data'}
            </button>
            <p className="text-sm text-slate-500">
              Downloads a JSON file with all participants, blocks, events, and PM outcomes.
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ── Sub-components ──

function ParamCard({
  title,
  icon: Icon,
  params,
}: {
  title: string
  icon: React.ElementType
  params: [string, string][]
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-cooking-400" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="space-y-1.5">
        {params.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-mono text-slate-700">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
