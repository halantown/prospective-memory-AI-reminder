/** Introduction page — shows study introduction and trial session instructions. */

import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { updatePhase } from '../../services/api'
import { PLACEHOLDER_INTRODUCTION, PLACEHOLDER_TRIAL_SESSION } from '../../constants/placeholders'

export default function IntroductionPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [loading, setLoading] = useState(false)

  const handleReady = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      await updatePhase(sessionId, 'introduction', 'end')
    } catch (e) {
      console.error('[Introduction] phase update failed', e)
    } finally {
      setLoading(false)
      setPhase('encoding')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 space-y-6">
        <div className="text-4xl text-center">🍳</div>
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          Introduction
        </h1>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            About the Task
          </h2>
          <div className="bg-slate-50 rounded-xl p-5 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
            {PLACEHOLDER_INTRODUCTION}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Trial Session
          </h2>
          <div className="bg-emerald-50 rounded-xl p-5 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
            {PLACEHOLDER_TRIAL_SESSION}
          </div>
        </section>

        <button
          onClick={handleReady}
          disabled={loading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300
                     text-white font-semibold rounded-xl transition-colors text-base"
        >
          {loading ? 'Please wait…' : 'Ready to begin'}
        </button>
      </div>
    </div>
  )
}
