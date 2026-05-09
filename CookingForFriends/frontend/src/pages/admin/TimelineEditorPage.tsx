/** Runtime plan editor — edits the active gameplay schedule lanes. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle,
  Clock,
  Flame,
  MessageSquare,
  Phone,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'

const API = '/api/admin/timelines'

type PMEntry =
  | { type: 'real'; delay_after_previous_s: number; task_position: number }
  | { type: 'fake'; delay_after_previous_s: number; trigger_type: 'doorbell' | 'phone_call' }

interface CookingEntry {
  t: number
  dish_id: string
  step_index: number
  step_type: 'active' | 'wait'
}

interface RobotCommentEntry {
  t: number
  comment_id: string
  text: string
}

interface PhoneMessageEntry {
  t: number
  message_id: string
}

interface RuntimePlan {
  version: number
  duration_seconds: number
  clock_end_seconds: number
  pm_schedule: PMEntry[]
  session_end_delay_after_last_trigger_s: number
  cooking_schedule: CookingEntry[]
  robot_idle_comments: RobotCommentEntry[]
  phone_messages: PhoneMessageEntry[]
}

type LaneKey = 'pm_schedule' | 'cooking_schedule' | 'robot_idle_comments' | 'phone_messages'

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = body.detail
    if (typeof detail === 'object' && Array.isArray(detail.errors)) throw new Error(detail.errors.join('; '))
    if (Array.isArray(body.errors)) throw new Error(body.errors.join('; '))
    throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`)
  }
  return res.json()
}

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function percentAt(seconds: number, duration: number): number {
  if (duration <= 0) return 0
  return Math.max(0, Math.min(100, (seconds / duration) * 100))
}

function pmAbsoluteTimes(entries: PMEntry[]): number[] {
  let elapsed = 0
  return entries.map((entry) => {
    elapsed += entry.delay_after_previous_s
    return elapsed
  })
}

export default function TimelineEditorPage() {
  const [plan, setPlan] = useState<RuntimePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<RuntimePlan>(`${API}/runtime-plan`)
      .then((data) => {
        setPlan(data)
        setDirty(false)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const sortedPlan = useMemo(() => {
    if (!plan) return null
    return {
      ...plan,
      cooking_schedule: [...plan.cooking_schedule].sort((a, b) => a.t - b.t),
      robot_idle_comments: [...plan.robot_idle_comments].sort((a, b) => a.t - b.t),
      phone_messages: [...plan.phone_messages].sort((a, b) => a.t - b.t),
    }
  }, [plan])

  const patchPlan = useCallback((patch: Partial<RuntimePlan>) => {
    setPlan((current) => current ? { ...current, ...patch } : current)
    setDirty(true)
  }, [])

  const replaceLane = useCallback(<K extends LaneKey>(lane: K, items: RuntimePlan[K]) => {
    setPlan((current) => current ? { ...current, [lane]: items } : current)
    setDirty(true)
  }, [])

  const updateLaneItem = useCallback(<K extends LaneKey>(
    lane: K,
    index: number,
    patch: Partial<RuntimePlan[K][number]>,
  ) => {
    if (!plan) return
    const items = [...plan[lane]] as RuntimePlan[K]
    items[index] = { ...items[index], ...patch } as RuntimePlan[K][number]
    replaceLane(lane, items)
  }, [plan, replaceLane])

  const deleteLaneItem = useCallback(<K extends LaneKey>(lane: K, index: number) => {
    if (!plan) return
    replaceLane(lane, plan[lane].filter((_, i) => i !== index) as RuntimePlan[K])
  }, [plan, replaceLane])

  const save = useCallback(async () => {
    if (!plan) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`${API}/runtime-plan`, {
        method: 'PUT',
        body: JSON.stringify(plan),
      })
      const reloaded = await apiFetch<RuntimePlan>(`${API}/runtime-plan`)
      setPlan(reloaded)
      setDirty(false)
      setSuccess('Runtime plan saved.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [plan])

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-500">Loading runtime plan...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-slate-400 hover:text-slate-700" aria-label="Back to dashboard">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-slate-800">Runtime Plan</h1>
            {dirty && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Unsaved</span>}
          </div>
          <button
            onClick={save}
            disabled={!plan || saving || !dirty}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-3 px-4 py-4">
        {error && (
          <Alert kind="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert kind="success">
            {success}
          </Alert>
        )}

        {!plan || !sortedPlan ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">Runtime plan failed to load.</div>
        ) : (
          <>
            <section className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-end gap-3">
                <NumberField
                  label="Duration"
                  value={plan.duration_seconds}
                  onChange={(value) => patchPlan({ duration_seconds: value })}
                />
                <NumberField
                  label="Clock End"
                  value={plan.clock_end_seconds}
                  onChange={(value) => patchPlan({ clock_end_seconds: value })}
                />
                <NumberField
                  label="End Delay"
                  value={plan.session_end_delay_after_last_trigger_s}
                  onChange={(value) => patchPlan({ session_end_delay_after_last_trigger_s: value })}
                />
                <div className="flex items-end text-sm text-slate-500">
                  <Clock size={16} className="mr-2" />
                  {formatTime(plan.duration_seconds)}
                </div>
              </div>
            </section>

            <TimelineOverview plan={sortedPlan} />

            <PMScheduleSection
              entries={plan.pm_schedule}
              onAdd={() => replaceLane('pm_schedule', [...plan.pm_schedule, { type: 'real', delay_after_previous_s: 60, task_position: 1 }])}
              onDelete={(index) => deleteLaneItem('pm_schedule', index)}
              onUpdate={(index, patch) => updateLaneItem('pm_schedule', index, patch)}
            />

            <CookingScheduleSection
              entries={sortedPlan.cooking_schedule}
              originalEntries={plan.cooking_schedule}
              onAdd={() => replaceLane('cooking_schedule', [...plan.cooking_schedule, { t: 0, dish_id: 'roasted_vegetables', step_index: 0, step_type: 'active' }])}
              onDelete={(index) => deleteLaneItem('cooking_schedule', index)}
              onUpdate={(index, patch) => updateLaneItem('cooking_schedule', index, patch)}
            />

            <RobotCommentsSection
              entries={sortedPlan.robot_idle_comments}
              originalEntries={plan.robot_idle_comments}
              onAdd={() => replaceLane('robot_idle_comments', [...plan.robot_idle_comments, { t: 0, comment_id: 'new_comment', text: '' }])}
              onDelete={(index) => deleteLaneItem('robot_idle_comments', index)}
              onUpdate={(index, patch) => updateLaneItem('robot_idle_comments', index, patch)}
            />

            <PhoneMessagesSection
              entries={sortedPlan.phone_messages}
              originalEntries={plan.phone_messages}
              onAdd={() => replaceLane('phone_messages', [...plan.phone_messages, { t: 0, message_id: '' }])}
              onDelete={(index) => deleteLaneItem('phone_messages', index)}
              onUpdate={(index, patch) => updateLaneItem('phone_messages', index, patch)}
            />
          </>
        )}
      </main>
    </div>
  )
}

function TimelineOverview({ plan }: { plan: RuntimePlan }) {
  const pmTimes = useMemo(() => pmAbsoluteTimes(plan.pm_schedule), [plan.pm_schedule])
  const ticks = useMemo(() => {
    const step = plan.duration_seconds <= 600 ? 60 : 150
    const values: number[] = []
    for (let t = 0; t < plan.duration_seconds; t += step) values.push(t)
    if (!values.includes(plan.duration_seconds)) values.push(plan.duration_seconds)
    return values
  }, [plan.duration_seconds])

  const lanes = [
    {
      key: 'pm',
      label: 'PM',
      color: 'bg-indigo-600',
      events: plan.pm_schedule.map((entry, index) => ({
        t: pmTimes[index] ?? 0,
        label: entry.type === 'real' ? `P${entry.task_position}` : entry.trigger_type.replace('_', ' '),
      })),
    },
    {
      key: 'cook',
      label: 'Cook',
      color: 'bg-orange-500',
      events: plan.cooking_schedule.map((entry) => ({
        t: entry.t,
        label: `${entry.dish_id.replace(/_/g, ' ')} ${entry.step_index}`,
      })),
    },
    {
      key: 'robot',
      label: 'Robot',
      color: 'bg-emerald-600',
      events: plan.robot_idle_comments.map((entry) => ({ t: entry.t, label: entry.comment_id })),
    },
    {
      key: 'phone',
      label: 'Phone',
      color: 'bg-sky-600',
      events: plan.phone_messages.map((entry) => ({ t: entry.t, label: entry.message_id || 'message' })),
    },
  ]

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Timeline Overview</h2>
          <span className="text-xs text-slate-500">0s to {plan.duration_seconds}s</span>
        </div>
      </div>
      <div className="overflow-x-auto px-3 py-3">
        <div className="min-w-[980px]">
          <div className="ml-16 h-6 border-b border-slate-200">
            <div className="relative h-full">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="absolute top-0 h-full border-l border-slate-200 text-[11px] text-slate-500"
                  style={{ left: `${percentAt(tick, plan.duration_seconds)}%` }}
                >
                  <span className="absolute left-1 top-0 whitespace-nowrap">{tick}s</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 pt-2">
            {lanes.map((lane) => (
              <div key={lane.key} className="grid grid-cols-[4rem_1fr] items-center gap-0">
                <div className="pr-3 text-right text-xs font-medium uppercase text-slate-500">{lane.label}</div>
                <div className="relative h-9 rounded-sm bg-slate-50 ring-1 ring-inset ring-slate-100">
                  {ticks.map((tick) => (
                    <div
                      key={tick}
                      className="absolute top-0 h-full border-l border-slate-200/70"
                      style={{ left: `${percentAt(tick, plan.duration_seconds)}%` }}
                    />
                  ))}
                  {lane.events.map((event, index) => (
                    <div
                      key={`${lane.key}-${event.t}-${index}`}
                      className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${percentAt(event.t, plan.duration_seconds)}%` }}
                    >
                      <div className={`h-3 w-3 rounded-full shadow-sm ring-2 ring-white ${lane.color}`} />
                      <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover:block">
                        {event.t}s · {event.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Alert({ kind, children, onClose }: { kind: 'error' | 'success'; children: React.ReactNode; onClose?: () => void }) {
  const styles = kind === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-green-200 bg-green-50 text-green-700'
  const Icon = kind === 'error' ? AlertTriangle : CheckCircle
  return (
    <div className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm ${styles}`}>
      <Icon size={16} />
      <span>{children}</span>
      {onClose && <button className="ml-auto text-current opacity-70 hover:opacity-100" onClick={onClose}>x</button>}
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block w-44 text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(numberValue(e.target.value, value))}
        className="h-8 w-full rounded-md border border-slate-300 px-2 text-sm"
      />
    </label>
  )
}

function LaneSection({
  icon: Icon,
  title,
  count,
  onAdd,
  children,
}: {
  icon: React.ElementType
  title: string
  count: number
  onAdd: () => void
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-slate-500" />
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{count}</span>
        </div>
        <button onClick={onAdd} className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-800 px-2.5 text-xs font-medium text-white hover:bg-slate-700">
          <Plus size={14} />
          Add
        </button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

function PMScheduleSection({
  entries,
  onAdd,
  onDelete,
  onUpdate,
}: {
  entries: PMEntry[]
  onAdd: () => void
  onDelete: (index: number) => void
  onUpdate: (index: number, patch: Partial<PMEntry>) => void
}) {
  const absoluteTimes = useMemo(() => pmAbsoluteTimes(entries), [entries])

  return (
    <LaneSection icon={Bot} title="PM Triggers" count={entries.length} onAdd={onAdd}>
      <table className="w-auto min-w-[760px] text-xs">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="w-12 px-3 py-1.5">#</th><th className="w-24 px-3 py-1.5">Time</th><th className="w-28 px-3 py-1.5">Type</th><th className="w-28 px-3 py-1.5">Delay</th><th className="w-48 px-3 py-1.5">Target</th><th className="w-12" /></tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={index} className="border-t border-slate-100">
              <td className="px-3 py-1.5 text-slate-500">{index + 1}</td>
              <td className="px-3 py-1.5 font-medium text-slate-700">{absoluteTimes[index]}s</td>
              <td className="px-3 py-1.5">
                <select
                  value={entry.type}
                  onChange={(e) => {
                    if (e.target.value === 'real') onUpdate(index, { type: 'real', task_position: 1 })
                    else onUpdate(index, { type: 'fake', trigger_type: 'doorbell' })
                  }}
                  className="h-7 rounded border border-slate-300 px-2"
                >
                  <option value="real">real</option>
                  <option value="fake">fake</option>
                </select>
              </td>
              <td className="px-3 py-1.5">
                <input type="number" value={entry.delay_after_previous_s} onChange={(e) => onUpdate(index, { delay_after_previous_s: numberValue(e.target.value, entry.delay_after_previous_s) })} className="h-7 w-20 rounded border border-slate-300 px-2" />
              </td>
              <td className="px-3 py-1.5">
                {entry.type === 'real' ? (
                  <select value={entry.task_position} onChange={(e) => onUpdate(index, { task_position: numberValue(e.target.value, entry.task_position) })} className="h-7 rounded border border-slate-300 px-2">
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Position {n}</option>)}
                  </select>
                ) : (
                  <select value={entry.trigger_type} onChange={(e) => onUpdate(index, { trigger_type: e.target.value as 'doorbell' | 'phone_call' })} className="h-7 rounded border border-slate-300 px-2">
                    <option value="doorbell">doorbell</option>
                    <option value="phone_call">phone_call</option>
                  </select>
                )}
              </td>
              <DeleteCell onClick={() => onDelete(index)} />
            </tr>
          ))}
        </tbody>
      </table>
    </LaneSection>
  )
}

function CookingScheduleSection({
  entries,
  originalEntries,
  onAdd,
  onDelete,
  onUpdate,
}: {
  entries: CookingEntry[]
  originalEntries: CookingEntry[]
  onAdd: () => void
  onDelete: (index: number) => void
  onUpdate: (index: number, patch: Partial<CookingEntry>) => void
}) {
  return (
    <LaneSection icon={Flame} title="Cooking Steps" count={entries.length} onAdd={onAdd}>
      <table className="w-auto min-w-[760px] text-xs">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="w-24 px-3 py-1.5">Time</th><th className="w-64 px-3 py-1.5">Dish</th><th className="w-24 px-3 py-1.5">Step</th><th className="w-32 px-3 py-1.5">Type</th><th className="w-12" /></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const index = originalEntries.indexOf(entry)
            return (
              <tr key={`${entry.dish_id}-${entry.step_index}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-1.5"><input type="number" value={entry.t} onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })} className="h-7 w-20 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5"><input value={entry.dish_id} onChange={(e) => onUpdate(index, { dish_id: e.target.value })} className="h-7 w-44 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5"><input type="number" value={entry.step_index} onChange={(e) => onUpdate(index, { step_index: numberValue(e.target.value, entry.step_index) })} className="h-7 w-16 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5">
                  <select value={entry.step_type} onChange={(e) => onUpdate(index, { step_type: e.target.value as 'active' | 'wait' })} className="h-7 rounded border border-slate-300 px-2">
                    <option value="active">active</option>
                    <option value="wait">wait</option>
                  </select>
                </td>
                <DeleteCell onClick={() => onDelete(index)} />
              </tr>
            )
          })}
        </tbody>
      </table>
    </LaneSection>
  )
}

function RobotCommentsSection({
  entries,
  originalEntries,
  onAdd,
  onDelete,
  onUpdate,
}: {
  entries: RobotCommentEntry[]
  originalEntries: RobotCommentEntry[]
  onAdd: () => void
  onDelete: (index: number) => void
  onUpdate: (index: number, patch: Partial<RobotCommentEntry>) => void
}) {
  return (
    <LaneSection icon={MessageSquare} title="Robot Comments" count={entries.length} onAdd={onAdd}>
      <table className="w-auto min-w-[920px] text-xs">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="w-24 px-3 py-1.5">Time</th><th className="w-56 px-3 py-1.5">ID</th><th className="w-[560px] px-3 py-1.5">Text</th><th className="w-12" /></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const index = originalEntries.indexOf(entry)
            return (
              <tr key={`${entry.comment_id}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-1.5"><input type="number" value={entry.t} onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })} className="h-7 w-20 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5"><input value={entry.comment_id} onChange={(e) => onUpdate(index, { comment_id: e.target.value })} className="h-7 w-44 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5"><input value={entry.text} onChange={(e) => onUpdate(index, { text: e.target.value })} className="h-7 w-full min-w-96 rounded border border-slate-300 px-2" /></td>
                <DeleteCell onClick={() => onDelete(index)} />
              </tr>
            )
          })}
        </tbody>
      </table>
    </LaneSection>
  )
}

function PhoneMessagesSection({
  entries,
  originalEntries,
  onAdd,
  onDelete,
  onUpdate,
}: {
  entries: PhoneMessageEntry[]
  originalEntries: PhoneMessageEntry[]
  onAdd: () => void
  onDelete: (index: number) => void
  onUpdate: (index: number, patch: Partial<PhoneMessageEntry>) => void
}) {
  return (
    <LaneSection icon={Phone} title="Phone Messages" count={entries.length} onAdd={onAdd}>
      <table className="w-auto min-w-[420px] text-xs">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="w-24 px-3 py-1.5">Time</th><th className="w-64 px-3 py-1.5">Message ID</th><th className="w-12" /></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const index = originalEntries.indexOf(entry)
            return (
              <tr key={`${entry.message_id}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-1.5"><input type="number" value={entry.t} onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })} className="h-7 w-20 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5"><input value={entry.message_id} onChange={(e) => onUpdate(index, { message_id: e.target.value })} className="h-7 w-44 rounded border border-slate-300 px-2" /></td>
                <DeleteCell onClick={() => onDelete(index)} />
              </tr>
            )
          })}
        </tbody>
      </table>
    </LaneSection>
  )
}

function DeleteCell({ onClick }: { onClick: () => void }) {
  return (
    <td className="px-3 py-1 text-right">
      <button onClick={onClick} className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label="Delete row">
        <Trash2 size={16} />
      </button>
    </td>
  )
}
