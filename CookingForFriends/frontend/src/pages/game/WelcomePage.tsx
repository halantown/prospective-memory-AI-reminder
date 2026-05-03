/** Welcome page with token login — references SaturdayAtHome pattern. */

import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getPublicExperimentConfig, getSessionStatus, startSession } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

export default function WelcomePage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [welcomeText, setWelcomeText] = useState<{
    cover_story?: string
    duration?: string
    training_notice?: string
  } | null>(null)
  const autoStartedRef = useRef(false)

  const setSession = useGameStore((s) => s.setSession)
  const setPhase = useGameStore((s) => s.setPhase)

  const handleStart = async (tokenOverride?: string) => {
    const t = (tokenOverride ?? token).trim().toUpperCase()
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
        condition: data.condition,
        task_order: data.task_order,
        is_test: data.is_test,
        current_phase: data.current_phase,
        cooking_definitions: data.cooking_definitions,
      })
      // Persist session for page refresh recovery
      sessionStorage.setItem('cff_session', JSON.stringify({
        session_id: data.session_id,
        participant_id: data.participant_id,
        token: t,
        condition: data.condition,
        task_order: data.task_order,
        is_test: data.is_test,
        current_phase: data.current_phase,
        cooking_definitions: data.cooking_definitions,
      }))

      // Check session status to resume at correct phase for returning participants
      try {
        const status = await getSessionStatus(data.session_id)
        if (status.status === 'completed') {
          setPhase('complete')
        } else {
          const current = frontendPhaseForBackend(status.phase || data.current_phase)
          if (current === 'welcome') {
            const advanced = await advancePhase(data.session_id, 'CONSENT')
            setPhase(frontendPhaseForBackend(advanced.current_phase))
          } else {
            setPhase(current)
          }
        }
      } catch {
        setPhase(frontendPhaseForBackend(data.current_phase || 'CONSENT'))
      }
    } catch (err: unknown) {
      console.error('[Welcome] Failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to start session')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getPublicExperimentConfig('WELCOME')
      .then((config) => {
        const welcome = config.welcome as typeof welcomeText
        setWelcomeText(welcome)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (autoStartedRef.current) return
    const urlToken = new URLSearchParams(window.location.search).get('token')?.trim().toUpperCase()
    if (!urlToken) return
    autoStartedRef.current = true
    setToken(urlToken)
    void handleStart(urlToken)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-cooking-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cooking-500 to-orange-500 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">🍳 Cooking for Friends</h1>
          <p className="text-orange-100 text-sm mt-1">Prospective Memory Session</p>
        </div>

        {/* Form */}
        <div className="px-8 py-6 space-y-5">
          <div>
            <p className="text-slate-600 text-sm mb-4">
              {welcomeText?.cover_story
                ?? "Welcome! You'll be preparing dinner and completing a few memory tasks during this session."}
            </p>
            {welcomeText?.duration && (
              <p className="text-slate-500 text-sm mb-2">{welcomeText.duration}</p>
            )}
            {welcomeText?.training_notice && (
              <p className="text-slate-500 text-sm">{welcomeText.training_notice}</p>
            )}
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
            onClick={() => handleStart()}
            disabled={loading || token.trim().length !== 6}
            className="w-full py-3 bg-cooking-500 hover:bg-cooking-600
                       disabled:bg-cooking-200 text-white font-bold text-lg
                       rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Starting…' : 'Start Session'}
          </button>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">
            Session data is anonymized
          </p>
        </div>
      </div>
    </div>
  )
}
