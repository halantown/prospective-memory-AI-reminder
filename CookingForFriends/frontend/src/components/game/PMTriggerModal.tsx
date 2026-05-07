/** Strict PM pipeline overlay.
 *
 * Real: trigger_event -> greeting -> reminder -> item_selection
 *       -> confidence_rating -> auto_execute -> completed
 * Fake: trigger_event -> greeting -> direct_request -> completed
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { emitMouseTrackingEvent } from '../../hooks/useMouseTracker'
import { FAKE_TRIGGER_LINES, ITEM_SELECTION_OPTIONS, PM_TASKS } from '../../constants/pmTasks'
import { GREETING_PLACEHOLDERS, REMINDER_PLACEHOLDERS } from '../../constants/placeholders'
import type { DecoyOption, PMPipelineStep } from '../../types'
import BubbleDialogue from './dialogue/BubbleDialogue'
import ClickDialogueFlow from './dialogue/ClickDialogueFlow'
import {
  getActiveTriggerEncounterConfig,
  getEncounterReminder,
  type DialogueLine,
  type TriggerEncounterConfig,
} from '../../data/triggerEncounters'
import type { ReactNode } from 'react'

const TRIGGER_NUDGE_MS = 30_000
const TRIGGER_TIMEOUT_MS = 45_000
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

function fallbackDialogueLines(lines: string[], speaker: string, triggerType: 'doorbell' | 'phone_call'): DialogueLine[] {
  return lines.map((text, index) => ({
    speaker: index % 2 === 0 ? speaker : 'Avatar',
    text,
    bubblePosition: triggerType === 'phone_call' ? 'phone' : index % 2 === 0 ? 'right' : 'left',
  }))
}

function PhoneCallScreen({
  guestName,
  onAnswer,
}: {
  guestName: string
  onAnswer: () => void
}) {
  return (
    <div className="fixed right-0 top-0 bottom-0 z-[210] flex w-[440px] items-center justify-center bg-slate-950/70 p-6">
      <div className="w-full rounded-[2rem] border border-emerald-300/40 bg-slate-900 p-8 text-center shadow-2xl shadow-emerald-950/40">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-400 text-5xl shadow-lg animate-pulse">
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
      🔔 Someone is at the door.
    </div>
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
    <InGameShell>
      <BubbleDialogue
        speaker="Pepper"
        text={`Hey, I wanted to remind you... ${text}`}
        avatar="R"
        align="right"
        continueLabel="Got it"
        onContinue={onAck}
      />
    </InGameShell>
  )
}

function DirectRequestStep({
  config,
  fallbackDialogue,
  onComplete,
}: {
  config: TriggerEncounterConfig | null
  fallbackDialogue: DialogueLine[]
  onComplete: () => void
}) {
  const [dialogueDone, setDialogueDone] = useState(false)
  const actionLabel = config?.fakeActionLabel ?? 'Done'

  if (!dialogueDone) {
    return (
      <ClickDialogueFlow
        lines={config?.fakeDialogue ?? fallbackDialogue}
        onComplete={() => setDialogueDone(true)}
      />
    )
  }

  return (
    <InGameShell>
      <BubbleDialogue
        speaker={config?.npcName ?? 'Visitor'}
        text="Thanks. That is all I needed."
        avatar={(config?.npcName ?? 'V').slice(0, 1)}
      >
        <button
          type="button"
          onClick={onComplete}
          className="border-2 border-slate-950 bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-700"
        >
          {actionLabel}
        </button>
      </BubbleDialogue>
    </InGameShell>
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
    <InGameShell>
      <BubbleDialogue
        speaker="AVATAR"
        text="What did you promise?"
        avatar="A"
        choices={options.map((option) => ({ id: option.id, label: option.label }))}
        onChoice={(choice) => {
          const option = options.find((o) => o.id === choice.id)
          if (!option) return
          emitMouseTrackingEvent('item_selection_end', {
            task_id: taskId,
            selected_item: option.id,
          })
          onSelect(option, Date.now() - startRef.current)
        }}
      />
    </InGameShell>
  )
}

function ConfidenceStep({
  onSubmit,
}: {
  onSubmit: (rating: number, responseTimeMs: number) => void
}) {
  const startRef = useRef(Date.now())
  return (
    <InGameShell>
      <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-xl">
        <div>
          <h2 className="text-base font-bold text-slate-900">How confident are you in your choice?</h2>
          <p className="mt-2 text-sm text-slate-500">1 = Not at all confident, 7 = Extremely confident</p>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => onSubmit(n, Date.now() - startRef.current)}
              className="rounded-md border border-slate-300 bg-white py-3 text-base font-bold text-slate-700 transition hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 active:scale-95"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Not at all confident</span>
          <span>Extremely confident</span>
        </div>
      </div>
    </InGameShell>
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
    <InGameShell>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-center shadow-xl">
        <h2 className="text-base font-bold text-amber-950">Completing the task...</h2>
        <p className="mt-2 text-sm text-amber-900">The avatar is carrying out the promised action.</p>
      </div>
    </InGameShell>
  )
}

function InGameShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[220] flex justify-center bg-gradient-to-t from-black/55 to-transparent p-4" style={{ pointerEvents: 'auto' }}>
      <div className="w-full max-w-3xl">
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
  const encounterConfig = getActiveTriggerEncounterConfig({ taskId, triggerType, isFake })

  const itemOptions = useMemo(() => {
    if (!taskId) return []
    return shuffleArray(pmPipelineState?.itemOptions ?? encounterConfig?.itemOptions ?? ITEM_SELECTION_OPTIONS[taskId] ?? [])
  }, [encounterConfig?.itemOptions, pmPipelineState?.itemOptions, taskId])

  const close = useCallback(() => {
    clearRobotSpeech()
    setPMPipelineState(null)
    setGameTimeFrozen(false)
  }, [clearRobotSpeech, setGameTimeFrozen, setPMPipelineState])

  const send = useCallback((type: string, data: Record<string, unknown>) => {
    const wsSend = useGameStore.getState().wsSend
    if (wsSend) wsSend({ type, data })
  }, [])

  useEffect(() => {
    if (!pmPipelineState || !step) return
    send('trigger_encounter_state', {
      task_id: taskId,
      trigger_type: triggerType,
      is_fake: isFake,
      state: step,
      timestamp: nowSeconds(),
    })
  }, [isFake, pmPipelineState, send, step, taskId, triggerType])

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
    }
    if (step !== 'reminder') clearRobotSpeech()
  }, [clearRobotSpeech, send, step, taskId])

  if (!pmPipelineState || step === 'completed') return null

  const greetingLines = pmPipelineState.greetingLines
    ?? (taskId ? PM_TASKS[taskId]?.greetingLines : undefined)
    ?? [taskId ? GREETING_PLACEHOLDERS[taskId] : 'Hello.']
  const fakeLines = pmPipelineState.fakeResolutionLines
    ?? FAKE_TRIGGER_LINES[triggerType]
    ?? ['No need to do anything right now.']
  const reminderText = pmPipelineState.reminderText
    ?? (encounterConfig ? getEncounterReminder(encounterConfig, condition) : undefined)
    ?? (taskId && condition ? REMINDER_PLACEHOLDERS[taskId]?.[condition] : undefined)
    ?? '[Reminder - TBD]'
  const greetingDialogue = encounterConfig?.greetingDialogue
    ?? fallbackDialogueLines(greetingLines, guestName, triggerType)
  const fakeDialogue = encounterConfig?.fakeDialogue
    ?? fallbackDialogueLines(fakeLines, guestName, triggerType)

  const handleGreetingComplete = () => {
    if (isFake) {
      advancePMPipelineStep('direct_request')
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
      <ClickDialogueFlow lines={greetingDialogue} onComplete={handleGreetingComplete} />
    )
  }

  if (step === 'fake_resolution' || step === 'direct_request') {
    return (
      <DirectRequestStep
        config={encounterConfig}
        fallbackDialogue={fakeDialogue}
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
