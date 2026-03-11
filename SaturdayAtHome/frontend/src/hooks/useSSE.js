import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * SSE client hook — connects to backend event stream and maps
 * SSE events to Zustand store actions.
 *
 * Only connects when sessionId + blockNumber are set and blockRunning is true.
 * In demo mode (no sessionId), this hook does nothing.
 */
export default function useSSE() {
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const blockRunning = useGameStore((s) => s.blockRunning)
  const setSseConnected = useGameStore((s) => s.setSseConnected)
  const esRef = useRef(null)

  useEffect(() => {
    if (!sessionId || !blockNumber || !blockRunning) return

    const url = `/api/session/${sessionId}/block/${blockNumber}/stream`
    console.log('[SSE] Connecting to', url)

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      console.log('[SSE] Connected')
      setSseConnected(true)
    }

    es.onerror = (e) => {
      console.warn('[SSE] Connection error', e)
      setSseConnected(false)
    }

    // Map SSE event types → Zustand store actions
    const eventHandlers = {
      steak_spawn:        (d) => useGameStore.getState().spawnSteak(d.hob_id, d.duration),
      force_yellow_steak: (d) => useGameStore.getState().forceYellowSteak(d.hob_id),
      trigger_appear:     (d) => useGameStore.getState().triggerAppear(d.task_id),
      window_close:       (d) => useGameStore.getState().windowClose(d.task_id),
      reminder_fire:      (d) => useGameStore.getState().triggerRobot(d.text),
      robot_neutral:      (d) => useGameStore.getState().triggerRobot(d.text),
      fake_trigger_fire:  (d) => useGameStore.getState().triggerFake(d.type),
      message_bubble:     (d) => useGameStore.getState().addMessageBubble(d),
      plant_needs_water:  ()  => useGameStore.getState().showPlantNeedsWater(),
      block_start:        (d) => console.log('[SSE] block_start', d),
      block_end:          (d) => useGameStore.getState().endBlock(),
      keepalive:          ()  => {},
    }

    Object.entries(eventHandlers).forEach(([event, handler]) => {
      es.addEventListener(event, (e) => {
        try {
          const data = JSON.parse(e.data)
          console.log(`[SSE] ← ${event}`, data)
          handler(data)
        } catch (err) {
          console.error(`[SSE] Failed to handle ${event}`, err)
        }
      })
    })

    return () => {
      console.log('[SSE] Disconnecting')
      es.close()
      esRef.current = null
      setSseConnected(false)
    }
  }, [sessionId, blockNumber, blockRunning, setSseConnected])
}
