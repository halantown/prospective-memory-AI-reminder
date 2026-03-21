/** Dining room — cycling table-setting task.
 *  4 seats × 4 utensils (plate, knife, fork, glass) = 16 placements per round.
 *  Select a utensil → click a seat → auto-place in the correct slot.
 *  Complete a round → +20 pts → reset → repeat infinitely.
 */

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { UtensilType } from '../../../types'
import PMTargetItems from '../PMTargetItems'

const UTENSILS: { type: UtensilType; emoji: string; label: string }[] = [
  { type: 'plate', emoji: '🍽️', label: 'Plate' },
  { type: 'knife', emoji: '🔪', label: 'Knife' },
  { type: 'fork', emoji: '🍴', label: 'Fork' },
  { type: 'glass', emoji: '🥛', label: 'Glass' },
]

const SEAT_LABELS = ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4']

export default function DiningRoom({ isActive }: { isActive: boolean }) {
  const diningPhase = useGameStore((s) => s.diningPhase)
  const seats = useGameStore((s) => s.diningSeats)
  const selectedUtensil = useGameStore((s) => s.diningSelectedUtensil)
  const diningRound = useGameStore((s) => s.diningRound)
  const selectUtensil = useGameStore((s) => s.selectUtensil)
  const placeUtensil = useGameStore((s) => s.placeUtensil)
  const completeDiningRound = useGameStore((s) => s.completeDiningRound)
  const wsSend = useGameStore((s) => s.wsSend)
  const [showComplete, setShowComplete] = useState(false)

  // Count total placed utensils
  const totalPlaced = seats.reduce((sum, seat) => {
    return sum + (seat.plate ? 1 : 0) + (seat.knife ? 1 : 0) + (seat.fork ? 1 : 0) + (seat.glass ? 1 : 0)
  }, 0)

  // Check if all seats fully set
  const allComplete = totalPlaced === 16

  useEffect(() => {
    if (allComplete && diningPhase === 'active') {
      setShowComplete(true)
      if (wsSend) {
        wsSend({
          type: 'task_action',
          data: { task: 'dining', action: 'round_complete', round: diningRound + 1, timestamp: Date.now() / 1000 },
        })
      }
      const timer = setTimeout(() => {
        completeDiningRound()
        setShowComplete(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [allComplete, diningPhase, diningRound, completeDiningRound, wsSend])

  const handleUtensilClick = useCallback((utensil: UtensilType) => {
    if (!isActive || diningPhase !== 'active') return
    selectUtensil(selectedUtensil === utensil ? null : utensil)
  }, [isActive, diningPhase, selectedUtensil, selectUtensil])

  const handleSeatClick = useCallback((seatIndex: number) => {
    if (!isActive || diningPhase !== 'active' || !selectedUtensil) return
    const placed = placeUtensil(seatIndex)
    if (placed && wsSend) {
      wsSend({
        type: 'task_action',
        data: {
          task: 'dining',
          action: 'place_utensil',
          seat: seatIndex,
          utensil: selectedUtensil,
          timestamp: Date.now() / 1000,
        },
      })
    }
  }, [isActive, diningPhase, selectedUtensil, placeUtensil, wsSend])

  if (diningPhase === 'idle') {
    return (
      <div className="absolute inset-0">
        <div className="absolute top-9 left-2 z-10 pointer-events-none">
          <span className="text-[10px] text-slate-300/80 bg-slate-900/50 rounded px-1.5 py-0.5">
            Waiting for table to be ready...
          </span>
        </div>
        <div className="absolute z-10" style={{ left: '3%', bottom: '3%', width: '50%' }}>
          <PMTargetItems room="dining" />
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      {/* Instruction badge */}
      <div className="absolute top-9 left-2 z-10 pointer-events-none">
        <span className="text-[10px] text-slate-300/80 bg-slate-900/50 rounded px-1.5 py-0.5">
          Select utensil → click seat to place
        </span>
      </div>

      {/* 4 seats on table */}
      <div
        className="absolute flex gap-1.5 items-start justify-center z-10"
        style={{ left: '8%', top: '18%', right: '8%', height: '48%' }}
      >
        {seats.map((seat, i) => (
          <div
            key={i}
            className={`flex-1 rounded-lg border-2 p-1.5 transition-colors ${
              isActive && selectedUtensil
                ? 'border-cooking-400/60 hover:border-cooking-400 cursor-pointer'
                : 'border-slate-600/50'
            }`}
            onClick={() => handleSeatClick(i)}
          >
            <div className="text-[9px] text-slate-400 text-center mb-1 font-medium">
              {SEAT_LABELS[i]}
            </div>
            <div className="grid grid-cols-2 gap-0.5">
              {UTENSILS.map((u) => {
                const placed = seat[u.type]
                return (
                  <div
                    key={u.type}
                    className={`flex items-center justify-center rounded h-6 text-xs transition-all ${
                      placed
                        ? 'bg-green-800/50 border border-green-600/50'
                        : 'bg-slate-700/30 border border-dashed border-slate-600/40'
                    }`}
                  >
                    {placed ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      >
                        {u.emoji}
                      </motion.span>
                    ) : (
                      <span className="text-slate-600 text-[8px]">{u.emoji}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Utensil selection bar */}
      <div
        className="absolute flex gap-1.5 items-center justify-center z-10"
        style={{ left: '10%', bottom: '18%', right: '10%', height: '14%' }}
      >
        {UTENSILS.map((u) => (
          <button
            key={u.type}
            onClick={() => handleUtensilClick(u.type)}
            disabled={!isActive}
            className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium
              transition-all border-2 ${
                selectedUtensil === u.type
                  ? 'bg-cooking-600/50 border-cooking-400 text-cooking-200 scale-105'
                  : 'bg-slate-700/40 border-slate-600/50 text-slate-300 hover:bg-slate-600/50'
              } ${isActive ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span>{u.emoji}</span>
            <span className="hidden sm:inline">{u.label}</span>
          </button>
        ))}
      </div>

      {/* Status bar */}
      <div className="absolute bottom-1 left-2 right-2 z-10 pointer-events-none">
        <div className="flex items-center justify-between text-[9px] text-slate-400 bg-slate-900/50 rounded px-2 py-0.5">
          <span>Round {diningRound + 1}</span>
          <span>{totalPlaced}/16 placed</span>
          <span>✓ {diningRound} completed</span>
        </div>
      </div>

      {/* Completion flash overlay */}
      <AnimatePresence>
        {showComplete && (
          <motion.div
            className="absolute inset-0 z-20 flex items-center justify-center bg-green-900/30 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-green-400 text-lg font-bold bg-slate-900/70 px-4 py-2 rounded-lg"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              ✓ Table Complete! +20
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PM targets */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '3%', width: '50%' }}>
        <PMTargetItems room="dining" />
      </div>
    </div>
  )
}
