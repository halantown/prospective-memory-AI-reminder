import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { startSession } from '../../utils/api'

export default function WelcomeScreen() {
  const setSession = useGameStore(s => s.setSession)
  const setPhase = useGameStore(s => s.setPhase)
  const setBlockNumber = useGameStore(s => s.setBlockNumber)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token.trim()) return

    setLoading(true)
    setError(null)

    try {
      const data = await startSession(token.trim())
      setSession(data)
      setBlockNumber(data.current_block > 0 ? data.current_block : 1)
      setPhase('onboarding')
    } catch (err) {
      setError(err.message || 'Failed to start session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Saturday at Home</h1>
          <p className="text-slate-500">Welcome to the experiment</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Participant Token
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your token…"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-400 focus:outline-none text-lg text-center tracking-widest"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Starting…' : 'Begin'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Ask the experimenter if you need a token.
        </p>
      </motion.div>
    </div>
  )
}
