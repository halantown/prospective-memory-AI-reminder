/** Mouse tracking hook — samples at 200ms, batches every 5s. */

import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'

const SAMPLE_INTERVAL = 200
const BATCH_INTERVAL = 5000

export function useMouseTracker() {
  const bufferRef = useRef<Array<{ x: number; y: number; t: number }>>([])
  const wsSend = useGameStore((s) => s.wsSend)
  const phase = useGameStore((s) => s.phase)

  useEffect(() => {
    if (phase !== 'playing') return

    // Sample mouse position
    const sampleInterval = setInterval(() => {
      // We track the last known position
    }, SAMPLE_INTERVAL)

    const handleMove = (e: MouseEvent) => {
      bufferRef.current.push({
        x: e.clientX,
        y: e.clientY,
        t: Date.now(),
      })
    }

    // Batch upload
    const batchInterval = setInterval(() => {
      if (bufferRef.current.length > 0 && wsSend) {
        wsSend({
          type: 'mouse_position',
          data: bufferRef.current,
        })
        bufferRef.current = []
      }
    }, BATCH_INTERVAL)

    // Only sample at 200ms intervals
    let lastSample = 0
    const throttledMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastSample >= SAMPLE_INTERVAL) {
        lastSample = now
        handleMove(e)
      }
    }

    document.addEventListener('mousemove', throttledMove)

    return () => {
      clearInterval(sampleInterval)
      clearInterval(batchInterval)
      document.removeEventListener('mousemove', throttledMove)
      // Flush remaining
      if (bufferRef.current.length > 0 && wsSend) {
        wsSend({ type: 'mouse_position', data: bufferRef.current })
        bufferRef.current = []
      }
    }
  }, [phase, wsSend])
}
