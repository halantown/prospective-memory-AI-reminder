import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { createSession, fetchBlockConfig } from '../../utils/api'

export default function WelcomeScreen() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const setSession = useGameStore((s) => s.setSession)
  const startBlockEncoding = useGameStore((s) => s.startBlockEncoding)

  const handleStart = async () => {
    const t = token.trim().toUpperCase()
    if (t.length !== 6) return setError('Enter the 6-character session token')

    setLoading(true)
    setError(null)

    try {
      const session = await createSession(t)
      setSession({
        sessionId: session.session_id,
        participantId: session.participant_id,
        group: session.group,
        conditionOrder: session.condition_order,
      })

      const blockConfig = await fetchBlockConfig(session.session_id, 1)
      startBlockEncoding(blockConfig)
    } catch (err) {
      setError(`Failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-[520px] overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">Saturday At Home</h1>
          <p className="text-amber-100 text-sm mt-1">State-driven day simulation experiment</p>
        </div>

        <div className="px-8 py-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Session Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleStart()}
              placeholder="e.g. AMBER7"
              maxLength={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-lg tracking-widest font-mono text-center"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-slate-400 mt-1">Ask the experimenter for your 6-character token</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading || token.trim().length !== 6}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white font-bold text-lg rounded-xl transition-colors"
          >
            {loading ? 'Starting…' : 'Start Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
