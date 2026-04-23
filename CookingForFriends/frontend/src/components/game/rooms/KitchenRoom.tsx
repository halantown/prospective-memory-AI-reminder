/** Kitchen room — multi-dish cooking with clickable station areas.
 *
 *  Backend-driven model: CookingEngine sends step_activate events with
 *  distractor options. Frontend shows options at the target station.
 *  Participant clicks one option; backend evaluates and sends result.
 */

import { useCallback, useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import PMTargetItems from '../PMTargetItems'
import type { DishId, KitchenStationId, ActiveCookingStep, CookingStepOption } from '../../../types'

/** Station labels and emoji for the popup header */
const STATION_INFO: Record<KitchenStationId, { label: string; emoji: string }> = {
  fridge:       { label: 'Fridge',        emoji: '🧊' },
  cutting_board:{ label: 'Cutting Board', emoji: '🔪' },
  spice_rack:   { label: 'Spice Rack',   emoji: '🧂' },
  burner1:      { label: 'Burner 1',     emoji: '🔥' },
  burner2:      { label: 'Burner 2',     emoji: '🔥' },
  burner3:      { label: 'Burner 3',     emoji: '🔥' },
  oven:         { label: 'Oven',         emoji: '♨️' },
  plating_area: { label: 'Plating Area', emoji: '🍽️' },
}

/**
 * Station hotspot positions as % of the kitchen bounding box.
 * Kitchen box = ROOM_DEFS.kitchen: x:0, y:0, w:44%, h:41% of the 1536×1024 floorplan.
 * Positions calibrated to the pixel-art furniture visible in the image.
 *
 *  Floorplan furniture layout (top-down, top-left = kitchen):
 *   ┌ burners 1+2 ┬ fridge ─────────── ┬ cutting board ─ ┬ spice shelf ┐
 *   ├ burner 3    │                     │                 │             │
 *   ├ oven ───────┤         (floor)     │                 │             │
 *   │             │                     │                 │             │
 *   ├ sink(no btn)├──────── lower counter / plating area ─┴─────────────┤
 *   └─────────────┴─────────────────────────────────────────────────────┘
 */
const STATION_POSITIONS: Record<KitchenStationId, { left: string; top: string; width: string; height: string }> = {
  // Two-door fridge — top row, left-center
  fridge:        { left: '37%', top: '1%',  width: '17%', height: '31%' },
  // Wooden cutting board + knife — top row, right-center
  cutting_board: { left: '63%', top: '1%',  width: '22%', height: '31%' },
  // Jar shelf (spice rack) — top-right corner
  spice_rack:    { left: '85%', top: '1%',  width: '14%', height: '23%' },
  // Burner 1 (circle "1", top-left of stove 2×2 grid)
  burner1:       { left: '13%', top: '1%',  width: '12%', height: '15%' },
  // Burner 2 (circle "2", top-right of 2×2 grid)
  burner2:       { left: '25%', top: '1%',  width: '12%', height: '15%' },
  // Burner 3 (circle "3", bottom-left of 2×2 grid)
  burner3:       { left: '13%', top: '16%', width: '12%', height: '14%' },
  // Oven — below the burner cluster
  oven:          { left: '15%', top: '23%', width: '23%', height: '19%' },
  // Plating area — lower counter, center-right
  plating_area:  { left: '48%', top: '68%', width: '30%', height: '18%' },
}

/** Feedback flash types */
type FeedbackType = 'correct' | 'wrong' | 'missed' | null

export default function KitchenRoom({ isActive }: { isActive: boolean }) {
  const dishes = useGameStore((s) => s.dishes)
  const activeStation = useGameStore((s) => s.activeStation)
  const setActiveStation = useGameStore((s) => s.setActiveStation)
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const wsSend = useGameStore((s) => s.wsSend)

  const [feedback, setFeedback] = useState<{ station: KitchenStationId; type: FeedbackType }>({ station: 'fridge', type: null })

  // Clear feedback after short delay
  useEffect(() => {
    if (!feedback.type) return
    const timer = setTimeout(() => setFeedback(f => ({ ...f, type: null })), 1200)
    return () => clearTimeout(timer)
  }, [feedback.type])

  const handleStationClick = useCallback((station: KitchenStationId) => {
    if (!isActive) return
    setActiveStation(activeStation === station ? null : station)
  }, [isActive, activeStation, setActiveStation])

  const handleOptionClick = useCallback((step: ActiveCookingStep, option: CookingStepOption) => {
    if (!wsSend) return
    wsSend({
      type: 'cooking_action',
      data: {
        dish: step.dishId,
        step_index: step.stepIndex,
        chosen_option_id: option.id,
        chosen_option_text: option.text,
        station: step.station,
        timestamp: Date.now() / 1000,
      },
    })
    setActiveStation(null)
  }, [wsSend, setActiveStation])

  // Get the active cooking step for the currently open station
  const activeStepForStation = useMemo(() => {
    if (!activeStation) return undefined
    return activeCookingSteps.find(s => s.station === activeStation)
  }, [activeStation, activeCookingSteps])

  return (
    <div className="absolute inset-0">
      {/* Clickable station hotspots */}
      {(Object.entries(STATION_POSITIONS) as [KitchenStationId, typeof STATION_POSITIONS[KitchenStationId]][]).map(
        ([stationId, pos]) => {
          const info = STATION_INFO[stationId]
          const isOpen = activeStation === stationId
          const showFeedback = feedback.station === stationId && feedback.type

          return (
            <motion.button
              key={stationId}
              className={`absolute z-10 rounded-lg border-2 transition-all duration-200
                ${isActive ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
                ${isOpen
                  ? 'border-cooking-400 bg-cooking-900/30'
                  : 'border-transparent hover:border-slate-500/20 bg-transparent hover:bg-slate-800/20'
                }
                ${showFeedback === 'correct' ? '!border-green-400 !bg-green-500/30' : ''}
                ${showFeedback === 'wrong' ? '!border-red-400 !bg-red-500/30' : ''}
                ${showFeedback === 'missed' ? '!border-slate-400 !bg-slate-500/20' : ''}
              `}
              style={pos}
              onClick={() => handleStationClick(stationId)}
            >
              <div className="absolute bottom-0.5 left-1 text-[8px] text-slate-400/70 font-medium whitespace-nowrap">
                {info.emoji} {info.label}
              </div>
              {/* Feedback flash icon */}
              <AnimatePresence>
                {showFeedback && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center text-2xl"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {showFeedback === 'correct' && '✅'}
                    {showFeedback === 'wrong' && '❌'}
                    {showFeedback === 'missed' && '⏭️'}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )
        }
      )}

      {/* Station popup — shows distractor options */}
      <AnimatePresence>
        {activeStation && isActive && (
          <StationPopup
            station={activeStation}
            activeStep={activeStepForStation}
            onOptionClick={handleOptionClick}
            onClose={() => setActiveStation(null)}
          />
        )}
      </AnimatePresence>

      {/* Dish status indicators (bottom strip) */}
      <div className="absolute bottom-1 left-2 right-2 z-10 flex gap-2 pointer-events-none">
        {Object.values(dishes).map(dish => (
          <DishIndicator key={dish.id} dish={dish} />
        ))}
      </div>

      {/* PM furniture button */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '22%' }}>
        <PMTargetItems room="kitchen" />
      </div>
    </div>
  )
}

/** Popup showing distractor options for active cooking step */
function StationPopup({
  station,
  activeStep,
  onOptionClick,
  onClose,
}: {
  station: KitchenStationId
  activeStep: ActiveCookingStep | undefined
  onOptionClick: (step: ActiveCookingStep, option: CookingStepOption) => void
  onClose: () => void
}) {
  const info = STATION_INFO[station]

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Popup card */}
      <motion.div
        className="relative bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 min-w-[220px] max-w-[300px]"
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700">
          <span className="text-lg">{info.emoji}</span>
          <span className="text-sm font-semibold text-slate-200">{info.label}</span>
        </div>

        {activeStep ? (
          <>
            {/* Step info */}
            <div className="mb-3">
              <p className="text-xs text-slate-300 font-medium">{activeStep.stepLabel}</p>
              {activeStep.stepDescription && (
                <p className="text-[10px] text-slate-400 mt-0.5">{activeStep.stepDescription}</p>
              )}
            </div>

            {/* Countdown timer */}
            <CountdownBar activatedAt={activeStep.activatedAt} windowSeconds={activeStep.windowSeconds} />

            {/* Distractor options */}
            <div className="flex flex-col gap-2 mt-3">
              {activeStep.options.map((option) => (
                <button
                  key={option.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-700/50 hover:bg-cooking-900/40 
                    border border-slate-600/50 hover:border-cooking-400/50 transition-colors text-left"
                  onClick={() => onOptionClick(activeStep, option)}
                >
                  <span className="text-sm text-slate-100">{option.text}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500 italic py-2">Nothing to do here right now</p>
        )}

        {/* Close button */}
        <button
          className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 text-sm"
          onClick={onClose}
        >
          ✕
        </button>
      </motion.div>
    </motion.div>
  )
}

/** Animated countdown bar for step window */
function CountdownBar({ activatedAt, windowSeconds }: { activatedAt: number; windowSeconds: number }) {
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - activatedAt) / 1000
      const remaining = Math.max(0, 1 - elapsed / windowSeconds)
      setProgress(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 200)
    return () => clearInterval(interval)
  }, [activatedAt, windowSeconds])

  const color = progress > 0.5 ? 'bg-green-400' : progress > 0.2 ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${progress * 100}%` }}
        transition={{ duration: 0.2 }}
      />
    </div>
  )
}

/** Small dish status indicator */
function DishIndicator({ dish }: { dish: { id: DishId; emoji: string; phase: string; currentStepIndex: number; steps: { id: string }[] } }) {
  if (dish.phase === 'idle') return null

  const progress = dish.steps.length > 0
    ? Math.round((dish.currentStepIndex / dish.steps.length) * 100)
    : 0

  const phaseColor: Record<string, string> = {
    idle: 'bg-slate-600',
    prep: 'bg-blue-500',
    cooking: 'bg-orange-500',
    waiting: 'bg-yellow-500',
    ready: 'bg-green-500',
    plated: 'bg-emerald-600',
    served: 'bg-slate-400',
  }

  return (
    <div className="flex items-center gap-1 bg-slate-900/70 rounded px-1.5 py-0.5">
      <span className="text-[10px]">{dish.emoji}</span>
      <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${phaseColor[dish.phase] || 'bg-slate-600'}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
