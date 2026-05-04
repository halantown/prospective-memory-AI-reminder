/** Welcome page with token login — references SaturdayAtHome pattern. */

import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getPublicExperimentConfig, getSessionStatus, startSession } from '../../services/api'
import { frontendPhaseForBackend, renderPhaseFor } from '../../utils/phase'

const DEV_PHASES = [
  { value: 'CONSENT',          label: 'Consent' },
  { value: 'DEMOGRAPHICS',     label: 'Demographics' },
  { value: 'MSE_PRE',          label: 'MSE Pre' },
  { value: 'STORY_INTRO',      label: 'Story Intro' },
  { value: 'MAIN_EXPERIMENT',  label: '🎮 Game (playing)' },
  { value: 'POST_MANIP_CHECK', label: 'Post-test' },
  { value: 'DEBRIEF',          label: 'Debrief' },
] as const

const DEFAULT_WELCOME_TEXT = {
  cover_story: 'This study investigates how people manage multiple household tasks simultaneously in a simulated home environment. You will be asked to prepare dinner for friends while handling various everyday interruptions.',
  duration: 'The experiment takes approximately 30-35 minutes.',
  training_notice: 'You will receive a brief training session before the main task begins.',
}

export default function WelcomePage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [welcomeText, setWelcomeText] = useState<{
    cover_story?: string
    duration?: string
    training_notice?: string
  }>(DEFAULT_WELCOME_TEXT)
  const [devOpen, setDevOpen] = useState(false)
  const [jumpPhase, setJumpPhase] = useState<string>('MAIN_EXPERIMENT')
  const autoStartedRef = useRef(false)

  const setSession = useGameStore((s) => s.setSession)
  const setPhase = useGameStore((s) => s.setPhase)

  /** Start session and optionally jump to a specific phase. */
  const startAndNavigate = async (tokenOverride?: string, targetPhase?: string) => {
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

      if (targetPhase) {
        // Dev quick-jump: skip straight to the requested phase
        const advanced = await advancePhase(data.session_id, targetPhase)
        setPhase(frontendPhaseForBackend(advanced.current_phase))
        return
      }

      // Normal flow: resume at current phase or advance past welcome
      try {
        const status = await getSessionStatus(data.session_id)
        if (status.status === 'completed') {
          setPhase('complete')
        } else {
          const current = frontendPhaseForBackend(status.phase || data.current_phase)
          if (renderPhaseFor(current) === 'welcome') {
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

  const handleStart = (tokenOverride?: string) => startAndNavigate(tokenOverride)
  const handleDevJump = () => startAndNavigate(undefined, jumpPhase)

  useEffect(() => {
    getPublicExperimentConfig('WELCOME')
      .then((config) => {
        setWelcomeText({
          ...DEFAULT_WELCOME_TEXT,
          ...((config.welcome as Partial<typeof DEFAULT_WELCOME_TEXT> | undefined) ?? {}),
        })
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
              {welcomeText.cover_story}
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

          {/* Dev quick-jump panel */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setDevOpen((v) => !v)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors w-full text-left"
            >
              {devOpen ? '▾' : '▸'} Dev: quick phase jump
            </button>
            {devOpen && (
              <div className="mt-2 flex gap-2">
                <select
                  value={jumpPhase}
                  onChange={(e) => setJumpPhase(e.target.value)}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  {DEV_PHASES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleDevJump}
                  disabled={loading || token.trim().length !== 6}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold
                             disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {loading ? '…' : 'Jump →'}
                </button>
              </div>
            )}
          </div>
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
