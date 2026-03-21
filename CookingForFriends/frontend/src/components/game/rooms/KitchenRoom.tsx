/** Kitchen room — steak cooking with 3 pans.
 *  State machine per steak:
 *    cooking (30s) → ready_to_flip (10s window) → cooking_side2 (25s) → ready_to_plate (10s window) → burnt
 *  Missing the flip or plate window → burnt immediately.
 *  Timers run as long as the component is mounted (even when room is inactive)
 *  so the participant must monitor from other rooms.
 */

import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { SteakState } from '../../../types'
import PMTargetItems from '../PMTargetItems'

const COOK_SIDE1_DURATION = 30_000
const FLIP_WINDOW = 10_000
const COOK_SIDE2_DURATION = 25_000
const PLATE_WINDOW = 10_000

export default function KitchenRoom({ isActive }: { isActive: boolean }) {
  const pans = useGameStore((s) => s.pans)
  const updatePan = useGameStore((s) => s.updatePan)
  const addKitchenScore = useGameStore((s) => s.addKitchenScore)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const mountedRef = useRef(true)

  const reportAction = (panId: number, action: string) => {
    const send = useGameStore.getState().wsSend
    if (send) {
      send({
        type: 'task_action',
        data: { task: 'steak', action, pan_id: panId, timestamp: Date.now() / 1000 },
      })
    }
  }

  const clearTimer = (key: string) => {
    const timer = timersRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(key)
    }
  }

  const setTimer = (key: string, fn: () => void, ms: number) => {
    clearTimer(key)
    timersRef.current.set(key, setTimeout(fn, ms))
  }

  // Reactive timer management
  useEffect(() => {
    pans.forEach(pan => {
      const timerKey = `pan_${pan.id}`

      // cooking → ready_to_flip after COOK_SIDE1_DURATION
      if (pan.state === 'cooking' && !timersRef.current.has(timerKey)) {
        setTimer(timerKey, () => {
          if (!mountedRef.current) return
          updatePan(pan.id, { state: 'ready_to_flip' })
        }, COOK_SIDE1_DURATION)
      }

      // ready_to_flip → burnt after FLIP_WINDOW (missed flip)
      if (pan.state === 'ready_to_flip' && !timersRef.current.has(timerKey)) {
        setTimer(timerKey, () => {
          if (!mountedRef.current) return
          const p = useGameStore.getState().pans.find(p => p.id === pan.id)
          if (p && p.state === 'ready_to_flip') {
            updatePan(pan.id, { state: 'burnt' })
            addKitchenScore(-5)
            reportAction(pan.id, 'burnt_missed_flip')
          }
        }, FLIP_WINDOW)
      }

      // cooking_side2 → ready_to_plate after COOK_SIDE2_DURATION
      if (pan.state === 'cooking_side2' && !timersRef.current.has(timerKey)) {
        setTimer(timerKey, () => {
          if (!mountedRef.current) return
          updatePan(pan.id, { state: 'ready_to_plate' })
        }, COOK_SIDE2_DURATION)
      }

      // ready_to_plate → burnt after PLATE_WINDOW (missed plate)
      if (pan.state === 'ready_to_plate' && !timersRef.current.has(timerKey)) {
        setTimer(timerKey, () => {
          if (!mountedRef.current) return
          const p = useGameStore.getState().pans.find(p => p.id === pan.id)
          if (p && p.state === 'ready_to_plate') {
            updatePan(pan.id, { state: 'burnt' })
            addKitchenScore(-5)
            reportAction(pan.id, 'burnt_missed_plate')
          }
        }, PLATE_WINDOW)
      }

      // Clear timer if state changed away from what we set it for
      if (
        pan.state !== 'cooking' &&
        pan.state !== 'ready_to_flip' &&
        pan.state !== 'cooking_side2' &&
        pan.state !== 'ready_to_plate'
      ) {
        clearTimer(timerKey)
      }
    })
  }, [pans, updatePan, addKitchenScore])

  const handlePanClick = useCallback((panId: number) => {
    if (!isActive) return
    const pan = pans.find(p => p.id === panId)
    if (!pan) return

    switch (pan.state) {
      case 'ready_to_flip':
        clearTimer(`pan_${panId}`)
        updatePan(panId, { state: 'cooking_side2', placedAt: Date.now() })
        reportAction(panId, 'flip')
        break
      case 'ready_to_plate':
        clearTimer(`pan_${panId}`)
        updatePan(panId, { state: 'empty', placedAt: null })
        addKitchenScore(10)
        reportAction(panId, 'plate')
        break
      case 'burnt':
        clearTimer(`pan_${panId}`)
        updatePan(panId, { state: 'empty', placedAt: null })
        reportAction(panId, 'discard_burnt')
        break
      default:
        break
    }
  }, [pans, updatePan, addKitchenScore, isActive])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current.clear()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      {/* Instruction badge */}
      <div className="absolute top-9 left-2 z-10 pointer-events-none">
        <span className="text-[10px] text-slate-300/80 bg-slate-900/50 rounded px-1.5 py-0.5">
          Click pans to flip / plate steaks
        </span>
      </div>

      {/* Pans positioned on stovetop area */}
      <div
        className="absolute flex gap-2 items-center justify-center z-10"
        style={{ left: '18%', top: '30%', right: '5%', height: '34%' }}
      >
        {pans.map((pan) => (
          <PanComponent
            key={pan.id}
            pan={pan}
            onClick={() => handlePanClick(pan.id)}
            isActive={isActive}
          />
        ))}
      </div>

      {/* PM targets on shelf area */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '4%', width: '55%' }}>
        <PMTargetItems room="kitchen" />
      </div>
    </div>
  )
}

