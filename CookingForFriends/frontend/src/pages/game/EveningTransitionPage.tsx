import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

export default function EveningTransitionPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const setGameClock = useGameStore((s) => s.setGameClock)
  const setElapsedSeconds = useGameStore((s) => s.setElapsedSeconds)
  const [text, setText] = useState("It's now evening. Time to prepare dinner for your friends.")
  const [duration, setDuration] = useState(2000)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const advanceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setVisible(true)
    return () => {
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    getExperimentConfig(sessionId, 'EVENING_TRANSITION')
      .then((config) => {
        const transition = config.transition as { text?: string; duration_ms?: number } | undefined
        if (transition?.text) setText(transition.text)
        if (transition?.duration_ms) setDuration(transition.duration_ms)
      })
      .catch((e) => console.error('[EveningTransition] config load failed', e))
  }, [sessionId])

  useEffect(() => {
    setReady(false)
    const timer = setTimeout(() => {
      setReady(true)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration])

  const continueToDinner = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    setExiting(true)
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = window.setTimeout(async () => {
      setGameClock('17:00')
      setElapsedSeconds(0)
      try {
        const advanced = await advancePhase(sessionId)
        setPhase(frontendPhaseForBackend(advanced.current_phase))
      } catch (e) {
        console.error('[EveningTransition] advance failed', e)
        setLoading(false)
        setExiting(false)
      }
      advanceTimerRef.current = null
    }, 650)
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6 text-center">
      <div className={`relative flex min-h-[220px] w-full max-w-xl flex-col items-center justify-center transition-opacity duration-700 ${
        visible && !exiting ? 'opacity-100' : 'opacity-0'
      }`}>
        <p className="max-w-lg text-2xl font-semibold leading-relaxed text-white">{text}</p>
        {ready && (
          <button
            onClick={continueToDinner}
            disabled={loading}
            className="absolute bottom-0 rounded-lg border border-white/25 bg-white px-6 py-3 text-sm font-semibold text-slate-950 disabled:bg-slate-400"
          >
            {loading ? 'Starting...' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}
