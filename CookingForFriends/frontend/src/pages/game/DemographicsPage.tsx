import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, submitExperimentResponses } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'] as const
const PROFICIENCY_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Native / near-native'] as const

export default function DemographicsPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [genderOther, setGenderOther] = useState('')
  const [proficiency, setProficiency] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveGender = gender === 'Other' ? genderOther.trim() : gender

  const isComplete =
    age !== '' &&
    Number.isInteger(Number(age)) &&
    Number(age) >= 18 &&
    Number(age) <= 99 &&
    effectiveGender !== '' &&
    proficiency !== ''

  const handleSubmit = async () => {
    if (!sessionId || loading || !isComplete) return
    setLoading(true)
    setError(null)
    try {
      await submitExperimentResponses(sessionId, [
        {
          phase: 'DEMOGRAPHICS',
          question_id: 'age',
          response_type: 'integer',
          value: Number.parseInt(age, 10),
        },
        {
          phase: 'DEMOGRAPHICS',
          question_id: 'gender',
          response_type: 'text',
          value: effectiveGender,
        },
        {
          phase: 'DEMOGRAPHICS',
          question_id: 'english_proficiency',
          response_type: 'text',
          value: proficiency,
        },
      ])
      const advanced = await advancePhase(sessionId, 'MSE_PRE')
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[Demographics] submit failed', e)
      setError('Failed to submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-xl font-bold text-slate-900 mb-6">Background Questions</h1>
        <form
          autoComplete="off"
          onSubmit={(e) => e.preventDefault()}
          className="space-y-5"
        >
          {/* Age */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Age <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              autoComplete="off"
              name="study-participant-age"
              min={18}
              max={99}
              step={1}
              value={age}
              placeholder="e.g. 24"
              onChange={(e) => {
                const v = e.target.value
                if (v === '' || /^\d+$/.test(v)) setAge(v)
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Gender <span className="text-red-500">*</span>
            </label>
            <select
              value={gender}
              autoComplete="off"
              name="study-participant-gender"
              onChange={(e) => { setGender(e.target.value); setGenderOther('') }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            {gender === 'Other' && (
              <input
                type="text"
                autoComplete="off"
                name="study-participant-gender-other"
                value={genderOther}
                placeholder="Please specify"
                onChange={(e) => setGenderOther(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            )}
          </div>

          {/* English proficiency */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              English proficiency <span className="text-red-500">*</span>
            </label>
            <select
              value={proficiency}
              autoComplete="off"
              name="study-participant-english"
              onChange={(e) => setProficiency(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Select…</option>
              {PROFICIENCY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </form>

        {error && (
          <div className="mt-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isComplete || loading}
          className="mt-8 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? <><span className="btn-spinner" />Saving...</> : 'Continue'}
        </button>
      </div>
    </div>
  )
}
