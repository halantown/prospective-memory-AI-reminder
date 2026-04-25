/** PMTriggerModal — full-screen overlay PM pipeline. Blocks all game interaction.
 *
 * REAL trigger pipeline:
 *   trigger_affordance → greeting → reminder → decoy → confidence → avatar_action → completed
 *
 * FAKE trigger pipeline:
 *   trigger_affordance → greeting → fake_reminder → completed
 *
 * WS messages sent per step:
 *   - greeting complete → pm_greeting_complete
 *   - reminder ack → pm_reminder_ack
 *   - decoy selected → pm_decoy_selected
 *   - confidence rated → pm_confidence_rated
 *   - avatar action complete → pm_action_complete
 *   - fake ack → fake_trigger_ack
 *
 * gameTimeFrozen is true for the entire pipeline.
 * On completed/fake ack: setPMPipelineState(null) + setGameTimeFrozen(false)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { DECOY_OPTIONS } from '../../constants/pmTasks'
import {
  GREETING_PLACEHOLDERS,
  REMINDER_PLACEHOLDERS,
  PLACEHOLDER_FAKE_REMINDER_POOL,
  PLACEHOLDER_CONFIDENCE_SCALE,
} from '../../constants/placeholders'
import type { DecoyOption } from '../../types'

// ── Helpers ──

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ── Sub-components ──

function TriggerAffordance({
  triggerType,
  onOpen,
}: {
  triggerType: 'doorbell' | 'phone_call'
  onOpen: () => void
}) {
  const isDoorbell = triggerType === 'doorbell'
  return (
    <div className="text-center space-y-6">
      <div className="text-8xl animate-bounce">
        {isDoorbell ? '🔔' : '📱'}
      </div>
      <h2 className="text-2xl font-bold text-slate-800">
        {isDoorbell ? 'Someone is at the door!' : 'Incoming phone call!'}
      </h2>
      <p className="text-slate-500 text-sm">
        {isDoorbell ? 'A visitor has arrived.' : 'Your phone is ringing.'}
      </p>
      <button
        onClick={onOpen}
        className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold
                   rounded-2xl text-lg shadow-lg transition-all active:scale-95"
      >
        {isDoorbell ? '🚪 Answer Door' : '📞 Answer Call'}
      </button>
    </div>
  )
}

function GreetingStep({
  greetingText,
  onContinue,
}: {
  greetingText: string
  onContinue: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="text-4xl">👋</div>
        <h2 className="text-xl font-bold text-slate-800">Greeting</h2>
      </div>
      <div className="bg-slate-50 rounded-2xl p-6 text-slate-700 leading-relaxed min-h-[80px]">
        {greetingText}
      </div>
      <button
        onClick={onContinue}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white
                   font-semibold rounded-xl transition-colors"
      >
        Continue →
      </button>
    </div>
  )
}

function ReminderStep({
  reminderText,
  onAck,
}: {
  reminderText: string
  onAck: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="text-4xl">🤖</div>
        <h2 className="text-xl font-bold text-slate-800">Robot Reminder</h2>
      </div>
      <div className="relative bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
        <div className="absolute -top-3 left-6 w-0 h-0
                        border-l-[10px] border-l-transparent
                        border-r-[10px] border-r-transparent
                        border-b-[12px] border-b-blue-200" />
        <p className="text-slate-700 leading-relaxed">{reminderText}</p>
      </div>
      <button
        onClick={onAck}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white
                   font-semibold rounded-xl transition-colors"
      >
        I know
      </button>
    </div>
  )
}

function FakeReminderStep({
  reminderText,
  onAck,
}: {
  reminderText: string
  onAck: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="text-4xl">🤖</div>
        <h2 className="text-xl font-bold text-slate-800">Robot Message</h2>
      </div>
      <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6">
        <p className="text-slate-700 leading-relaxed">{reminderText}</p>
      </div>
      <button
        onClick={onAck}
        className="w-full py-3 bg-slate-600 hover:bg-slate-700 text-white
                   font-semibold rounded-xl transition-colors"
      >
        I know
      </button>
    </div>
  )
}

function DecoyStep({
  taskId,
  shuffled,
  onSelect,
}: {
  taskId: string
  shuffled: DecoyOption[]
  onSelect: (option: DecoyOption, responseTimeMs: number) => void
}) {
  const startRef = useRef(Date.now())
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="text-4xl">🎯</div>
        <h2 className="text-xl font-bold text-slate-800">What will you bring?</h2>
      </div>
      <p className="text-slate-500 text-sm">Select the correct item for Task {taskId}.</p>
      <div className="grid grid-cols-2 gap-3">
        {shuffled.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt, Date.now() - startRef.current)}
            className="px-4 py-4 bg-white border-2 border-slate-200 hover:border-amber-400
                       hover:bg-amber-50 rounded-xl text-slate-800 font-medium text-sm
                       transition-all active:scale-95 text-center"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ConfidenceStep({
  onSubmit,
}: {
  onSubmit: (rating: number, responseTimeMs: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const startRef = useRef(Date.now())

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="text-4xl">💭</div>
        <h2 className="text-xl font-bold text-slate-800">Confidence Rating</h2>
      </div>
      <p className="text-slate-600 text-sm leading-relaxed">
        {PLACEHOLDER_CONFIDENCE_SCALE}
      </p>
      <div className="flex justify-between gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all
              ${selected === n
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-400 px-1">
        <span>Not at all confident</span>
        <span>Completely confident</span>
      </div>
      <button
        onClick={() => selected !== null && onSubmit(selected, Date.now() - startRef.current)}
        disabled={selected === null}
        className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200
                   disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors"
      >
        Submit
      </button>
    </div>
  )
}

function AvatarActionStep({ onActionSent }: { onActionSent: () => void }) {
  const [animating, setAnimating] = useState(false)
  const [done, setDone] = useState(false)

  // Listen for server avatar_action event dispatched as custom DOM event
  useEffect(() => {
    const handler = () => {
      setAnimating(true)
      setTimeout(() => {
        setDone(true)
        setAnimating(false)
        onActionSent()
      }, 3000)
    }
    window.addEventListener('pm:avatar_action', handler)
    return () => window.removeEventListener('pm:avatar_action', handler)
  }, [onActionSent])

  return (
    <div className="space-y-6 text-center">
      <div className={`text-6xl ${animating ? 'animate-spin' : ''}`}>🤖</div>
      <h2 className="text-xl font-bold text-slate-800">
        {done ? 'Action complete!' : animating ? 'Robot is performing action…' : 'Waiting for robot…'}
      </h2>
      {!animating && !done && (
        <p className="text-slate-500 text-sm">Please wait while the robot completes the task.</p>
      )}
      {done && (
        <div className="text-green-600 font-semibold">✓ Done</div>
      )}
    </div>
  )
}

// ── Main modal component ──

export default function PMTriggerModal() {
  const pmPipelineState = useGameStore((s) => s.pmPipelineState)
  const condition = useGameStore((s) => s.condition)
  const wsSend = useGameStore((s) => s.wsSend)
  const advancePMPipelineStep = useGameStore((s) => s.advancePMPipelineStep)
  const setPMPipelineState = useGameStore((s) => s.setPMPipelineState)
  const setGameTimeFrozen = useGameStore((s) => s.setGameTimeFrozen)

  // Stable shuffled decoys for this trigger instance
  const [shuffledDecoys, setShuffledDecoys] = useState<DecoyOption[]>([])

  useEffect(() => {
    if (pmPipelineState?.step === 'decoy' && pmPipelineState.taskId) {
      const options = DECOY_OPTIONS[pmPipelineState.taskId] ?? []
      setShuffledDecoys(shuffleArray(options))
    }
  }, [pmPipelineState?.step, pmPipelineState?.taskId])

  const close = useCallback(() => {
    setPMPipelineState(null)
    setGameTimeFrozen(false)
  }, [setPMPipelineState, setGameTimeFrozen])

  if (!pmPipelineState) return null

  const { step, taskId, triggerType, isFake, firedAt } = pmPipelineState

  // ── Greeting text ──
  const getGreetingText = () => {
    if (isFake) {
      return triggerType === 'doorbell'
        ? GREETING_PLACEHOLDERS['fake_doorbell']
        : GREETING_PLACEHOLDERS['fake_phone_call']
    }
    return taskId ? (GREETING_PLACEHOLDERS[taskId] ?? '[Greeting - TBD]') : '[Greeting - TBD]'
  }

  // ── Reminder text — ONLY source is REMINDER_PLACEHOLDERS keyed by taskId + condition ──
  const getReminderText = () => {
    if (!taskId || !condition) return '[Reminder - TBD]'
    return REMINDER_PLACEHOLDERS[taskId]?.[condition] ?? '[Reminder - TBD]'
  }

  // ── Step handlers ──

  const handleAffordanceClick = () => {
    advancePMPipelineStep('greeting')
  }

  const handleGreetingComplete = () => {
    const send = useGameStore.getState().wsSend
    if (send && taskId) {
      send({ type: 'pm_greeting_complete', data: { task_id: taskId, game_time: Date.now() / 1000 } })
    }
    advancePMPipelineStep(isFake ? 'fake_reminder' : 'reminder')
  }

  const handleReminderAck = () => {
    const send = useGameStore.getState().wsSend
    if (send && taskId) {
      send({ type: 'pm_reminder_ack', data: { task_id: taskId, game_time: Date.now() / 1000 } })
    }
    advancePMPipelineStep('decoy')
  }

  const handleFakeAck = () => {
    const send = useGameStore.getState().wsSend
    if (send) {
      send({ type: 'fake_trigger_ack', data: { scheduled_game_time: firedAt, trigger_type: triggerType } })
    }
    close()
  }

  const handleDecoySelect = (option: DecoyOption, responseTimeMs: number) => {
    const send = useGameStore.getState().wsSend
    if (send && taskId) {
      send({
        type: 'pm_decoy_selected',
        data: {
          task_id: taskId,
          decoy_options_order: shuffledDecoys.map((o) => o.id),
          selected_option: option.id,
          decoy_correct: option.isTarget,
          response_time_ms: responseTimeMs,
        },
      })
    }
    advancePMPipelineStep('confidence')
  }

  const handleConfidenceSubmit = (rating: number, responseTimeMs: number) => {
    const send = useGameStore.getState().wsSend
    if (send && taskId) {
      send({ type: 'pm_confidence_rated', data: { task_id: taskId, confidence_rating: rating, response_time_ms: responseTimeMs } })
    }
    advancePMPipelineStep('avatar_action')
  }

  const handleAvatarActionSent = () => {
    const send = useGameStore.getState().wsSend
    const now = Date.now() / 1000
    if (send && taskId) {
      send({
        type: 'pm_action_complete',
        data: {
          task_id: taskId,
          action_animation_start_time: now - 3,
          action_animation_complete_time: now,
        },
      })
    }
    close()
  }

  // ── Render ──
  const renderStep = () => {
    switch (step) {
      case 'trigger_affordance':
        return <TriggerAffordance triggerType={triggerType} onOpen={handleAffordanceClick} />
      case 'greeting':
        return <GreetingStep greetingText={getGreetingText()} onContinue={handleGreetingComplete} />
      case 'reminder':
        return <ReminderStep reminderText={getReminderText()} onAck={handleReminderAck} />
      case 'fake_reminder':
        return <FakeReminderStep reminderText={PLACEHOLDER_FAKE_REMINDER_POOL[0] ?? '[Fake reminder]'} onAck={handleFakeAck} />
      case 'decoy':
        return taskId ? <DecoyStep taskId={taskId} shuffled={shuffledDecoys} onSelect={handleDecoySelect} /> : null
      case 'confidence':
        return <ConfidenceStep onSubmit={handleConfidenceSubmit} />
      case 'avatar_action':
        return <AvatarActionStep onActionSent={handleAvatarActionSent} />
      case 'completed':
        close()
        return null
      default:
        return null
    }
  }

  const content = renderStep()
  if (!content) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}
