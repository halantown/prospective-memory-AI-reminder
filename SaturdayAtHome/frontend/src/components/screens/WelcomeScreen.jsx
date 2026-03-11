import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { createSession } from '../../utils/api'

/**
 * Welcome screen — first screen the experimenter sees.
 * Creates a backend session, then transitions to encoding phase.
 */
export default function WelcomeScreen() {
  const [participantId, setParticipantId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const setSession = useGameStore((s) => s.setSession)
  const startBlockEncoding = useGameStore((s) => s.startBlockEncoding)

  const handleStart = async () => {
    const pid = participantId.trim()
    if (!pid) return setError('Enter a participant ID')

    setLoading(true)
    setError(null)

    try {
      const data = await createSession(pid)
      console.log('[Welcome] Session created:', data)

      // Store session in Zustand — this enables SSE connection
      setSession({
        sessionId: data.session_id,
        participantId: data.participant_id,
        group: data.group,
        conditionOrder: data.condition_order,
      })

      // Start block 1 encoding with the correct condition from the session
      const conditions = data.condition_order
      startBlockEncoding({
        blockNumber: 1,
        condition: conditions[0],
        taskPairId: 1,
      })
    } catch (err) {
      console.error('[Welcome] Failed to create session:', err)
      setError(`Failed to connect: ${err.message}. Is the backend running on :5000?`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-[480px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">🏠 Saturday At Home</h1>
          <p className="text-amber-100 text-sm mt-1">Prospective Memory Experiment</p>
        </div>

        {/* Form */}
        <div className="px-8 py-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Participant ID
            </label>
            <input
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleStart()}
              placeholder="e.g. P001"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-lg"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading || !participantId.trim()}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white font-bold text-lg rounded-xl transition-colors"
          >
            {loading ? '⏳ Creating session…' : '▶ Start Experiment'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            This will create a new experiment session and assign conditions via Latin Square.
            <br />
            Backend must be running on <code className="bg-slate-100 px-1 rounded">localhost:5000</code>
          </p>
        </div>
      </div>
    </div>
  )
}
