/** Runtime plan editor — edits the active gameplay schedule lanes. */

import { useCallback, useEffect, useMemo, useState } from 'react'
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-slate-400 hover:text-slate-700" aria-label="Back to dashboard">
              <ArrowLeft size={20} />
            </a>
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

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
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
            <section className="rounded-md border border-slate-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-4">
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
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(numberValue(e.target.value, value))}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-slate-500" />
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{count}</span>
        </div>
        <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
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
  return (
    <LaneSection icon={Bot} title="PM Triggers" count={entries.length} onAdd={onAdd}>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Delay</th><th className="px-3 py-2">Target</th><th /></tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={index} className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-500">{index + 1}</td>
              <td className="px-3 py-2">
                <select
                  value={entry.type}
                  onChange={(e) => {
                    if (e.target.value === 'real') onUpdate(index, { type: 'real', task_position: 1 })
                    else onUpdate(index, { type: 'fake', trigger_type: 'doorbell' })
                  }}
                  className="rounded border border-slate-300 px-2 py-1"
                >
                  <option value="real">real</option>
                  <option value="fake">fake</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <input type="number" value={entry.delay_after_previous_s} onChange={(e) => onUpdate(index, { delay_after_previous_s: numberValue(e.target.value, entry.delay_after_previous_s) })} className="w-24 rounded border border-slate-300 px-2 py-1" />
              </td>
              <td className="px-3 py-2">
                {entry.type === 'real' ? (
                  <select value={entry.task_position} onChange={(e) => onUpdate(index, { task_position: numberValue(e.target.value, entry.task_position) })} className="rounded border border-slate-300 px-2 py-1">
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Position {n}</option>)}
                  </select>
                ) : (
                  <select value={entry.trigger_type} onChange={(e) => onUpdate(index, { trigger_type: e.target.value as 'doorbell' | 'phone_call' })} className="rounded border border-slate-300 px-2 py-1">
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
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Dish</th><th className="px-3 py-2">Step</th><th className="px-3 py-2">Type</th><th /></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const index = originalEntries.indexOf(entry)
            return (
              <tr key={`${entry.dish_id}-${entry.step_index}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-2"><input type="number" value={entry.t} onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })} className="w-24 rounded border border-slate-300 px-2 py-1" /></td>
                <td className="px-3 py-2"><input value={entry.dish_id} onChange={(e) => onUpdate(index, { dish_id: e.target.value })} className="w-48 rounded border border-slate-300 px-2 py-1" /></td>
                <td className="px-3 py-2"><input type="number" value={entry.step_index} onChange={(e) => onUpdate(index, { step_index: numberValue(e.target.value, entry.step_index) })} className="w-20 rounded border border-slate-300 px-2 py-1" /></td>
                <td className="px-3 py-2">
                  <select value={entry.step_type} onChange={(e) => onUpdate(index, { step_type: e.target.value as 'active' | 'wait' })} className="rounded border border-slate-300 px-2 py-1">
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
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">ID</th><th className="px-3 py-2">Text</th><th /></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const index = originalEntries.indexOf(entry)
            return (
              <tr key={`${entry.comment_id}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-2"><input type="number" value={entry.t} onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })} className="w-24 rounded border border-slate-300 px-2 py-1" /></td>
                <td className="px-3 py-2"><input value={entry.comment_id} onChange={(e) => onUpdate(index, { comment_id: e.target.value })} className="w-48 rounded border border-slate-300 px-2 py-1" /></td>
                <td className="px-3 py-2"><input value={entry.text} onChange={(e) => onUpdate(index, { text: e.target.value })} className="w-full min-w-96 rounded border border-slate-300 px-2 py-1" /></td>
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
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Message ID</th><th /></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const index = originalEntries.indexOf(entry)
            return (
              <tr key={`${entry.message_id}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-2"><input type="number" value={entry.t} onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })} className="w-24 rounded border border-slate-300 px-2 py-1" /></td>
                <td className="px-3 py-2"><input value={entry.message_id} onChange={(e) => onUpdate(index, { message_id: e.target.value })} className="w-48 rounded border border-slate-300 px-2 py-1" /></td>
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
    <td className="px-3 py-2 text-right">
      <button onClick={onClick} className="rounded p-1.5 text-red-500 hover:bg-red-50" aria-label="Delete row">
        <Trash2 size={16} />
      </button>
    </td>
  )
}
