/** Kitchen room — steak cooking with 3 pans.
 *  Timers are reactive: whenever a pan enters 'cooking', 'ready_to_flip', or
 *  'flipped' state (whether via user click OR backend ongoing_task_event),
 *  a timer is auto-started for the next transition.
 */

import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { SteakState } from '../../../types'
import PMTargetItems from '../PMTargetItems'

const COOK_TIME = 8000
const FLIP_WINDOW = 4000

export default function KitchenRoom() {
  const pans = useGameStore((s) => s.pans)
  const updatePan = useGameStore((s) => s.updatePan)
  const addKitchenScore = useGameStore((s) => s.addKitchenScore)
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const activeTimerStates = useRef<Map<number, SteakState>>(new Map())
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

  // Reactive timer management: auto-starts timers when pan state changes
  useEffect(() => {
    pans.forEach(pan => {
      const activeState = activeTimerStates.current.get(pan.id)

      // Cancel stale timer if pan state no longer matches
      if (activeState && activeState !== pan.state) {
        const timerKey = pan.id * 100 +
          (activeState === 'cooking' ? 1 : activeState === 'ready_to_flip' ? 2 : 3)
        const timer = timersRef.current.get(timerKey)
        if (timer) {
          clearTimeout(timer)
          timersRef.current.delete(timerKey)
        }
        activeTimerStates.current.delete(pan.id)
      }

      // Start cook → ready_to_flip timer
      if (pan.state === 'cooking' && !activeTimerStates.current.has(pan.id)) {
        activeTimerStates.current.set(pan.id, 'cooking')
        const t = setTimeout(() => {
          if (!mountedRef.current) return
          activeTimerStates.current.delete(pan.id)
          updatePan(pan.id, { state: 'ready_to_flip' })
        }, COOK_TIME)
        timersRef.current.set(pan.id * 100 + 1, t)
      }

      // Start ready_to_flip → burnt timer
      if (pan.state === 'ready_to_flip' && !activeTimerStates.current.has(pan.id)) {
        activeTimerStates.current.set(pan.id, 'ready_to_flip')
        const t = setTimeout(() => {
          if (!mountedRef.current) return
          activeTimerStates.current.delete(pan.id)
          const currentPan = useGameStore.getState().pans.find(p => p.id === pan.id)
          if (currentPan && currentPan.state === 'ready_to_flip') {
            updatePan(pan.id, { state: 'burnt' })
            reportAction(pan.id, 'burnt')
          }
        }, FLIP_WINDOW)
        timersRef.current.set(pan.id * 100 + 2, t)
      }

      // Start flipped → done timer
      if (pan.state === 'flipped' && !activeTimerStates.current.has(pan.id)) {
        activeTimerStates.current.set(pan.id, 'flipped')
        const t = setTimeout(() => {
          if (!mountedRef.current) return
          activeTimerStates.current.delete(pan.id)
          updatePan(pan.id, { state: 'done' })
          addKitchenScore(10)
          reportAction(pan.id, 'done')
        }, COOK_TIME)
        timersRef.current.set(pan.id * 100 + 3, t)
      }
    })
  }, [pans, updatePan, addKitchenScore])

  const handlePanClick = useCallback((panId: number) => {
    const pan = pans.find(p => p.id === panId)
    if (!pan) return

    switch (pan.state) {
      case 'empty':
        updatePan(panId, { state: 'cooking', placedAt: Date.now() })
        reportAction(panId, 'place_meat')
        break
      case 'ready_to_flip':
        updatePan(panId, { state: 'flipped', placedAt: Date.now() })
        addKitchenScore(10)
        reportAction(panId, 'flip')
        break
      case 'done':
        updatePan(panId, { state: 'empty', placedAt: null })
        addKitchenScore(20)
        reportAction(panId, 'plate')
        break
      case 'burnt':
        updatePan(panId, { state: 'empty', placedAt: null })
        reportAction(panId, 'discard_burnt')
        break
      default:
        break
    }
  }, [pans, updatePan, addKitchenScore])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current.clear()
      activeTimerStates.current.clear()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      {/* Instruction badge */}
      <div className="absolute top-9 left-2 z-10 pointer-events-none">
        <span className="text-[10px] text-slate-300/80 bg-slate-900/50 rounded px-1.5 py-0.5">
          Click pans to cook steaks
        </span>
      </div>

      {/* Pans positioned on stovetop area */}
      <div
        className="absolute flex gap-2 items-center justify-center z-10"
        style={{ left: '18%', top: '30%', right: '5%', height: '34%' }}
      >
        {pans.map((pan) => (
          <PanComponent key={pan.id} pan={pan} onClick={() => handlePanClick(pan.id)} />
        ))}
      </div>

      {/* PM targets on shelf area */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '4%', width: '55%' }}>
        <PMTargetItems room="kitchen" />
      </div>
    </div>
  )
}

function PanComponent({ pan, onClick }: { pan: { id: number; state: SteakState }; onClick: () => void }) {
  const cfg: Record<SteakState, { emoji: string; label: string; bg: string; pulse?: boolean }> = {
    empty: { emoji: '🍳', label: 'Empty', bg: 'bg-slate-600/70' },
    raw: { emoji: '🥩', label: 'Raw', bg: 'bg-red-900/60' },
    cooking: { emoji: '🥩', label: 'Cooking...', bg: 'bg-orange-900/60', pulse: true },
    ready_to_flip: { emoji: '🔥', label: 'FLIP NOW!', bg: 'bg-yellow-600/60', pulse: true },
    flipped: { emoji: '🥩', label: 'Side 2...', bg: 'bg-orange-800/60', pulse: true },
    done: { emoji: '✅', label: 'Done!', bg: 'bg-green-700/60' },
    burnt: { emoji: '💨', label: 'Burnt!', bg: 'bg-red-700/60' },
  }
  const c = cfg[pan.state]

  return (
    <motion.button
      onClick={onClick}
      className={`${c.bg} backdrop-blur-sm rounded-xl w-16 h-16 flex flex-col items-center
                  justify-center border-2 transition-colors cursor-pointer
                  ${pan.state === 'ready_to_flip' ? 'border-yellow-400 trigger-active' :
                    pan.state === 'done' ? 'border-green-400' :
                    pan.state === 'burnt' ? 'border-red-400' : 'border-slate-500/60'}`}
      animate={c.pulse ? { scale: [1, 1.05, 1] } : {}}
      transition={c.pulse ? { repeat: Infinity, duration: 1 } : {}}
    >
      <span className="text-xl">{c.emoji}</span>
      <span className={`text-[9px] font-medium mt-0.5 ${
        pan.state === 'ready_to_flip' ? 'text-yellow-300' :
        pan.state === 'done' ? 'text-green-300' :
        pan.state === 'burnt' ? 'text-red-300' : 'text-slate-300'
      }`}>{c.label}</span>
    </motion.button>
  )
}
