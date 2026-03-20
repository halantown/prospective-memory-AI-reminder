/** Welcome page with token login — references SaturdayAtHome pattern. */

import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { startSession } from '../../services/api'

export default function WelcomePage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setSession = useGameStore((s) => s.setSession)
  const setPhase = useGameStore((s) => s.setPhase)
  const setBlockNumber = useGameStore((s) => s.setBlockNumber)

  const handleStart = async () => {
    const t = token.trim().toUpperCase()
    if (t.length !== 6) {
      setError('Please enter the 6-character session token')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await startSession(t)
      console.log('[Welcome] Session started:', data)

      setSession({
        session_id: data.session_id,
        participant_id: data.participant_id,
        group: data.group,
        condition_order: data.condition_order as any,
        current_block: data.current_block,
      })
      setBlockNumber(data.current_block > 0 ? data.current_block : 1)
      setPhase('encoding')
    } catch (err: any) {
      console.error('[Welcome] Failed:', err)
      setError(err.message || 'Failed to start session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cooking-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cooking-500 to-orange-500 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">🍳 Cooking for Friends</h1>
          <p className="text-orange-100 text-sm mt-1">Prospective Memory Experiment</p>
        </div>

        {/* Form */}
        <div className="px-8 py-6 space-y-5">
          <div>
            <p className="text-slate-600 text-sm mb-4">
              Welcome! Over the next three days, you'll be preparing dinner for
              different friends. Along the way, you'll need to remember to do a
              few things around the house.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Session Token
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleStart()}
              placeholder="e.g. AMBER7"
              maxLength={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-cooking-400
                         text-lg tracking-widest font-mono text-center uppercase"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-slate-400 mt-1">
              Ask the experimenter for your 6-character token
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading || token.trim().length !== 6}
            className="w-full py-3 bg-cooking-500 hover:bg-cooking-600
                       disabled:bg-cooking-200 text-white font-bold text-lg
                       rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Starting…' : 'Start Experiment'}
          </button>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">
            Cognitive Science Experiment — All data is anonymized
          </p>
        </div>
      </div>
    </div>
  )
}
