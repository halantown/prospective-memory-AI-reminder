/** Kitchen room — steak cooking with 3 pans.
 *  State machine per steak:
 *    cooking (30s) → ready_to_flip (10s window) → cooking_side2 (25s) → ready_to_plate (10s window) → burnt
 *  Missing the flip or plate window → burnt immediately.
 *  Timers run as long as the component is mounted (even when room is inactive)
 *  so the participant must monitor from other rooms.
 *
 *  Visual: steaks are irregular ellipses with color gradients.
 *  No text labels except "Empty" on empty pans. No progress bars.
 *  State communicated through color: pink(raw) → brown(cooked) → black(burnt).
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { SteakState } from '../../../types'
import PMTargetItems from '../PMTargetItems'
import { useSoundEffects } from '../../../hooks/useSoundEffects'

const COOK_SIDE1_DURATION = 30_000
const FLIP_WINDOW = 10_000
const COOK_SIDE2_DURATION = 25_000
const PLATE_WINDOW = 10_000
const BURNT_DECAY_DURATION = 15_000  // burnt steak turns to ash after 15s if not cleared

const STEAK_COLORS = {
  raw: '#E8A0A0',
  cooking_start: '#E8A0A0',
  cooking_end: '#B87333',
  ready_to_flip: '#B87333',
  side2_start: '#B87333',
  side2_end: '#8B6914',
  ready_to_plate: '#8B6914',
  burnt: '#2A1A0A',
}

function interpolateColor(from: string, to: string, t: number): string {
  const clamp = Math.max(0, Math.min(1, t))
  const r1 = parseInt(from.slice(1, 3), 16)
  const g1 = parseInt(from.slice(3, 5), 16)
  const b1 = parseInt(from.slice(5, 7), 16)
  const r2 = parseInt(to.slice(1, 3), 16)
  const g2 = parseInt(to.slice(3, 5), 16)
  const b2 = parseInt(to.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * clamp)
  const g = Math.round(g1 + (g2 - g1) * clamp)
  const b = Math.round(b1 + (b2 - b1) * clamp)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function getSteakColor(state: SteakState, progress: number): string {
  switch (state) {
    case 'raw':
      return STEAK_COLORS.raw
    case 'cooking':
      return interpolateColor(STEAK_COLORS.cooking_start, STEAK_COLORS.cooking_end, progress)
    case 'ready_to_flip':
      return STEAK_COLORS.ready_to_flip
    case 'cooking_side2':
      return interpolateColor(STEAK_COLORS.side2_start, STEAK_COLORS.side2_end, progress)
    case 'ready_to_plate':
      return STEAK_COLORS.ready_to_plate
    case 'done':
      return STEAK_COLORS.ready_to_plate
    case 'burnt':
      return STEAK_COLORS.burnt
    default:
      return 'transparent'
  }
}

export default function KitchenRoom({ isActive }: { isActive: boolean }) {
  const pans = useGameStore((s) => s.pans)
  const updatePan = useGameStore((s) => s.updatePan)
  const addKitchenScore = useGameStore((s) => s.addKitchenScore)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const mountedRef = useRef(true)
  const play = useSoundEffects()

  const reportAction = useCallback((panId: number, action: string) => {
    const send = useGameStore.getState().wsSend
    if (send) {
      send({
        type: 'task_action',
        data: { task: 'steak', action, pan_id: panId, timestamp: Date.now() / 1000 },
      })
    }
  }, [])

  const clearTimer = useCallback((key: string) => {
    const timer = timersRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(key)
    }
  }, [])

  const setTimer = (key: string, fn: () => void, ms: number) => {
    clearTimer(key)
    timersRef.current.set(key, setTimeout(fn, ms))
  }

  // Track which state each pan's timer was set for, so we can detect state
  // changes and re-arm timers correctly.
  const timerStateRef = useRef<Map<string, SteakState>>(new Map())

  useEffect(() => {
    pans.forEach(pan => {
      const timerKey = `pan_${pan.id}`
      const prevTimerState = timerStateRef.current.get(timerKey)

      // If the pan state changed since we last set a timer, clear the stale one
      if (prevTimerState && prevTimerState !== pan.state) {
        clearTimer(timerKey)
        timerStateRef.current.delete(timerKey)
      }

      if (pan.state === 'cooking' && !timersRef.current.has(timerKey)) {
        timerStateRef.current.set(timerKey, 'cooking')
        setTimer(timerKey, () => {
          timersRef.current.delete(timerKey)
          timerStateRef.current.delete(timerKey)
          if (!mountedRef.current) return
          updatePan(pan.id, { state: 'ready_to_flip' })
        }, COOK_SIDE1_DURATION)
      }

      if (pan.state === 'ready_to_flip' && !timersRef.current.has(timerKey)) {
        timerStateRef.current.set(timerKey, 'ready_to_flip')
        setTimer(timerKey, () => {
          timersRef.current.delete(timerKey)
          timerStateRef.current.delete(timerKey)
          if (!mountedRef.current) return
          const p = useGameStore.getState().pans.find(p => p.id === pan.id)
          if (p && p.state === 'ready_to_flip') {
            updatePan(pan.id, { state: 'burnt' })
            addKitchenScore(-5)
            reportAction(pan.id, 'burnt_missed_flip')
            play('burnBuzz')
          }
        }, FLIP_WINDOW)
      }

      if (pan.state === 'cooking_side2' && !timersRef.current.has(timerKey)) {
        timerStateRef.current.set(timerKey, 'cooking_side2')
        setTimer(timerKey, () => {
          timersRef.current.delete(timerKey)
          timerStateRef.current.delete(timerKey)
          if (!mountedRef.current) return
          updatePan(pan.id, { state: 'ready_to_plate' })
        }, COOK_SIDE2_DURATION)
      }

      if (pan.state === 'ready_to_plate' && !timersRef.current.has(timerKey)) {
        timerStateRef.current.set(timerKey, 'ready_to_plate')
        setTimer(timerKey, () => {
          timersRef.current.delete(timerKey)
          timerStateRef.current.delete(timerKey)
          if (!mountedRef.current) return
          const p = useGameStore.getState().pans.find(p => p.id === pan.id)
          if (p && p.state === 'ready_to_plate') {
            updatePan(pan.id, { state: 'burnt' })
            addKitchenScore(-5)
            reportAction(pan.id, 'burnt_missed_plate')
            play('burnBuzz')
          }
        }, PLATE_WINDOW)
      }

      // Burnt steak auto-decays to ash if not manually cleared
      if (pan.state === 'burnt' && !timersRef.current.has(timerKey)) {
        timerStateRef.current.set(timerKey, 'burnt')
        setTimer(timerKey, () => {
          timersRef.current.delete(timerKey)
          timerStateRef.current.delete(timerKey)
          if (!mountedRef.current) return
          const p = useGameStore.getState().pans.find(p => p.id === pan.id)
          if (p && p.state === 'burnt') {
            updatePan(pan.id, { state: 'ash' })
            reportAction(pan.id, 'burnt_to_ash')
            play('ashCrumble')
          }
        }, BURNT_DECAY_DURATION)
      }

      // Ash auto-clears to empty after a brief moment
      if (pan.state === 'ash' && !timersRef.current.has(timerKey)) {
        timerStateRef.current.set(timerKey, 'ash')
        setTimer(timerKey, () => {
          timersRef.current.delete(timerKey)
          timerStateRef.current.delete(timerKey)
          if (!mountedRef.current) return
          const p = useGameStore.getState().pans.find(p => p.id === pan.id)
          if (p && p.state === 'ash') {
            updatePan(pan.id, { state: 'empty', placedAt: null })
            reportAction(pan.id, 'ash_cleared')
          }
        }, 3000)
      }

      // Terminal states: clear any leftover timer
      if (
        pan.state !== 'cooking' &&
        pan.state !== 'ready_to_flip' &&
        pan.state !== 'cooking_side2' &&
        pan.state !== 'ready_to_plate' &&
        pan.state !== 'burnt' &&
        pan.state !== 'ash'
      ) {
        clearTimer(timerKey)
        timerStateRef.current.delete(timerKey)
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
        play('sizzle')
        break
      case 'ready_to_plate':
        clearTimer(`pan_${panId}`)
        updatePan(panId, { state: 'empty', placedAt: null })
        addKitchenScore(10)
        reportAction(panId, 'plate')
        play('plateDing')
        // Check if all pans are now empty (full cycle plated)
        setTimeout(() => {
          const currentPans = useGameStore.getState().pans
          const allEmpty = currentPans.every(p => p.state === 'empty')
          if (allEmpty) {
            const send = useGameStore.getState().wsSend
            if (send) {
              send({
                type: 'task_action',
                data: {
                  task: 'steak',
                  event: 'steak_plated',
                  all_plated: true,
                  timestamp: Date.now() / 1000,
                },
              })
            }
          }
        }, 50)
        break
      case 'burnt':
        clearTimer(`pan_${panId}`)
        updatePan(panId, { state: 'empty', placedAt: null })
        reportAction(panId, 'discard_burnt')
        break
      default:
        break
    }
  }, [pans, updatePan, addKitchenScore, isActive, clearTimer, reportAction])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current.clear()
      timerStateRef.current.clear()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <div className="absolute top-9 left-2 z-10 pointer-events-none">
        <span className="text-[10px] text-slate-300/80 bg-slate-900/50 rounded px-1.5 py-0.5">
          Click pans to flip / plate steaks
        </span>
      </div>

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

      {/* PM furniture button near the shelf */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '5%' }}>
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
  pan: { id: number; state: SteakState; placedAt: number | null }
  onClick: () => void
  isActive: boolean
}) {
  const isUrgent = pan.state === 'ready_to_flip' || pan.state === 'ready_to_plate'
  const isEmpty = pan.state === 'empty'
  const isBurnt = pan.state === 'burnt'
  const isAsh = pan.state === 'ash'
  const isCooking = pan.state === 'cooking' || pan.state === 'cooking_side2'

  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!isCooking || !pan.placedAt) {
      setProgress(0)
      return
    }
    const duration = pan.state === 'cooking' ? COOK_SIDE1_DURATION : COOK_SIDE2_DURATION
    const interval = setInterval(() => {
      const elapsed = Date.now() - pan.placedAt!
      setProgress(Math.min(1, elapsed / duration))
    }, 500)
    return () => clearInterval(interval)
  }, [pan.state, pan.placedAt, isCooking])

  const steakColor = getSteakColor(pan.state, progress)

  const panBorderClass = pan.state === 'ready_to_flip'
    ? 'border-yellow-400 pan-glow-flip steak-urgent'
    : pan.state === 'ready_to_plate'
    ? 'border-green-400 pan-glow-plate steak-urgent'
    : isBurnt
    ? 'border-red-500 pan-glow-burnt'
    : isAsh
    ? 'border-slate-600/40'
    : 'border-slate-500/60'

  return (
    <motion.button
      onClick={onClick}
      disabled={!isActive}
      className={`relative rounded-full w-[72px] h-[72px] flex items-center justify-center
                  border-[3px] transition-colors
                  ${isActive ? 'cursor-pointer' : 'cursor-default'}
                  ${panBorderClass}
                  ${isEmpty ? 'bg-slate-700/50 border-dashed' : 'bg-slate-800/70'}
                  ${isUrgent ? 'steak-urgent' : ''}`}
      animate={isUrgent ? { scale: [1, 1.05, 1] } : isAsh ? { opacity: [0.6, 0.3, 0.6] } : {}}
      transition={isUrgent ? { repeat: Infinity, duration: 1 } : isAsh ? { repeat: Infinity, duration: 2 } : {}}
    >
      {isEmpty ? (
        <span className="text-[9px] text-slate-500 font-medium">Empty</span>
      ) : isAsh ? (
        <div className="flex flex-col items-center">
          <span className="text-lg opacity-50">🫥</span>
          <span className="text-[7px] text-slate-500">ash</span>
        </div>
      ) : (
        <div
          className={`steak-shape w-[50px] h-[38px] ${isBurnt ? 'steak-smoke' : ''}`}
          style={{ backgroundColor: steakColor }}
        />
      )}
    </motion.button>
  )
}
