import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig, submitExperimentResponses } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

function titleForPhase(phase: string) {
  if (phase === 'POST_MANIP_CHECK') return 'Robot Reminder Question'
  if (phase === 'POST_SUBJECTIVE_DV') return 'Experience Ratings'
  if (phase === 'POST_NASA_TLX') return 'Task Load'
  if (phase === 'POST_MSE') return 'Memory Questions'
  if (phase === 'POST_RETRO_CHECK') return 'Memory Check'
  return 'Post-Test'
}

export default function PostTestFlowPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const phase = String(useGameStore((s) => s.phase))
  const setPhase = useGameStore((s) => s.setPhase)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [text, setText] = useState('')
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    setConfig(null)
    setText('')
    setRatings({})
    getExperimentConfig(sessionId, phase)
      .then((next) => setConfig(next as Record<string, unknown>))
      .catch((e) => console.error('[PostTest] config load failed', e))
  }, [sessionId, phase])

  const submit = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      if (phase === 'POST_MANIP_CHECK') {
        await submitExperimentResponses(sessionId, [{
          phase,
          question_id: 'robot_reminder_content_open',
          response_type: 'text',
          value: text,
        }])
      } else if (phase === 'POST_SUBJECTIVE_DV') {
        await submitExperimentResponses(sessionId, ['confidence_self', 'trust_agent', 'perceived_usefulness'].map((id) => ({
          phase,
          question_id: id,
          response_type: 'scale',
          value: ratings[id],
        })))
      } else {
        await submitExperimentResponses(sessionId, [{
          phase,
          question_id: `${phase.toLowerCase()}_placeholder_ack`,
          response_type: phase === 'POST_RETRO_CHECK' ? 'text' : 'boolean',
          value: phase === 'POST_RETRO_CHECK' ? text : true,
          metadata: { pending_final_scale_or_options: true },
        }])
      }
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[PostTest] submit failed', e)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = phase === 'POST_SUBJECTIVE_DV'
    ? ['confidence_self', 'trust_agent', 'perceived_usefulness'].every((id) => ratings[id])
    : phase === 'POST_MANIP_CHECK' || phase === 'POST_RETRO_CHECK'
      ? text.trim().length > 0
      : true

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900">{titleForPhase(phase)}</h1>

        {phase === 'POST_MANIP_CHECK' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700">
              In your own words, describe what the robot's reminders contained.
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-2 h-32 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm"
            />
          </div>
        )}

        {phase === 'POST_SUBJECTIVE_DV' && (
          <div className="mt-6 space-y-5">
            {[
              ['confidence_self', 'How confident were you in remembering the tasks?'],
              ['trust_agent', 'How much did you trust the robot assistant?'],
              ['perceived_usefulness', 'How useful were the robot reminders?'],
            ].map(([id, label]) => (
              <div key={id}>
                <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRatings((prev) => ({ ...prev, [id]: n }))}
                      className={`rounded-md border py-2 text-sm font-semibold ${
                        ratings[id] === n ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {phase !== 'POST_MANIP_CHECK' && phase !== 'POST_SUBJECTIVE_DV' && (
          <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
            {phase === 'POST_RETRO_CHECK'
              ? 'Retrospective memory check options are still pending. Enter any notes for this placeholder step.'
              : 'Scale items are still pending. This placeholder records progression through the phase.'}
            {phase === 'POST_RETRO_CHECK' && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="mt-3 h-24 w-full resize-none rounded-lg border border-amber-200 p-3 text-sm text-slate-800"
              />
            )}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit || loading}
          className="mt-8 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
