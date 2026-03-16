import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

function getInitialPointer() {
  if (typeof window === 'undefined') return { x: 360, y: 260 }
  return {
    x: Math.round(window.innerWidth * 0.56),
    y: Math.round(window.innerHeight * 0.5),
  }
}

export default function ScoreBurstLayer() {
  const phase = useGameStore((s) => s.phase)
  const score = useGameStore((s) => s.score)
  const prevScoreRef = useRef(score)
  const pointerRef = useRef(getInitialPointer())
  const [bursts, setBursts] = useState([])

  useEffect(() => {
    const updatePointer = (event) => {
      pointerRef.current = { x: event.clientX, y: event.clientY }
    }
    window.addEventListener('pointermove', updatePointer)
    window.addEventListener('pointerdown', updatePointer)
    return () => {
      window.removeEventListener('pointermove', updatePointer)
      window.removeEventListener('pointerdown', updatePointer)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'block_running') {
      prevScoreRef.current = score
      return
    }

    const delta = score - prevScoreRef.current
    if (delta !== 0) {
      const id = Date.now() + Math.random()
      const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280
      const viewportH = typeof window !== 'undefined' ? window.innerHeight : 720
      const x = Math.max(28, Math.min(viewportW - 28, pointerRef.current.x + 18))
      const y = Math.max(68, Math.min(viewportH - 32, pointerRef.current.y - 8))

      setBursts((prev) => [...prev, { id, delta, x, y }])
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((burst) => burst.id !== id))
      }, 900)
    }
    prevScoreRef.current = score
  }, [score, phase])

  return (
    <div className="pointer-events-none fixed inset-0 z-[95]">
      <AnimatePresence>
        {bursts.map((burst) => (
          <motion.div
            key={burst.id}
            initial={{ opacity: 0, y: 14, scale: 0.72 }}
            animate={{ opacity: 1, y: -10, scale: 1 }}
            exit={{ opacity: 0, y: -32, scale: 0.9 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute"
            style={{ left: burst.x, top: burst.y, transform: 'translate(-50%, -50%)' }}
          >
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-xl border-2 text-2xl font-black tracking-wide shadow-[0_12px_28px_rgba(15,23,42,0.45)] ${
                burst.delta > 0
                  ? 'text-emerald-100 bg-emerald-600/95 border-emerald-100/90'
                  : 'text-red-100 bg-red-600/95 border-red-100/90'
              }`}
            >
              {burst.delta > 0 ? `+${burst.delta}` : `${burst.delta}`}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
