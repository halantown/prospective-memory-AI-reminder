import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig, submitExperimentResponses } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

interface DemographicQuestion {
  question_id: string
  response_type: string
  label: string
}

export default function DemographicsPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [questions, setQuestions] = useState<DemographicQuestion[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    getExperimentConfig(sessionId, 'DEMOGRAPHICS')
      .then((config) => setQuestions((config.questions as DemographicQuestion[]) ?? []))
      .catch((e) => console.error('[Demographics] config load failed', e))
  }, [sessionId])

  const setValue = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }))
  }

  const isComplete = questions.every((q) => values[q.question_id]?.trim())

  const handleSubmit = async () => {
    if (!sessionId || loading || !isComplete) return
    setLoading(true)
    try {
      await submitExperimentResponses(sessionId, questions.map((q) => {
        const raw = values[q.question_id]
        let value: unknown = raw
        if (q.response_type === 'integer') value = Number.parseInt(raw, 10)
        if (q.response_type === 'boolean') value = raw === 'yes'
        return {
          phase: 'DEMOGRAPHICS',
          question_id: q.question_id,
          response_type: q.response_type,
          value,
        }
      }))
      const advanced = await advancePhase(sessionId, 'MSE_PRE')
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[Demographics] submit failed', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900">Background Questions</h1>
        <div className="mt-6 space-y-4">
          {questions.map((q) => (
            <div key={q.question_id}>
              <label className="mb-1 block text-sm font-medium text-slate-700">{q.label}</label>
              {q.response_type === 'boolean' ? (
                <select
                  value={values[q.question_id] ?? ''}
                  onChange={(e) => setValue(q.question_id, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <input
                  type={q.response_type === 'integer' ? 'number' : 'text'}
                  value={values[q.question_id] ?? ''}
                  onChange={(e) => setValue(q.question_id, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isComplete || loading}
          className="mt-8 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

