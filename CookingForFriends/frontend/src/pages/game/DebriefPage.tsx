import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig, submitExperimentResponses } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

export default function DebriefPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [text, setText] = useState('Thank you for completing the study.')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    getExperimentConfig(sessionId, 'DEBRIEF')
      .then((config) => {
        const debrief = config.debrief as { text?: string } | undefined
        if (debrief?.text) setText(debrief.text)
      })
      .catch((e) => console.error('[Debrief] config load failed', e))
  }, [sessionId])

  const handleComplete = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    setError(null)
    try {
      await submitExperimentResponses(sessionId, [{
        phase: 'DEBRIEF',
        question_id: 'debrief_acknowledged',
        response_type: 'boolean',
        value: true,
      }])
      const advanced = await advancePhase(sessionId, 'COMPLETED')
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[Debrief] complete failed', e)
      setError('Failed to submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-lg bg-stone-100 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900">Debrief</h1>
        <div className="mt-5 whitespace-pre-wrap rounded-lg bg-white/70 p-5 text-sm leading-relaxed text-slate-700">
          {text}
        </div>
        {error && (
          <div className="mt-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <button
          onClick={handleComplete}
          disabled={loading}
          className="mt-8 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? <><span className="btn-spinner" />Completing...</> : 'Complete Experiment'}
        </button>
      </div>
    </div>
  )
}
