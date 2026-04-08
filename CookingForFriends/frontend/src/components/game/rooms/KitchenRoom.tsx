/** Kitchen room — multi-dish cooking with clickable station areas.
 *
 *  Stations: fridge, cutting board, spice rack, 3 burners, oven, plating area.
 *  Each station is a clickable area. Clicking opens a popup showing available
 *  actions based on the current dish states. Actions advance the dish's linear
 *  state machine. Backend pushes phase transitions; frontend manages steps.
 *
 *  Initial prototype: spaghetti (one dish active by default).
 *  Other dishes unlock via backend events.
 */

import { useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import PMTargetItems from '../PMTargetItems'
import type { DishId, DishState, KitchenStationId } from '../../../types'

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

/** Station visual positions in the kitchen (% of room area) */
const STATION_POSITIONS: Record<KitchenStationId, { left: string; top: string; width: string; height: string }> = {
  fridge:        { left: '78%', top: '2%',  width: '20%', height: '32%' },
  cutting_board: { left: '22%', top: '2%',  width: '28%', height: '14%' },
  spice_rack:    { left: '2%',  top: '72%', width: '25%', height: '20%' },
  burner1:       { left: '18%', top: '32%', width: '20%', height: '30%' },
  burner2:       { left: '40%', top: '32%', width: '20%', height: '30%' },
  burner3:       { left: '60%', top: '32%', width: '20%', height: '30%' },
  oven:          { left: '65%', top: '70%', width: '33%', height: '28%' },
  plating_area:  { left: '52%', top: '2%',  width: '24%', height: '14%' },
}

interface AvailableAction {
  dishId: DishId
  stepIndex: number
  label: string
  description: string
  emoji: string
}

/** Get all available actions at a given station based on current dish states */
function getActionsForStation(station: KitchenStationId, dishes: Record<DishId, DishState>): AvailableAction[] {
  const actions: AvailableAction[] = []

  for (const dish of Object.values(dishes)) {
    if (dish.currentStepIndex >= dish.steps.length) continue
    if (!dish.stepReady) continue

    const step = dish.steps[dish.currentStepIndex]
    if (step.station === station) {
      actions.push({
        dishId: dish.id,
        stepIndex: dish.currentStepIndex,
        label: `${dish.emoji} ${step.label}`,
        description: `${dish.label}: ${step.description}`,
        emoji: dish.emoji,
      })
    }
  }

  return actions
}

/** Check if any dish has an upcoming step at this station */
function hasActivity(station: KitchenStationId, dishes: Record<DishId, DishState>): boolean {
  return Object.values(dishes).some(dish => {
    if (dish.currentStepIndex >= dish.steps.length) return false
    return dish.steps[dish.currentStepIndex]?.station === station
  })
}

/** Check if any dish has a ready action at this station */
function hasReadyAction(station: KitchenStationId, dishes: Record<DishId, DishState>): boolean {
  return Object.values(dishes).some(dish => {
    if (dish.currentStepIndex >= dish.steps.length) return false
    if (!dish.stepReady) return false
    return dish.steps[dish.currentStepIndex]?.station === station
  })
}

export default function KitchenRoom({ isActive }: { isActive: boolean }) {
  const dishes = useGameStore((s) => s.dishes)
  const activeStation = useGameStore((s) => s.activeStation)
  const setActiveStation = useGameStore((s) => s.setActiveStation)
  const advanceDishStep = useGameStore((s) => s.advanceDishStep)

  const handleStationClick = useCallback((station: KitchenStationId) => {
    if (!isActive) return
    setActiveStation(activeStation === station ? null : station)
  }, [isActive, activeStation, setActiveStation])

  const handleAction = useCallback((dishId: DishId) => {
    advanceDishStep(dishId)
    setActiveStation(null)
  }, [advanceDishStep, setActiveStation])

  const popupActions = useMemo(() => {
    if (!activeStation) return []
    return getActionsForStation(activeStation, dishes)
  }, [activeStation, dishes])

  return (
    <div className="absolute inset-0">
      {/* Station instruction */}
      <div className="absolute top-9 left-2 z-10 pointer-events-none">
        <span className="text-[10px] text-slate-300/80 bg-slate-900/50 rounded px-1.5 py-0.5">
          Click stations to cook
        </span>
      </div>

      {/* Clickable station hotspots */}
      {(Object.entries(STATION_POSITIONS) as [KitchenStationId, typeof STATION_POSITIONS[KitchenStationId]][]).map(
        ([stationId, pos]) => {
          const info = STATION_INFO[stationId]
          const isOpen = activeStation === stationId
          const active = hasActivity(stationId, dishes)
          const ready = hasReadyAction(stationId, dishes)

          return (
            <motion.button
              key={stationId}
              className={`absolute z-10 rounded-lg border-2 transition-all duration-200
                ${isActive ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
                ${isOpen
                  ? 'border-cooking-400 bg-cooking-900/30'
                  : ready
                    ? 'border-green-400/60 bg-green-900/20 hover:bg-green-900/30'
                    : active
                      ? 'border-slate-400/30 bg-slate-800/20 hover:bg-slate-800/40'
                      : 'border-transparent hover:border-slate-500/20 bg-transparent hover:bg-slate-800/20'
                }
              `}
              style={pos}
              onClick={() => handleStationClick(stationId)}
              animate={ready ? { boxShadow: ['0 0 0px rgba(74,222,128,0)', '0 0 12px rgba(74,222,128,0.4)', '0 0 0px rgba(74,222,128,0)'] } : {}}
              transition={ready ? { repeat: Infinity, duration: 2 } : {}}
            >
              <div className="absolute bottom-0.5 left-1 text-[8px] text-slate-400/70 font-medium whitespace-nowrap">
                {info.emoji} {info.label}
              </div>
            </motion.button>
          )
        }
      )}

      {/* Station action popup */}
      <AnimatePresence>
        {activeStation && isActive && (
          <StationPopup
            station={activeStation}
            actions={popupActions}
            onAction={handleAction}
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

/** Popup showing available actions at a station */
function StationPopup({
  station,
  actions,
  onAction,
  onClose,
}: {
  station: KitchenStationId
  actions: AvailableAction[]
  onAction: (dishId: DishId) => void
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
        className="relative bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 min-w-[200px] max-w-[280px]"
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

        {/* Actions */}
        {actions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {actions.map((action) => (
              <button
                key={`${action.dishId}-${action.stepIndex}`}
                className="flex flex-col gap-0.5 p-2 rounded-lg bg-slate-700/50 hover:bg-cooking-900/40 
                  border border-slate-600/50 hover:border-cooking-400/50 transition-colors text-left"
                onClick={() => onAction(action.dishId)}
              >
                <span className="text-sm font-medium text-slate-100">{action.label}</span>
                <span className="text-[10px] text-slate-400">{action.description}</span>
              </button>
            ))}
          </div>
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

/** Small dish status indicator */
function DishIndicator({ dish }: { dish: DishState }) {
  if (dish.phase === 'idle' && !dish.stepReady) return null

  const progress = dish.steps.length > 0
    ? Math.round((dish.currentStepIndex / dish.steps.length) * 100)
    : 0

  const phaseColor = {
    idle: 'bg-slate-600',
    prep: 'bg-blue-500',
    cooking: 'bg-orange-500',
    waiting: 'bg-yellow-500',
    ready: 'bg-green-500',
    plated: 'bg-emerald-600',
    served: 'bg-slate-400',
  }[dish.phase]

  return (
    <div className="flex items-center gap-1 bg-slate-900/70 rounded px-1.5 py-0.5">
      <span className="text-[10px]">{dish.emoji}</span>
      <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${phaseColor}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
