import { useRef, useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * RAF-based progress computation for hob animations.
 * Returns an array of progress values [0..1] for each hob.
 * Does NOT trigger state transitions — that's handled by
 * the interval in GameShell.
 */
export function useHobProgress() {
  const [progresses, setProgresses] = useState([0, 0, 0])
  const rafRef = useRef(null)

  useEffect(() => {
    const animate = () => {
      const now = Date.now()
      const hobs = useGameStore.getState().hobs

      const p = hobs.map((hob) => {
        if (!hob.startedAt || hob.status === 'empty' || hob.status === 'burning') return 0
        const duration = hob.status === 'cooking' ? hob.cookingMs : hob.readyMs
        if (!duration || duration <= 0) return 0
        return Math.min((now - hob.startedAt) / duration, 1.0)
      })

      setProgresses(p)
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return progresses
}
