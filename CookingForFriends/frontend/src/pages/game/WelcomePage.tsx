/** Welcome page with token login — references SaturdayAtHome pattern. */

import { useEffect, useRef, useState } from 'react'
import { ChefHat, KeyRound } from 'lucide-react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getPublicExperimentConfig, getSessionStatus, setSessionToken, startSession } from '../../services/api'
import { frontendPhaseForBackend, renderPhaseFor } from '../../utils/phase'


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
  const autoStartedRef = useRef(false)

  const setSession = useGameStore((s) => s.setSession)
  const setPhase = useGameStore((s) => s.setPhase)

  /** Start session and navigate to the current phase. */
  const startAndNavigate = async (tokenOverride?: string) => {
    const t = (tokenOverride ?? token).trim().toUpperCase()
    if (t.length !== 6) {
      setError('Please enter the 6-character session token')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await startSession(t)
      setSessionToken(t)
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
    <div className="min-h-screen bg-stone-50 px-4 py-6 text-slate-900 sm:px-6">
      <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg md:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden border-r border-slate-200 bg-stone-100 p-8 md:flex md:flex-col md:justify-between">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-cooking-100 text-cooking-700">
                <ChefHat className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-5 text-3xl font-bold text-slate-950">Cooking for Friends</h1>
              <p className="mt-2 text-sm font-medium text-slate-600">Prospective Memory Session</p>
            </div>
            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <img
                src="/assets/floorplan.png"
                alt=""
                className="h-64 w-full object-contain"
              />
            </div>
          </section>

          <section className="px-6 py-7 sm:px-8">
            <div className="mb-6 md:hidden">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cooking-100 text-cooking-700">
                <ChefHat className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-2xl font-bold text-slate-950">Cooking for Friends</h1>
              <p className="mt-1 text-sm font-medium text-slate-600">Prospective Memory Session</p>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-sm leading-relaxed text-slate-600">
                  {welcomeText.cover_story}
                </p>
                {welcomeText?.duration && (
                  <p className="mt-3 text-sm text-slate-500">{welcomeText.duration}</p>
                )}
                {welcomeText?.training_notice && (
                  <p className="mt-2 text-sm text-slate-500">{welcomeText.training_notice}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Session Token
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleStart()}
                  placeholder="e.g. AMBER7"
                  maxLength={6}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3
                             text-center font-mono text-lg uppercase tracking-widest text-slate-900
                             focus:border-cooking-500 focus:outline-none focus:ring-2 focus:ring-cooking-200"
                  autoFocus
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Ask the experimenter for your 6-character token
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={() => handleStart()}
                disabled={loading || token.trim().length !== 6}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-cooking-600 py-3
                           text-base font-bold text-white transition-colors hover:bg-cooking-700
                           disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" />
                    Starting...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-5 w-5" aria-hidden="true" />
                    Start Session
                  </>
                )}
              </button>
            </div>

            <p className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
              Session data is anonymized
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
