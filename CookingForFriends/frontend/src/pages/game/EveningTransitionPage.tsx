import { useEffect, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'

export default function EveningTransitionPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [text, setText] = useState("It's now evening. Time to prepare dinner for your friends.")
  const [duration, setDuration] = useState(2000)

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
    if (!sessionId) return
    const timer = setTimeout(() => {
      advancePhase(sessionId)
        .then((advanced) => setPhase(frontendPhaseForBackend(advanced.current_phase)))
        .catch((e) => console.error('[EveningTransition] advance failed', e))
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, sessionId, setPhase])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
      <p className="max-w-lg text-2xl font-semibold leading-relaxed text-white">{text}</p>
    </div>
  )
}

