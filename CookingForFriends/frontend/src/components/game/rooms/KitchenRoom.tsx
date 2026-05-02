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
import type { KitchenStationId, ActiveCookingStep, CookingStepOption } from '../../../types'

/** Station labels and emoji for the popup header */
const STATION_INFO: Record<KitchenStationId, { label: string; emoji: string }> = {
  fridge:       { label: 'Fridge',        emoji: '🧊' },
  cutting_board:{ label: 'Cutting Board', emoji: '🔪' },
  spice_rack:   { label: 'Spice Rack',   emoji: '🧂' },
  burner1:      { label: 'Stove',        emoji: '🍳' },  // visual stove block (all 4 burners)
  burner2:      { label: 'Burner 2',     emoji: '🔥' },  // hidden — same tile as burner1
  burner3:      { label: 'Burner 3',     emoji: '🔥' },  // hidden — same tile as burner1
  oven:         { label: 'Oven',         emoji: '♨️' },
  plating_area: { label: 'Plating Area', emoji: '🍽️' },
}

/**
 * Stations that are visually merged into another and should not be rendered as
 * independent hotspots. burner2/3 are part of the same stove tile as burner1.
 */
const HIDDEN_STATIONS = new Set<KitchenStationId>(['burner2', 'burner3'])

function stationMatches(clicked: KitchenStationId, active: KitchenStationId) {
  if (clicked === 'burner1') return active === 'burner1' || active === 'burner2' || active === 'burner3'
  return clicked === active
}

function cookingStepKey(step: ActiveCookingStep) {
  return `${step.dishId}:${step.stepIndex}`
}

/**
 * Station hotspot positions as % of the kitchen bounding box.
 * Kitchen box = ROOM_DEFS.kitchen: x:0, y:0, w:49.5%, h:41% of floorplan.png (1248×912px).
 * Formula: left% = img_x / (0.495×1248=617.76), top% = img_y / (0.41×912=374)
 * Left/width values scaled from w=44 by factor 44/49.5 = 8/9 to include fridge.
 *
 *  Floorplan furniture layout (top-down):
 *   ┌ stove+hood ┬──── prep/cutting zone ────┬ spice ┬ fridge ┐  ← top counter
 *   ├ oven ──────┤        (open floor)        │                │
 *   │ storage    │                            │                │
 *   │            │    [island/plating table]  │                │
 *   └────────────┴────────────────────────────┴────────────────┘
 */
const STATION_POSITIONS: Record<KitchenStationId, { left: string; top: string; width: string; height: string }> = {
  // Stove with range hood (all 4 burners) — measured TL(35.1,14.6) BR(43.7,25.6), ×1.5, scaled ×8/9
  burner1:       { left: '29.1%', top: '12.25%', width: '12%',  height: '16.5%' },
  // burner2/3 hidden — same tile as burner1
  burner2:       { left: '31%',   top: '15%',    width: '0%',   height: '0%'  },
  burner3:       { left: '31%',   top: '15%',    width: '0%',   height: '0%'  },
  // Prep zone — measured TL(61.2,17.3) BR(78.4,22.6), height ×1.5 centered, scaled ×8/9
  cutting_board: { left: '54.2%', top: '15.5%',  width: '15.1%', height: '9%'  },
  // Spice shelf — measured TL(87.4,12.9) BR(96.0,24.8), scaled ×8/9
  spice_rack:    { left: '77.3%', top: '13%',    width: '8%',   height: '12%' },
  // Fridge — measured TL(96.2,6.0), scaled ×8/9; right edge now fits in w=49.5
  fridge:        { left: '84.4%', top: '5%',     width: '9%',   height: '28%' },
  // Oven — measured TL(17.2,25.6) BR(25.9,33.1), ×1.5, scaled ×8/9
  oven:          { left: '13.1%', top: '24%',    width: '12%',  height: '12%' },
  // Kitchen island / plating table — measured TL(57.5,51.2) BR(73.6,70.3), scaled ×8/9
  plating_area:  { left: '51.5%', top: '51%',    width: '14.2%', height: '19%' },
}

/** Feedback flash types */
type FeedbackType = 'correct' | 'wrong' | 'missed' | null

/** Set to true to show live mouse coordinates for hotspot calibration */
const DEBUG_COORDS = true

