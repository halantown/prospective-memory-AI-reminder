/** Strict PM pipeline overlay.
 *
 * Real: trigger_event -> greeting -> reminder -> item_selection
 *       -> confidence_rating -> auto_execute -> completed
 * Fake: trigger_event -> greeting -> fake_resolution -> completed
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { emitMouseTrackingEvent } from '../../hooks/useMouseTracker'
import { FAKE_TRIGGER_LINES, ITEM_SELECTION_OPTIONS, PM_TASKS } from '../../constants/pmTasks'
import { GREETING_PLACEHOLDERS, REMINDER_PLACEHOLDERS } from '../../constants/placeholders'
import type { DecoyOption, PMPipelineStep } from '../../types'
import type { ReactNode } from 'react'

const TRIGGER_NUDGE_MS = 30_000
const TRIGGER_TIMEOUT_MS = 45_000
const LINE_INTERVAL_MS = 1_500
const AUTO_EXECUTE_MS = 3_000

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function nowSeconds() {
  return Date.now() / 1000
}

function triggerLabel(triggerType: 'doorbell' | 'phone_call') {
  return triggerType === 'doorbell' ? 'doorbell' : 'phone'
}

function PhoneCallScreen({
  guestName,
  onAnswer,
}: {
  guestName: string
  onAnswer: () => void
}) {
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/95 p-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-slate-700 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-400 text-5xl shadow-lg">
          📞
        </div>
        <p className="text-sm uppercase tracking-[0.35em] text-emerald-200">Incoming Call</p>
        <h2 className="mt-3 text-3xl font-bold text-white">{guestName}</h2>
        <button
          onClick={onAnswer}
          className="mt-8 w-full rounded-full bg-emerald-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-emerald-400 active:scale-95"
        >
          Answer
        </button>
      </div>
    </div>
  )
}

function DoorbellHint() {
  return (
    <div className="fixed left-1/2 top-5 z-[210] -translate-x-1/2 rounded-full border border-amber-300/60 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-amber-100 shadow-xl backdrop-blur pointer-events-none">
      🔔 Someone is at the door. Go to the Living Room to answer.
    </div>
  )
}

function DialogueStep({
  title,
  speaker,
  lines,
  onComplete,
}: {
  title: string
  speaker: string
  lines: string[]
  onComplete: () => void
}) {
  const [index, setIndex] = useState(0)
  const completedRef = useRef(false)

  useEffect(() => {
    setIndex(0)
    completedRef.current = false
  }, [lines])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (index < lines.length - 1) {
        setIndex(i => i + 1)
        return
      }
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, LINE_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [index, lines.length, onComplete])

  return (
    <ModalShell>
      <div className="space-y-5">
        <p className="text-sm uppercase tracking-[0.25em] text-amber-600">{title}</p>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-3xl">
            {title === 'Call' ? '📞' : '👋'}
          </div>
          <div className="min-h-[110px] flex-1 rounded-3xl bg-slate-100 px-5 py-4 text-slate-800 shadow-inner">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{speaker}</div>
            <div className="text-lg leading-relaxed">{lines[index] ?? ''}</div>
          </div>
        </div>
        <div className="flex justify-center gap-2">
          {lines.map((_, i) => (
            <div key={i} className={`h-2 w-2 rounded-full ${i <= index ? 'bg-amber-500' : 'bg-slate-300'}`} />
          ))}
        </div>
      </div>
    </ModalShell>
  )
}

function ReminderStep({
  text,
  onAck,
}: {
  text: string
  onAck: () => void
}) {
  return (
    <ModalShell>
      <div className="space-y-5">
        <div className="rounded-3xl bg-cyan-50 px-5 py-4 text-slate-800 shadow-inner">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-700">Pepper</div>
          <p>Hey, I wanted to remind you...</p>
        </div>
        <div className="rounded-3xl border-2 border-cyan-200 bg-white p-6 shadow-lg">
          <h2 className="mb-3 text-xl font-bold text-slate-900">Robot Reminder</h2>
          <p className="text-lg leading-relaxed text-slate-700">{text}</p>
        </div>
        <button
          onClick={onAck}
          className="w-full rounded-2xl bg-cyan-600 py-4 text-lg font-bold text-white transition hover:bg-cyan-500 active:scale-95"
        >
          Got it
        </button>
      </div>
    </ModalShell>
  )
}

function ItemSelectionStep({
  taskId,
  options,
  onSelect,
}: {
  taskId: string | null
  options: DecoyOption[]
  onSelect: (option: DecoyOption, responseTimeMs: number) => void
}) {
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    emitMouseTrackingEvent('item_selection_start', { task_id: taskId })
  }, [taskId])

  return (
    <ModalShell>
      <div className="space-y-5">
        <h2 className="text-2xl font-bold text-slate-900">What did you promise?</h2>
        <div className="grid gap-3">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                emitMouseTrackingEvent('item_selection_end', {
                  task_id: taskId,
                  selected_item: option.id,
                })
                onSelect(option, Date.now() - startRef.current)
              }}
              className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-left text-lg font-semibold text-slate-800 transition hover:border-amber-400 hover:bg-amber-50 active:scale-[0.99]"
            >
              <span className="text-2xl">{option.isTarget ? '🎯' : '📦'}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  )
}

function ConfidenceStep({
  onSubmit,
}: {
  onSubmit: (rating: number, responseTimeMs: number) => void
}) {
  const startRef = useRef(Date.now())
  return (
    <ModalShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">How confident are you in your choice?</h2>
          <p className="mt-2 text-sm text-slate-500">1 = Not at all confident, 7 = Extremely confident</p>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => onSubmit(n, Date.now() - startRef.current)}
              className="rounded-2xl border-2 border-slate-200 bg-white py-4 text-xl font-bold text-slate-700 transition hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 active:scale-95"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>Not at all confident</span>
          <span>Extremely confident</span>
        </div>
      </div>
    </ModalShell>
  )
}

function AutoExecuteStep({ onDone }: { onDone: (startedAt: number, finishedAt: number) => void }) {
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const startedAt = nowSeconds()
    const timer = setTimeout(() => onDoneRef.current(startedAt, nowSeconds()), AUTO_EXECUTE_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <ModalShell>
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 text-6xl">
          🏃
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Completing the task...</h2>
        <p className="text-slate-500">The avatar is carrying out the promised action.</p>
      </div>
    </ModalShell>
  )
}

function ModalShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4" style={{ pointerEvents: 'auto' }}>
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl">
        {children}
      </div>
    </div>
  )
}

export default function PMTriggerModal() {
  const pmPipelineState = useGameStore((s) => s.pmPipelineState)
  const condition = useGameStore((s) => s.condition)
  const advancePMPipelineStep = useGameStore((s) => s.advancePMPipelineStep)
  const setPMPipelineState = useGameStore((s) => s.setPMPipelineState)
  const setGameTimeFrozen = useGameStore((s) => s.setGameTimeFrozen)
  const setRobotSpeaking = useGameStore((s) => s.setRobotSpeaking)
  const clearRobotSpeech = useGameStore((s) => s.clearRobotSpeech)

  const step = pmPipelineState?.step as PMPipelineStep | undefined
  const taskId = pmPipelineState?.taskId ?? null
  const triggerType = pmPipelineState?.triggerType ?? 'doorbell'
  const isFake = Boolean(pmPipelineState?.isFake)
  const guestName = pmPipelineState?.guestName
    ?? (taskId ? PM_TASKS[taskId]?.guestName : undefined)
    ?? (triggerType === 'doorbell' ? 'Visitor' : 'Caller')

  const itemOptions = useMemo(() => {
    if (!taskId) return []
    return shuffleArray(pmPipelineState?.itemOptions ?? ITEM_SELECTION_OPTIONS[taskId] ?? [])
  }, [pmPipelineState?.itemOptions, taskId])

  const close = useCallback(() => {
    clearRobotSpeech()
    setPMPipelineState(null)
    setGameTimeFrozen(false)
  }, [clearRobotSpeech, setGameTimeFrozen, setPMPipelineState])

  const send = useCallback((type: string, data: Record<string, unknown>) => {
    const wsSend = useGameStore.getState().wsSend
    if (wsSend) wsSend({ type, data })
  }, [])

  const markTriggerResponded = useCallback(() => {
    if (!pmPipelineState) return
    send('pm_trigger_responded', {
      task_id: taskId,
      trigger_type: triggerType,
      is_fake: isFake,
      game_time: nowSeconds(),
    })
    clearRobotSpeech()
    advancePMPipelineStep('greeting')
  }, [advancePMPipelineStep, clearRobotSpeech, isFake, pmPipelineState, send, taskId, triggerType])

  useEffect(() => {
    const handler = () => {
      if (useGameStore.getState().pmPipelineState?.step === 'trigger_event') {
        markTriggerResponded()
      }
    }
    window.addEventListener('pm:doorbell_answered', handler)
    return () => window.removeEventListener('pm:doorbell_answered', handler)
  }, [markTriggerResponded])

  useEffect(() => {
    if (!pmPipelineState || step !== 'trigger_event') return
    const nudge = setTimeout(() => {
      setRobotSpeaking(triggerType === 'doorbell' ? "Someone's at the door" : 'You have a call')
    }, TRIGGER_NUDGE_MS)
    const timeout = setTimeout(() => {
      send('pm_trigger_timed_out', {
        task_id: taskId,
        trigger_type: triggerType,
        is_fake: isFake,
        game_time: nowSeconds(),
      })
      clearRobotSpeech()
      if (isFake) {
        close()
      } else {
        advancePMPipelineStep('reminder')
      }
    }, TRIGGER_TIMEOUT_MS)
    return () => {
      clearTimeout(nudge)
      clearTimeout(timeout)
    }
  }, [advancePMPipelineStep, clearRobotSpeech, close, isFake, pmPipelineState, send, setRobotSpeaking, step, taskId, triggerType])

  useEffect(() => {
    if (step === 'reminder' && taskId) {
      send('pm_reminder_shown', { task_id: taskId, game_time: nowSeconds() })
      setRobotSpeaking('Hey, I wanted to remind you...')
    }
    if (step !== 'reminder') clearRobotSpeech()
  }, [clearRobotSpeech, send, setRobotSpeaking, step, taskId])

  if (!pmPipelineState || step === 'completed') return null

  const greetingLines = pmPipelineState.greetingLines
    ?? (taskId ? PM_TASKS[taskId]?.greetingLines : undefined)
    ?? [taskId ? GREETING_PLACEHOLDERS[taskId] : 'Hello.']
  const fakeLines = pmPipelineState.fakeResolutionLines
    ?? FAKE_TRIGGER_LINES[triggerType]
    ?? ['No need to do anything right now.']
  const reminderText = pmPipelineState.reminderText
    ?? (taskId && condition ? REMINDER_PLACEHOLDERS[taskId]?.[condition] : undefined)
    ?? '[Reminder - TBD]'

  const handleGreetingComplete = () => {
    if (isFake) {
      advancePMPipelineStep('fake_resolution')
      return
    }
    if (taskId) send('pm_greeting_complete', { task_id: taskId, game_time: nowSeconds() })
    advancePMPipelineStep('reminder')
  }

  const handleFakeComplete = () => {
    send('fake_trigger_resolved', {
      trigger_type: triggerType,
      scheduled_game_time: pmPipelineState.firedAt,
      resolved_at: nowSeconds(),
    })
    close()
  }

  const handleReminderAck = () => {
    if (taskId) send('pm_reminder_ack', { task_id: taskId, game_time: nowSeconds() })
    clearRobotSpeech()
    advancePMPipelineStep('item_selection')
  }

  const handleItemSelect = (option: DecoyOption, responseTimeMs: number) => {
    if (taskId) {
      send('pm_item_selected', {
        task_id: taskId,
        item_options_order: itemOptions.map(o => o.id),
        item_selected: option.id,
        item_correct: option.isTarget,
        response_time_ms: responseTimeMs,
      })
    }
    advancePMPipelineStep('confidence_rating')
  }

  const handleConfidenceSubmit = (rating: number, responseTimeMs: number) => {
    if (taskId) {
      send('pm_confidence_rated', {
        task_id: taskId,
        confidence_rating: rating,
        response_time_ms: responseTimeMs,
      })
    }
    advancePMPipelineStep('auto_execute')
  }

  const handleAutoExecuteDone = (startedAt: number, finishedAt: number) => {
    if (taskId) {
      send('pm_action_complete', {
        task_id: taskId,
        action_animation_start_time: startedAt,
        action_animation_complete_time: finishedAt,
      })
    }
    close()
  }

  if (step === 'trigger_event') {
    return triggerType === 'phone_call'
      ? <PhoneCallScreen guestName={guestName} onAnswer={markTriggerResponded} />
      : <DoorbellHint />
  }

  if (step === 'greeting') {
    return (
      <DialogueStep
        title={triggerLabel(triggerType) === 'phone' ? 'Call' : 'Greeting'}
        speaker={guestName}
        lines={greetingLines}
        onComplete={handleGreetingComplete}
      />
    )
  }

  if (step === 'fake_resolution') {
    return (
      <DialogueStep
        title={triggerLabel(triggerType) === 'phone' ? 'Call' : 'Greeting'}
        speaker={guestName}
        lines={fakeLines}
        onComplete={handleFakeComplete}
      />
    )
  }

  if (step === 'reminder') return <ReminderStep text={reminderText} onAck={handleReminderAck} />
  if (step === 'item_selection') return <ItemSelectionStep taskId={taskId} options={itemOptions} onSelect={handleItemSelect} />
  if (step === 'confidence_rating') return <ConfidenceStep onSubmit={handleConfidenceSubmit} />
  if (step === 'auto_execute') return <AutoExecuteStep onDone={handleAutoExecuteDone} />

  return null
}
