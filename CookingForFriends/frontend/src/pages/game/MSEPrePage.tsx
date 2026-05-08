import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig, submitExperimentResponses } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

export default function MSEPrePage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [note, setNote] = useState('Memory Self-Efficacy scale items to be confirmed.')
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    getExperimentConfig(sessionId, 'MSE_PRE')
      .then((config) => {
        const questionnaire = config.questionnaire as { note?: string } | undefined
        if (questionnaire?.note) setNote(questionnaire.note)
      })
      .catch((e) => console.error('[MSEPre] config load failed', e))
  }, [sessionId])

  const handleContinue = async () => {
    if (!sessionId || loading || !acknowledged) return
    setLoading(true)
    try {
      await submitExperimentResponses(sessionId, [{
        phase: 'MSE_PRE',
        question_id: 'mse_pre_placeholder_ack',
        response_type: 'boolean',
        value: true,
        metadata: { pending_scale_items: true },
      }])
      const advanced = await advancePhase(sessionId, 'STORY_INTRO')
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[MSEPre] submit failed', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900">Memory Questions</h1>
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          {note}
        </p>
        <label className="mt-6 flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-4 w-4 accent-slate-900"
          />
          Continue with placeholder MSE item set.
        </label>
        <button
          onClick={handleContinue}
          disabled={!acknowledged || loading}
          className="mt-8 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

