/** Consent page — shows informed consent text, participant agrees to continue. */

import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { updatePhase } from '../../services/api'
import { PLACEHOLDER_INFORMED_CONSENT } from '../../constants/placeholders'

export default function ConsentPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [loading, setLoading] = useState(false)

  const handleAgree = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      await updatePhase(sessionId, 'consent', 'end')
    } catch (e) {
      console.error('[Consent] phase update failed', e)
    } finally {
      setLoading(false)
      setPhase('introduction')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        <div className="text-4xl mb-4 text-center">📋</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">
          Informed Consent
        </h1>
        <div className="bg-slate-50 rounded-xl p-6 mb-8 text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {PLACEHOLDER_INFORMED_CONSENT}
        </div>
        <button
          onClick={handleAgree}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white font-semibold rounded-xl transition-colors text-base"
        >
          {loading ? 'Please wait…' : 'I agree and wish to continue'}
        </button>
      </div>
    </div>
  )
}