function PanComponent({
  pan,
  onClick,
  isActive,
}: {
  pan: { id: number; state: SteakState }
  onClick: () => void
  isActive: boolean
}) {
  const isUrgent = pan.state === 'ready_to_flip' || pan.state === 'ready_to_plate'

  const cfg: Record<SteakState, { emoji: string; label: string; bg: string; pulse?: boolean }> = {
    empty: { emoji: '🍳', label: 'Empty', bg: 'bg-slate-600/70' },
    raw: { emoji: '🥩', label: 'Raw', bg: 'bg-red-900/60' },
    cooking: { emoji: '🥩', label: 'Cooking...', bg: 'bg-orange-900/60', pulse: true },
    ready_to_flip: { emoji: '🔥', label: 'FLIP NOW!', bg: 'bg-yellow-600/60', pulse: true },
    cooking_side2: { emoji: '🥩', label: 'Side 2...', bg: 'bg-orange-800/60', pulse: true },
    ready_to_plate: { emoji: '✅', label: 'PLATE NOW!', bg: 'bg-green-600/60', pulse: true },
    done: { emoji: '✅', label: 'Done!', bg: 'bg-green-700/60' },
    burnt: { emoji: '💨', label: 'Burnt!', bg: 'bg-red-700/60' },
  }
  const c = cfg[pan.state]

  return (
    <motion.button
      onClick={onClick}
      disabled={!isActive}
      className={`${c.bg} backdrop-blur-sm rounded-xl w-16 h-16 flex flex-col items-center
                  justify-center border-2 transition-colors
                  ${isActive ? 'cursor-pointer' : 'cursor-default'}
                  ${pan.state === 'ready_to_flip' ? 'border-yellow-400 steak-urgent-flip' :
                    pan.state === 'ready_to_plate' ? 'border-green-400 steak-urgent-plate' :
                    pan.state === 'burnt' ? 'border-red-400' : 'border-slate-500/60'}
                  ${isUrgent ? 'steak-urgent' : ''}`}
      animate={c.pulse ? { scale: [1, 1.05, 1] } : {}}
      transition={c.pulse ? { repeat: Infinity, duration: 1 } : {}}
    >
      <span className="text-xl">{c.emoji}</span>
      <span className={`text-[9px] font-medium mt-0.5 ${
        pan.state === 'ready_to_flip' ? 'text-yellow-300' :
        pan.state === 'ready_to_plate' ? 'text-green-300' :
        pan.state === 'burnt' ? 'text-red-300' : 'text-slate-300'
      }`}>{c.label}</span>
    </motion.button>
  )
}
