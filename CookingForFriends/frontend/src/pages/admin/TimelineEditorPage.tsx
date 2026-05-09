/** Runtime plan editor — edits the active gameplay schedule lanes. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle,
  Clock,
  Clipboard,
  FileDown,
  FileUp,
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

type PMImportEntry =
  | { type: 'real'; task_position: number }
  | { type: 'fake'; trigger_type: 'doorbell' | 'phone_call' }

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

interface PhoneMessageCandidate {
  message_id: string
  default_t?: number | null
  channel?: string
  sender?: string
  text?: string
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

interface RuntimePlanSchema {
  phone_message_catalog?: PhoneMessageCandidate[]
}

type LaneKey = 'pm_schedule' | 'cooking_schedule' | 'robot_idle_comments' | 'phone_messages'

type TimelineExportRow = {
  time_s: number
  lane: 'PM' | 'COOK' | 'ROBOT' | 'PHONE'
  event_type: string
  value_1: string
  value_2: string
  value_3: string
  text: string
}

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

function truncate(value: string | undefined, maxLength: number): string {
  if (!value) return ''
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
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

function encodeCell(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
}

function decodeCell(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
}

function timelineRowsForPlan(plan: RuntimePlan): TimelineExportRow[] {
  const pmTimes = pmAbsoluteTimes(plan.pm_schedule)
  const rows: TimelineExportRow[] = [
    ...plan.pm_schedule.map((entry, index): TimelineExportRow => ({
      time_s: pmTimes[index] ?? 0,
      lane: 'PM',
      event_type: entry.type,
      value_1: entry.type === 'real' ? String(entry.task_position) : entry.trigger_type,
      value_2: '',
      value_3: '',
      text: entry.type === 'real' ? `Position ${entry.task_position}` : entry.trigger_type,
    })),
    ...plan.cooking_schedule.map((entry): TimelineExportRow => ({
      time_s: entry.t,
      lane: 'COOK',
      event_type: entry.step_type,
      value_1: entry.dish_id,
      value_2: String(entry.step_index),
      value_3: '',
      text: `${entry.dish_id} step ${entry.step_index}`,
    })),
    ...plan.robot_idle_comments.map((entry): TimelineExportRow => ({
      time_s: entry.t,
      lane: 'ROBOT',
      event_type: 'comment',
      value_1: entry.comment_id,
      value_2: '',
      value_3: '',
      text: entry.text,
    })),
    ...plan.phone_messages.map((entry): TimelineExportRow => ({
      time_s: entry.t,
      lane: 'PHONE',
      event_type: 'message',
      value_1: entry.message_id,
      value_2: '',
      value_3: '',
      text: entry.message_id,
    })),
  ]

  const laneOrder: Record<TimelineExportRow['lane'], number> = { PM: 0, COOK: 1, ROBOT: 2, PHONE: 3 }
  return rows.sort((a, b) => a.time_s - b.time_s || laneOrder[a.lane] - laneOrder[b.lane] || a.text.localeCompare(b.text))
}

function generateTimelineText(plan: RuntimePlan): string {
  const header = ['time_s', 'lane', 'event_type', 'value_1', 'value_2', 'value_3', 'text'].join('\t')
  const rows = timelineRowsForPlan(plan).map((row) => [
    row.time_s,
    row.lane,
    row.event_type,
    row.value_1,
    row.value_2,
    row.value_3,
    row.text,
  ].map(encodeCell).join('\t'))
  return [header, ...rows].join('\n')
}

function parseTimelineText(text: string): Pick<RuntimePlan, 'pm_schedule' | 'cooking_schedule' | 'robot_idle_comments' | 'phone_messages'> & { maxTime: number } {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .filter((line) => !line.toLowerCase().startsWith('time_s\t'))

  const pmAbsolute: Array<{ t: number; entry: PMImportEntry }> = []
  const cooking_schedule: CookingEntry[] = []
  const robot_idle_comments: RobotCommentEntry[] = []
  const phone_messages: PhoneMessageEntry[] = []
  let maxTime = 0

  rows.forEach((line, index) => {
    const cells = line.split('\t').map(decodeCell)
    while (cells.length < 7) cells.push('')
    const [timeCell, laneCell, eventTypeCell, value1, value2, , textCell] = cells
    const time = Number(timeCell)
    if (!Number.isFinite(time) || time < 0) {
      throw new Error(`Invalid time on timeline row ${index + 1}: ${timeCell}`)
    }

    const t = Math.round(time)
    maxTime = Math.max(maxTime, t)
    const lane = laneCell.trim().toUpperCase()
    const eventType = eventTypeCell.trim().toLowerCase()

    if (lane === 'PM') {
      if (eventType === 'real') {
        const taskPosition = numberValue(value1.replace(/^Position\s+/i, ''), 0)
        if (!taskPosition) throw new Error(`Invalid PM real task position on row ${index + 1}`)
        pmAbsolute.push({ t, entry: { type: 'real', task_position: taskPosition } })
      } else if (eventType === 'fake') {
        const triggerType = value1.trim() as 'doorbell' | 'phone_call'
        if (triggerType !== 'doorbell' && triggerType !== 'phone_call') {
          throw new Error(`Invalid PM fake trigger type on row ${index + 1}`)
        }
        pmAbsolute.push({ t, entry: { type: 'fake', trigger_type: triggerType } })
      } else {
        throw new Error(`Invalid PM event type on row ${index + 1}: ${eventTypeCell}`)
      }
      return
    }

    if (lane === 'COOK') {
      if (eventType !== 'active' && eventType !== 'wait') {
        throw new Error(`Invalid cooking step type on row ${index + 1}: ${eventTypeCell}`)
      }
      const stepIndex = numberValue(value2, NaN)
      if (!value1.trim() || !Number.isFinite(stepIndex)) {
        throw new Error(`Invalid cooking row ${index + 1}`)
      }
      cooking_schedule.push({ t, dish_id: value1.trim(), step_index: stepIndex, step_type: eventType })
      return
    }

    if (lane === 'ROBOT') {
      if (!value1.trim()) throw new Error(`Missing robot comment id on row ${index + 1}`)
      robot_idle_comments.push({ t, comment_id: value1.trim(), text: textCell })
      return
    }

    if (lane === 'PHONE') {
      if (!value1.trim()) throw new Error(`Missing phone message id on row ${index + 1}`)
      phone_messages.push({ t, message_id: value1.trim() })
      return
    }

    throw new Error(`Invalid lane on row ${index + 1}: ${laneCell}`)
  })

  pmAbsolute.sort((a, b) => a.t - b.t)
  let previousPmTime = 0
  const pm_schedule = pmAbsolute.map(({ t, entry }) => {
    const delay_after_previous_s = Math.max(0, t - previousPmTime)
    previousPmTime = t
    return { ...entry, delay_after_previous_s } as PMEntry
  })

  return {
    pm_schedule,
    cooking_schedule: cooking_schedule.sort((a, b) => a.t - b.t),
    robot_idle_comments: robot_idle_comments.sort((a, b) => a.t - b.t),
    phone_messages: phone_messages.sort((a, b) => a.t - b.t),
    maxTime,
  }
}

export default function TimelineEditorPage() {
  const [plan, setPlan] = useState<RuntimePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [timelineText, setTimelineText] = useState('')
  const [timelineTextOpen, setTimelineTextOpen] = useState(false)
  const [phoneMessageCatalog, setPhoneMessageCatalog] = useState<PhoneMessageCandidate[]>([])

  useEffect(() => {
    Promise.all([
      apiFetch<RuntimePlan>(`${API}/runtime-plan`),
      apiFetch<RuntimePlanSchema>(`${API}/schema`).catch(() => ({ phone_message_catalog: [] })),
    ])
      .then(([data, schema]) => {
        setPlan(data)
        setPhoneMessageCatalog(schema.phone_message_catalog ?? [])
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

  const exportTimeline = useCallback(() => {
    if (!plan) return
    setTimelineText(generateTimelineText(plan))
    setTimelineTextOpen(true)
  }, [plan])

  const copyTimeline = useCallback(async () => {
    if (!timelineText) return
    try {
      await navigator.clipboard?.writeText(timelineText)
      setSuccess('Timeline text copied.')
      setTimeout(() => setSuccess(null), 2500)
    } catch (e) {
      console.error('[TimelineEditor] copy failed', e)
      setError('Could not copy timeline text.')
    }
  }, [timelineText])

  const adoptTimelineText = useCallback(() => {
    if (!plan) return
    setError(null)
    try {
      const parsed = parseTimelineText(timelineText)
      setPlan({
        ...plan,
        duration_seconds: Math.max(plan.duration_seconds, parsed.maxTime),
        pm_schedule: parsed.pm_schedule,
        cooking_schedule: parsed.cooking_schedule,
        robot_idle_comments: parsed.robot_idle_comments,
        phone_messages: parsed.phone_messages,
      })
      setDirty(true)
      setSuccess('Timeline text applied. Review the plan, then Save.')
      setTimeout(() => setSuccess(null), 3500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse timeline text.')
    }
  }, [plan, timelineText])

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-500">Loading runtime plan...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-2">
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

      <main className="mx-auto max-w-[1800px] space-y-3 px-4 py-4">
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
                <div className="ml-auto flex items-end gap-2">
                  <button
                    onClick={exportTimeline}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    <FileDown size={14} />
                    Export Events
                  </button>
                  <button
                    onClick={() => setTimelineTextOpen((open) => !open)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    <FileUp size={14} />
                    Import Text
                  </button>
                </div>
              </div>
            </section>

            {timelineTextOpen && (
              <section className="rounded-md border border-slate-200 bg-white p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-800">Timeline Text</h2>
                  <span className="text-xs text-slate-500">
                    TSV format: one row per timeline dot, sorted by time.
                  </span>
                  <button
                    onClick={copyTimeline}
                    disabled={!timelineText}
                    className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Clipboard size={14} />
                    Copy
                  </button>
                  <button
                    onClick={adoptTimelineText}
                    disabled={!timelineText.trim()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-3 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileUp size={14} />
                    Adopt Revised Timeline
                  </button>
                </div>
                <textarea
                  value={timelineText}
                  onChange={(e) => setTimelineText(e.target.value)}
                  spellCheck={false}
                  className="h-56 w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Paste exported timeline text here, then click Adopt Revised Timeline."
                />
              </section>
            )}

            <TimelineOverview plan={sortedPlan} />

            <div className="grid gap-3 xl:grid-cols-2">
              <PMScheduleSection
                entries={plan.pm_schedule}
                onAdd={() => replaceLane('pm_schedule', [...plan.pm_schedule, { type: 'real', delay_after_previous_s: 60, task_position: 1 }])}
                onDelete={(index) => deleteLaneItem('pm_schedule', index)}
                onUpdate={(index, patch) => updateLaneItem('pm_schedule', index, patch)}
              />

              <RobotCommentsSection
                entries={sortedPlan.robot_idle_comments}
                originalEntries={plan.robot_idle_comments}
                onAdd={() => replaceLane('robot_idle_comments', [...plan.robot_idle_comments, { t: 0, comment_id: 'new_comment', text: '' }])}
                onDelete={(index) => deleteLaneItem('robot_idle_comments', index)}
                onUpdate={(index, patch) => updateLaneItem('robot_idle_comments', index, patch)}
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <CookingScheduleSection
                entries={sortedPlan.cooking_schedule}
                originalEntries={plan.cooking_schedule}
                onAdd={() => replaceLane('cooking_schedule', [...plan.cooking_schedule, { t: 0, dish_id: 'roasted_vegetables', step_index: 0, step_type: 'active' }])}
                onDelete={(index) => deleteLaneItem('cooking_schedule', index)}
                onUpdate={(index, patch) => updateLaneItem('cooking_schedule', index, patch)}
              />

              <PhoneMessagesSection
                entries={sortedPlan.phone_messages}
                originalEntries={plan.phone_messages}
                candidates={phoneMessageCatalog}
                durationSeconds={plan.duration_seconds}
                onDelete={(index) => deleteLaneItem('phone_messages', index)}
                onUpdate={(index, patch) => updateLaneItem('phone_messages', index, patch)}
                onSetActive={(candidate, active) => {
                  const existingIndex = plan.phone_messages.findIndex((entry) => entry.message_id === candidate.message_id)
                  if (!active) {
                    if (existingIndex >= 0) deleteLaneItem('phone_messages', existingIndex)
                    return
                  }
                  if (existingIndex >= 0) return
                  const defaultTime = typeof candidate.default_t === 'number' ? candidate.default_t : 0
                  replaceLane('phone_messages', [
                    ...plan.phone_messages,
                    { t: Math.max(0, Math.min(plan.duration_seconds, defaultTime)), message_id: candidate.message_id },
                  ])
                }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function TimelineOverview({ plan }: { plan: RuntimePlan }) {
  const pmTimes = useMemo(() => pmAbsoluteTimes(plan.pm_schedule), [plan.pm_schedule])
  const ticks = useMemo(() => {
    const values: Array<{ value: number; major: boolean }> = []
    for (let t = 0; t < plan.duration_seconds; t += 30) {
      values.push({ value: t, major: t % 150 === 0 })
    }
    if (!values.some((tick) => tick.value === plan.duration_seconds)) {
      values.push({ value: plan.duration_seconds, major: true })
    }
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
        color: entry.type === 'real' ? 'bg-indigo-600' : 'bg-amber-500',
      })),
    },
    {
      key: 'cook',
      label: 'Cook',
      color: 'bg-orange-500',
      events: plan.cooking_schedule.map((entry) => ({
        t: entry.t,
        label: `${entry.dish_id.replace(/_/g, ' ')} ${entry.step_index}`,
        color: 'bg-orange-500',
      })),
    },
    {
      key: 'robot',
      label: 'Robot',
      color: 'bg-emerald-600',
      events: plan.robot_idle_comments.map((entry) => ({ t: entry.t, label: entry.comment_id, color: 'bg-emerald-600' })),
    },
    {
      key: 'phone',
      label: 'Phone',
      color: 'bg-sky-600',
      events: plan.phone_messages.map((entry) => ({ t: entry.t, label: entry.message_id || 'message', color: 'bg-sky-600' })),
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
      <div className="overflow-hidden px-3 py-3">
        <div className="w-full min-w-0">
          <div className="ml-16 h-6 border-b border-slate-200">
            <div className="relative h-full">
              {ticks.map((tick) => (
                <div
                  key={tick.value}
                  className={`absolute top-0 h-full border-l text-[11px] ${
                    tick.major ? 'border-slate-300 text-slate-500' : 'border-slate-200/70 text-transparent'
                  }`}
                  style={{ left: `${percentAt(tick.value, plan.duration_seconds)}%` }}
                >
                  {tick.major && (
                    <span className={`absolute top-0 whitespace-nowrap ${
                      tick.value === plan.duration_seconds ? 'right-1' : 'left-1'
                    }`}>
                      {tick.value}s
                    </span>
                  )}
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
                      key={tick.value}
                      className={`absolute top-0 h-full border-l ${
                        tick.major ? 'border-slate-200' : 'border-slate-200/45'
                      }`}
                      style={{ left: `${percentAt(tick.value, plan.duration_seconds)}%` }}
                    />
                  ))}
                  {lane.events.map((event, index) => (
                    <div
                      key={`${lane.key}-${event.t}-${index}`}
                      className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${percentAt(event.t, plan.duration_seconds)}%` }}
                    >
                      <div className={`h-3 w-3 rounded-full shadow-sm ring-2 ring-white ${event.color ?? lane.color}`} />
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
  onAdd?: () => void
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
        {onAdd && (
          <button onClick={onAdd} className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-800 px-2.5 text-xs font-medium text-white hover:bg-slate-700">
            <Plus size={14} />
            Add
          </button>
        )}
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
      <table className="w-full min-w-[560px] text-xs">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="w-10 px-3 py-1.5">#</th><th className="w-20 px-3 py-1.5">Time</th><th className="w-24 px-3 py-1.5">Type</th><th className="w-24 px-3 py-1.5">Delay</th><th className="w-36 px-3 py-1.5">Target</th><th className="w-12" /></tr>
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
      <table className="w-full min-w-[620px] text-xs">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="w-20 px-3 py-1.5">Time</th><th className="w-52 px-3 py-1.5">Dish</th><th className="w-20 px-3 py-1.5">Step</th><th className="w-28 px-3 py-1.5">Type</th><th className="w-12" /></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const index = originalEntries.indexOf(entry)
            return (
              <tr key={`${entry.dish_id}-${entry.step_index}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-1.5"><input type="number" value={entry.t} onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })} className="h-7 w-20 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5"><input value={entry.dish_id} onChange={(e) => onUpdate(index, { dish_id: e.target.value })} className="h-7 w-40 rounded border border-slate-300 px-2" /></td>
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
      <table className="w-full min-w-[640px] text-xs">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="w-20 px-3 py-1.5">Time</th><th className="w-44 px-3 py-1.5">ID</th><th className="min-w-72 px-3 py-1.5">Text</th><th className="w-12" /></tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const index = originalEntries.indexOf(entry)
            return (
              <tr key={`${entry.comment_id}-${index}`} className="border-t border-slate-100">
                <td className="px-3 py-1.5"><input type="number" value={entry.t} onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })} className="h-7 w-20 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5"><input value={entry.comment_id} onChange={(e) => onUpdate(index, { comment_id: e.target.value })} className="h-7 w-36 rounded border border-slate-300 px-2" /></td>
                <td className="px-3 py-1.5"><input value={entry.text} onChange={(e) => onUpdate(index, { text: e.target.value })} className="h-7 w-full min-w-72 rounded border border-slate-300 px-2" /></td>
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
  candidates,
  durationSeconds,
  onDelete,
  onUpdate,
  onSetActive,
}: {
  entries: PhoneMessageEntry[]
  originalEntries: PhoneMessageEntry[]
  candidates: PhoneMessageCandidate[]
  durationSeconds: number
  onDelete: (index: number) => void
  onUpdate: (index: number, patch: Partial<PhoneMessageEntry>) => void
  onSetActive: (candidate: PhoneMessageCandidate, active: boolean) => void
}) {
  const activeByMessageId = useMemo(() => {
    return new Map(entries.map((entry) => [entry.message_id, entry]))
  }, [entries])
  const catalog = useMemo(() => {
    const seen = new Set<string>()
    const merged: PhoneMessageCandidate[] = []
    candidates.forEach((candidate) => {
      if (!candidate.message_id || seen.has(candidate.message_id)) return
      seen.add(candidate.message_id)
      merged.push(candidate)
    })
    entries.forEach((entry) => {
      if (seen.has(entry.message_id)) return
      seen.add(entry.message_id)
      merged.push({ message_id: entry.message_id, default_t: entry.t })
    })
    return merged.sort((a, b) => {
      const at = typeof a.default_t === 'number' ? a.default_t : Number.MAX_SAFE_INTEGER
      const bt = typeof b.default_t === 'number' ? b.default_t : Number.MAX_SAFE_INTEGER
      return at - bt || a.message_id.localeCompare(b.message_id)
    })
  }, [candidates, entries])

  return (
    <LaneSection icon={Phone} title="Phone Messages" count={entries.length}>
      <table className="w-full min-w-[620px] text-xs">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="w-16 px-3 py-1.5">Active</th><th className="w-20 px-3 py-1.5">Time</th><th className="w-24 px-3 py-1.5">Message ID</th><th className="w-24 px-3 py-1.5">Source</th><th className="px-3 py-1.5">Text</th></tr>
        </thead>
        <tbody>
          {catalog.map((candidate) => {
            const entry = activeByMessageId.get(candidate.message_id)
            const index = entry ? originalEntries.findIndex((item) => item.message_id === entry.message_id) : -1
            const active = Boolean(entry && index >= 0)
            return (
              <tr key={candidate.message_id} className={`border-t border-slate-100 ${active ? '' : 'bg-slate-50/60 text-slate-400'}`}>
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => onSetActive(candidate, e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                    aria-label={`Set ${candidate.message_id} active`}
                  />
                </td>
                <td className="px-3 py-1.5">
                  {active && entry ? (
                    <input
                      type="number"
                      value={entry.t}
                      min={0}
                      max={durationSeconds}
                      onChange={(e) => onUpdate(index, { t: numberValue(e.target.value, entry.t) })}
                      className="h-7 w-20 rounded border border-slate-300 px-2"
                    />
                  ) : (
                    <span className="font-mono">{typeof candidate.default_t === 'number' ? candidate.default_t : '-'}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 font-mono text-slate-700">{candidate.message_id}</td>
                <td className="px-3 py-1.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {candidate.channel || 'message'}{candidate.sender ? ` / ${candidate.sender}` : ''}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-slate-600" title={candidate.text || ''}>
                  {truncate(candidate.text, 72)}
                </td>
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
