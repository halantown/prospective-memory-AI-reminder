/** Post-questionnaire page — shows questionnaire and NASA-TLX placeholder. */

import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { updatePhase } from '../../services/api'
import { PLACEHOLDER_POST_QUESTIONNAIRE, PLACEHOLDER_NASA_TLX } from '../../constants/placeholders'

export default function PostQuestionnairePage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      await updatePhase(sessionId, 'post_questionnaire', 'end')
    } catch (e) {
      console.error('[PostQuestionnaire] phase update failed', e)
    } finally {
      setLoading(false)
      setPhase('debrief')
    }
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="bg-stone-100 rounded-lg shadow-xl max-w-2xl w-full p-8 space-y-6">
        <div className="text-4xl text-center">📝</div>
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          Post-Experiment Questionnaire
        </h1>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Questionnaire
          </h2>
          <div className="bg-white/70 rounded-lg p-5 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
            {PLACEHOLDER_POST_QUESTIONNAIRE}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            NASA Task Load Index (TLX)
          </h2>
          <div className="bg-cooking-50 rounded-lg p-5 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
            {PLACEHOLDER_NASA_TLX}
          </div>
        </section>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300
                     text-white font-semibold rounded-lg transition-colors text-base"
        >
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