export default function KitchenRoom({
  isActive,
  onStationOpen,
}: {
  isActive: boolean
  onStationOpen?: (event: React.MouseEvent<HTMLElement>) => void
}) {
  const activeStation = useGameStore((s) => s.activeStation)
  const setActiveStation = useGameStore((s) => s.setActiveStation)
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const kitchenTimerQueue = useGameStore((s) => s.kitchenTimerQueue)

  const [feedback, setFeedback] = useState<{ station: KitchenStationId; type: FeedbackType }>({ station: 'fridge', type: null })
  const [debugPos, setDebugPos] = useState<{ x: number; y: number } | null>(null)

  const handleDebugMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setDebugPos({ x, y })
  }, [])

  // Clear feedback after short delay
  useEffect(() => {
    if (!feedback.type) return
    const timer = setTimeout(() => setFeedback(f => ({ ...f, type: null })), 1200)
    return () => clearTimeout(timer)
  }, [feedback.type])

  const handleStationClick = useCallback((station: KitchenStationId, event: React.MouseEvent<HTMLElement>) => {
    if (!isActive) return
    const hasActiveStep = activeCookingSteps.some(step => stationMatches(station, step.station))
    if (!hasActiveStep) return
    if (activeStation === station) {
      setActiveStation(null)
      return
    }
    onStationOpen?.(event)
    setActiveStation(station)
  }, [isActive, activeStation, activeCookingSteps, onStationOpen, setActiveStation])

  return (
    <div
      className="absolute inset-0"
      onMouseMove={DEBUG_COORDS ? handleDebugMouseMove : undefined}
      onMouseLeave={DEBUG_COORDS ? () => setDebugPos(null) : undefined}
    >
      {/* Debug coordinate display */}
      {DEBUG_COORDS && debugPos && (
        <div className="absolute top-1 right-1 z-50 bg-black/80 text-green-400 font-mono text-[11px] px-2 py-1 rounded pointer-events-none select-none">
          left: {debugPos.x.toFixed(1)}% &nbsp; top: {debugPos.y.toFixed(1)}%
        </div>
      )}
      {/* Clickable station hotspots */}
      {(Object.entries(STATION_POSITIONS) as [KitchenStationId, typeof STATION_POSITIONS[KitchenStationId]][]).map(
        ([stationId, pos]) => {
          if (HIDDEN_STATIONS.has(stationId)) return null
          const info = STATION_INFO[stationId]
          const isWarning = kitchenTimerQueue.some(
            timer => timer.status === 'warning' && timer.station && stationMatches(stationId, timer.station)
          )
          const showFeedback = feedback.station === stationId && feedback.type

          return (
            <motion.button
              key={stationId}
              className={`absolute z-10 rounded-lg border-2 transition-all duration-200
                ${isWarning ? 'bg-red-600/45 border-red-300 shadow-[0_0_20px_rgba(239,68,68,0.55)]' : 'bg-blue-500/30 border-blue-400'}
                ${isActive ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
              `}
              style={pos}
              onClick={(event) => handleStationClick(stationId, event)}
            >
              <div className="absolute bottom-0.5 left-1 text-[9px] text-white font-bold whitespace-nowrap drop-shadow">
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
              {isWarning && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center text-2xl pointer-events-none"
                  animate={{ opacity: [0.45, 1, 0.45], y: [2, -3, 2] }}
                  transition={{ repeat: Infinity, duration: 1.1 }}
                >
                  💨
                </motion.div>
              )}
            </motion.button>
          )
        }
      )}

      {/* PM furniture button */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '22%' }}>
        <PMTargetItems room="kitchen" />
      </div>
    </div>
  )
}

/** Full-game overlay for station distractor options. Rendered by FloorPlanView, not inside the kitchen box. */
export function KitchenStationOverlay({
  anchor,
}: {
  anchor: { x: number; y: number } | null
}) {
  const activeStation = useGameStore((s) => s.activeStation)
  const setActiveStation = useGameStore((s) => s.setActiveStation)
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const wsSend = useGameStore((s) => s.wsSend)
  const [submittedStepKeys, setSubmittedStepKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setSubmittedStepKeys((prev) => {
      const activeKeys = new Set(activeCookingSteps.map(cookingStepKey))
      const next = new Set([...prev].filter(key => activeKeys.has(key)))
      return next.size === prev.size ? prev : next
    })
  }, [activeCookingSteps])

  const handleOptionClick = useCallback((step: ActiveCookingStep, option: CookingStepOption) => {
    if (!wsSend) return
    const key = cookingStepKey(step)
    if (submittedStepKeys.has(key)) return
    setSubmittedStepKeys(prev => new Set(prev).add(key))
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
  }, [wsSend, submittedStepKeys, setActiveStation])

  const activeStepForStation = useMemo(() => {
    if (!activeStation) return undefined
    return activeCookingSteps.find(s =>
      stationMatches(activeStation, s.station) && !submittedStepKeys.has(cookingStepKey(s))
    )
  }, [activeStation, activeCookingSteps, submittedStepKeys])

  return (
    <AnimatePresence>
      {activeStation && (
        <StationPopup
          station={activeStation}
          anchor={anchor}
          activeStep={activeStepForStation}
          onOptionClick={handleOptionClick}
          onClose={() => setActiveStation(null)}
        />
      )}
    </AnimatePresence>
  )
}

/** Popup showing distractor options for active cooking step */
function StationPopup({
  station,
  anchor,
  activeStep,
  onOptionClick,
  onClose,
}: {
  station: KitchenStationId
  anchor: { x: number; y: number } | null
  activeStep: ActiveCookingStep | undefined
  onOptionClick: (step: ActiveCookingStep, option: CookingStepOption) => void
  onClose: () => void
}) {
  const info = STATION_INFO[station]
  const x = anchor?.x ?? 24
  const y = anchor?.y ?? 24

  return (
    <motion.div
      className="absolute inset-0 z-[80] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Popup card */}
      <motion.div
        className="absolute pointer-events-auto bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 min-w-[220px] max-w-[300px]"
        style={{
          left: `clamp(12px, ${x + 14}px, calc(100% - 316px))`,
          top: `clamp(12px, ${y - 24}px, calc(100% - 280px))`,
        }}
        initial={{ scale: 0.94, opacity: 0, y: 6 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 6 }}
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
            </div>

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
