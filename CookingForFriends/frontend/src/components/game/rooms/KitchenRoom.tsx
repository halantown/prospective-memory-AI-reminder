/** Kitchen room — steak cooking with 3 pans. */

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

  const startCooking = useCallback((panId: number) => {
    updatePan(panId, { state: 'cooking', placedAt: Date.now() })

    const t1 = setTimeout(() => {
      if (!mountedRef.current) return
      updatePan(panId, { state: 'ready_to_flip' })

      const t2 = setTimeout(() => {
        if (!mountedRef.current) return
        const pan = useGameStore.getState().pans.find(p => p.id === panId)
        if (pan && pan.state === 'ready_to_flip') {
          updatePan(panId, { state: 'burnt' })
          reportAction(panId, 'burnt')
        }
      }, FLIP_WINDOW)
      timersRef.current.set(panId * 100 + 2, t2)
    }, COOK_TIME)
    timersRef.current.set(panId * 100 + 1, t1)
  }, [updatePan])

  const handlePanClick = useCallback((panId: number) => {
    const pan = pans.find(p => p.id === panId)
    if (!pan) return

    switch (pan.state) {
      case 'empty':
        updatePan(panId, { state: 'raw' })
        setTimeout(() => startCooking(panId), 500)
        reportAction(panId, 'place_meat')
        break
      case 'ready_to_flip':
        updatePan(panId, { state: 'flipped', placedAt: Date.now() })
        addKitchenScore(10)
        reportAction(panId, 'flip')
        const t = setTimeout(() => {
          if (!mountedRef.current) return
          updatePan(panId, { state: 'done' })
          addKitchenScore(10)
          reportAction(panId, 'done')
        }, COOK_TIME)
        timersRef.current.set(panId * 100 + 3, t)
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
  }, [pans, updatePan, addKitchenScore, startCooking])

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
