import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig, submitExperimentResponses } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'
import BubbleDialogue from '../../components/game/dialogue/BubbleDialogue'
import ExperimentHomeShell from '../../components/game/ExperimentHomeShell'

interface Option {
  id: string
  text: string
}

function tutorialKind(phase: string) {
  if (phase === 'TUTORIAL_PHONE') return 'phone'
  if (phase === 'TUTORIAL_COOKING') return 'cooking'
  if (phase === 'TUTORIAL_TRIGGER') return 'trigger'
  return 'unknown'
}

export default function TutorialFlowPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const phase = String(useGameStore((s) => s.phase))
  const setPhase = useGameStore((s) => s.setPhase)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const startedAtRef = useRef(Date.now())
  const kind = tutorialKind(phase)

  useEffect(() => {
    if (!sessionId) return
    setConfig(null)
    setSelected(null)
    setStepIndex(0)
    startedAtRef.current = Date.now()
    getExperimentConfig(sessionId, phase)
      .then((next) => setConfig(next as Record<string, unknown>))
      .catch((e) => console.error('[TutorialFlow] config load failed', e))
  }, [sessionId, phase])

  const advance = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[TutorialFlow] advance failed', e)
    } finally {
      setLoading(false)
    }
  }

  const recordAndAdvance = async (questionId: string, value: unknown, metadata?: Record<string, unknown>) => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      await submitExperimentResponses(sessionId, [{
        phase,
        question_id: questionId,
        response_type: typeof value === 'boolean' ? 'boolean' : 'choice',
        value,
        metadata,
      }])
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[TutorialFlow] response submit failed', e)
    } finally {
      setLoading(false)
    }
  }

  if (!config) {
    return (
      <ExperimentHomeShell initialRoom="bedroom" morningMode disableNavigation>
        <div className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-xl">
          Loading...
        </div>
      </ExperimentHomeShell>
    )
  }

  if (kind === 'phone') {
    const demo = config.phone_demo as {
      contact: { name: string }
      message: string
      options: Option[]
      feedback: string
    }
    return (
      <ExperimentHomeShell initialRoom="bedroom" morningMode disableNavigation phoneDisabled={false}>
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h1 className="text-xl font-bold text-slate-900">Phone Practice</h1>
          <div className="mt-5 rounded-lg bg-slate-900 p-4 text-white">
            <div className="text-xs uppercase tracking-wide text-slate-400">{demo.contact.name}</div>
            <div className="mt-2 text-sm">{demo.message}</div>
          </div>
          <div className="mt-4 grid gap-2">
            {demo.options.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`rounded-lg border px-4 py-3 text-left text-sm ${
                  selected === option.id ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-white'
                }`}
              >
                {option.text}
              </button>
            ))}
          </div>
          <button
            onClick={() => recordAndAdvance('tutorial_phone_reply', selected, { response_time_ms: Date.now() - startedAtRef.current })}
            disabled={!selected || loading}
            className="mt-5 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {loading ? 'Saving...' : 'Send Reply'}
          </button>
        </div>
      </ExperimentHomeShell>
    )
  }

  if (kind === 'cooking') {
    const friedEgg = config.fried_egg as {
      recipe_name: string
      steps: Array<{ id: string; recipe_text: string; options?: Option[]; timer_s?: number }>
    }
    const step = friedEgg.steps[stepIndex]
    const isLast = stepIndex >= friedEgg.steps.length - 1
    return (
      <ExperimentHomeShell initialRoom="kitchen" morningMode disableNavigation>
        <div className="w-full max-w-2xl rounded-xl bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-slate-900">{friedEgg.recipe_name}</h1>
          <div className="mt-4 rounded-lg bg-amber-100 p-4 text-sm text-amber-950">
            Recipe says: {step.recipe_text}
          </div>
          {step.options ? (
            <div className="mt-4 grid gap-2">
              {step.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelected(option.id)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm ${
                    selected === option.id ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-white'
                  }`}
                >
                  {option.text}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
              Timer demo: {step.timer_s ?? 15} seconds
            </div>
          )}
          <button
            onClick={async () => {
              if (!sessionId || loading) return
              await submitExperimentResponses(sessionId, [{
                phase,
                question_id: `tutorial_cooking_${step.id}`,
                response_type: step.options ? 'choice' : 'boolean',
                value: step.options ? selected : true,
                metadata: { step_index: stepIndex },
              }])
              if (isLast) {
                await advance()
              } else {
                setSelected(null)
                setStepIndex((i) => i + 1)
              }
            }}
            disabled={(Boolean(step.options) && !selected) || loading}
            className="mt-6 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {isLast ? 'Finish Practice' : 'Next Step'}
          </button>
        </div>
      </ExperimentHomeShell>
    )
  }

  const trigger = config.trigger_demo as {
    visitor: string
    visitor_line: string
    robot_line: string
    action_label: string
  }
  return (
    <ExperimentHomeShell initialRoom="living_room" morningMode disableNavigation>
      <div className="w-full max-w-3xl space-y-3 pb-8">
        <BubbleDialogue speaker={trigger.visitor} text={trigger.visitor_line} avatar="S" />
        <BubbleDialogue speaker="ROBOT" text={trigger.robot_line} avatar="R" align="right" />
        <button
          onClick={() => recordAndAdvance('tutorial_trigger_action', true, { action_label: trigger.action_label })}
          disabled={loading}
          className="w-full rounded-lg bg-white py-3 text-sm font-semibold text-slate-900 shadow-lg disabled:bg-slate-300"
        >
          {loading ? 'Saving...' : trigger.action_label}
        </button>
      </div>
    </ExperimentHomeShell>
  )
}
