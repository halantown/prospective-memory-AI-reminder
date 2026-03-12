import { useRef, useState, useEffect } from 'react'
import { useGameStore, HOB_STATUS } from '../store/gameStore'

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
        const noProgress = !hob.startedAt
          || hob.status === HOB_STATUS.EMPTY
          || hob.status === HOB_STATUS.ASH
        if (noProgress) return 0

        const isCooking = hob.status === HOB_STATUS.COOKING_SIDE1
          || hob.status === HOB_STATUS.COOKING_SIDE2
        const isBurning = hob.status === HOB_STATUS.BURNING
        const duration = isCooking ? hob.cookingMs
          : isBurning ? hob.burnMs
          : hob.readyMs
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
