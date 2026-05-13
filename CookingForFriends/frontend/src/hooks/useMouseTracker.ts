/** Mouse tracking hook — 100ms samples, HTTP batch upload every 60s. */

import { useCallback, useEffect, useRef } from 'react'
import { postMouseTrackingBatch } from '../services/api'
import { useGameStore } from '../stores/gameStore'
import { isMainExperimentPhase } from '../utils/phase'

const SAMPLE_INTERVAL = 100
const BATCH_INTERVAL = 60_000

type MouseTrackingRecord =
  | {
      type: 'sample'
      timestamp: number
      x: number
      y: number
      page_state: 'item_selection' | 'other'
    }
  | {
      type: 'event'
      event: 'item_selection_start' | 'item_selection_end'
      timestamp: number
      page_state: 'item_selection' | 'other'
      task_id?: string | null
      selected_item?: string
    }

function getPageState(): 'item_selection' | 'other' {
  return useGameStore.getState().pmPipelineState?.step === 'item_selection'
    ? 'item_selection'
    : 'other'
}

export function emitMouseTrackingEvent(
  event: Extract<MouseTrackingRecord, { type: 'event' }>['event'],
  detail: Omit<Extract<MouseTrackingRecord, { type: 'event' }>, 'type' | 'event' | 'timestamp' | 'page_state'> = {},
) {
  window.dispatchEvent(new CustomEvent('mouse-tracking:event', {
    detail: { event, ...detail },
  }))
}

export function useMouseTracker() {
  const bufferRef = useRef<MouseTrackingRecord[]>([])
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const flushingRef = useRef(false)
  const sessionId = useGameStore((s) => s.sessionId)
  const phase = useGameStore((s) => s.phase)

  const flush = useCallback(async (keepalive = false) => {
    if (!sessionId || bufferRef.current.length === 0 || flushingRef.current) return
    const records = bufferRef.current
    bufferRef.current = []
    flushingRef.current = true
    try {
      const res = await postMouseTrackingBatch(sessionId, records, { keepalive })
      if (!res.ok) {
        bufferRef.current = [...records, ...bufferRef.current].slice(-10000)
      }
    } catch {
      bufferRef.current = [...records, ...bufferRef.current].slice(-10000)
    } finally {
      flushingRef.current = false
    }
  }, [sessionId])

  useEffect(() => {
    if (!isMainExperimentPhase(phase) || !sessionId) {
      void flush(true)
      return
    }

    const handlePointerMove = (e: MouseEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleTrackingEvent = (e: Event) => {
      const custom = e as CustomEvent<{
        event: 'item_selection_start' | 'item_selection_end'
        task_id?: string | null
        selected_item?: string
      }>
      bufferRef.current.push({
        type: 'event',
        event: custom.detail.event,
        timestamp: Date.now(),
        page_state: getPageState(),
        task_id: custom.detail.task_id,
        selected_item: custom.detail.selected_item,
      })
    }

    const sampleInterval = setInterval(() => {
      bufferRef.current.push({
        type: 'sample',
        timestamp: Date.now(),
        x: lastPointerRef.current.x,
        y: lastPointerRef.current.y,
        page_state: getPageState(),
      })
    }, SAMPLE_INTERVAL)

    const batchInterval = setInterval(() => {
      void flush(false)
    }, BATCH_INTERVAL)

    document.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouse-tracking:event', handleTrackingEvent)

    return () => {
      clearInterval(sampleInterval)
      clearInterval(batchInterval)
      document.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouse-tracking:event', handleTrackingEvent)
      void flush(true)
    }
  }, [flush, phase, sessionId])
}
