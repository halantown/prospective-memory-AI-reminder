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
      updatePan(panId, { state: 'ready_to_flip' })

      const t2 = setTimeout(() => {
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
    return () => { timersRef.current.forEach(t => clearTimeout(t)) }
  }, [])

  return (
    <div className="flex flex-col gap-2 h-full">
      <p className="text-xs text-slate-400">Click pans to cook steaks</p>
      <div className="flex gap-3 flex-1 items-center justify-center">
        {pans.map((pan) => (
          <PanComponent key={pan.id} pan={pan} onClick={() => handlePanClick(pan.id)} />
        ))}
      </div>
      <PMTargetItems room="kitchen" />
    </div>
  )
}

function PanComponent({ pan, onClick }: { pan: { id: number; state: SteakState }; onClick: () => void }) {
  const cfg: Record<SteakState, { emoji: string; label: string; bg: string; pulse?: boolean }> = {
    empty: { emoji: '🍳', label: 'Empty', bg: 'bg-slate-600' },
    raw: { emoji: '🥩', label: 'Raw', bg: 'bg-red-900/50' },
    cooking: { emoji: '🥩', label: 'Cooking...', bg: 'bg-orange-900/50', pulse: true },
    ready_to_flip: { emoji: '🔥', label: 'FLIP NOW!', bg: 'bg-yellow-600/50', pulse: true },
    flipped: { emoji: '🥩', label: 'Side 2...', bg: 'bg-orange-800/50', pulse: true },
    done: { emoji: '✅', label: 'Done!', bg: 'bg-green-700/50' },
    burnt: { emoji: '💨', label: 'Burnt!', bg: 'bg-red-700/50' },
  }
  const c = cfg[pan.state]

  return (
    <motion.button
      onClick={onClick}
      className={`${c.bg} rounded-xl w-20 h-20 flex flex-col items-center
                  justify-center border-2 transition-colors cursor-pointer
                  ${pan.state === 'ready_to_flip' ? 'border-yellow-400 trigger-active' :
                    pan.state === 'done' ? 'border-green-400' :
                    pan.state === 'burnt' ? 'border-red-400' : 'border-slate-500'}`}
      animate={c.pulse ? { scale: [1, 1.05, 1] } : {}}
      transition={c.pulse ? { repeat: Infinity, duration: 1 } : {}}
    >
      <span className="text-2xl">{c.emoji}</span>
      <span className={`text-[10px] font-medium mt-1 ${
        pan.state === 'ready_to_flip' ? 'text-yellow-300' :
        pan.state === 'done' ? 'text-green-300' :
        pan.state === 'burnt' ? 'text-red-300' : 'text-slate-300'
      }`}>{c.label}</span>
    </motion.button>
  )
}
