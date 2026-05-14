/** Kitchen timer banner — persistent primary cue for active cooking steps. */

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { ActiveCookingStep, KitchenStationId } from '../../../types'

// ⑬ Station-contextual emoji shown alongside dish emoji in the banner header.
const STATION_CONTEXT_EMOJI: Record<KitchenStationId, string> = {
  fridge:        '🧊',
  cutting_board: '🔪',
  spice_rack:    '🧂',
  burner1:       '🔥',
  burner2:       '🔥',
  burner3:       '🔥',
  oven:          '♨️',
  plating_area:  '🍽️',
}

function formatRemaining(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds))
  return `${safe}s`
}

function remainingSeconds(step: ActiveCookingStep, estimatedGameSeconds: number, now: number) {
  if (step.deadlineGameTime != null) {
    return step.deadlineGameTime - estimatedGameSeconds
  }
  const elapsedWallSeconds = (now - step.activatedAt) / 1000
  return step.windowSeconds - elapsedWallSeconds
}

export default function KitchenTimerBanner() {
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const cookingWaitSteps = useGameStore((s) => s.cookingWaitSteps)
  const cookingFinishedWaitSteps = useGameStore((s) => s.cookingFinishedWaitSteps)
  const missedStepFlashes = useGameStore((s) => s.missedStepFlashes)
  const dishes = useGameStore((s) => s.dishes)
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds)
  const gameTimeFrozen = useGameStore((s) => s.gameTimeFrozen)
  const wsSend = useGameStore((s) => s.wsSend)
  const [now, setNow] = useState(Date.now())
  const [elapsedSnapshot, setElapsedSnapshot] = useState(() => ({
    value: elapsedSeconds,
    capturedAt: Date.now(),
  }))

  useEffect(() => {
    setElapsedSnapshot({ value: elapsedSeconds, capturedAt: Date.now() })
  }, [elapsedSeconds, gameTimeFrozen])

  useEffect(() => {
    if (activeCookingSteps.length === 0) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [activeCookingSteps.length, gameTimeFrozen])

  const missedItem = missedStepFlashes[missedStepFlashes.length - 1]
  const activeStep = activeCookingSteps[0]
  const activeDish = activeStep ? dishes[activeStep.dishId] : null
  const estimatedGameSeconds = gameTimeFrozen
    ? elapsedSnapshot.value
    : elapsedSnapshot.value + (now - elapsedSnapshot.capturedAt) / 1000
  const remaining = activeStep ? remainingSeconds(activeStep, estimatedGameSeconds, now) : 0
  const urgencyThreshold = activeStep ? activeStep.windowSeconds * 0.25 : 0
  const isUrgent = Boolean(activeStep && remaining > 0 && remaining <= urgencyThreshold)
  const isPaused = gameTimeFrozen && Boolean(activeStep)

  const banner = useMemo(() => {
    if (missedItem) {
      return {
        key: `missed-${missedItem.dishId}-${missedItem.stepIndex}`,
        missed: true,
        emoji: missedItem.emoji,
        stationEmoji: null as string | null,
        title: 'Missed!',
        detail: missedItem.stepLabel,
        remainingLabel: '',
        progressRatio: null as number | null,
      }
    }
    if (activeStep) {
      const progressRatio = activeStep.windowSeconds > 0
        ? Math.max(0, remaining / activeStep.windowSeconds)
        : null
      return {
        key: `${activeStep.dishId}-${activeStep.stepIndex}`,
        missed: false,
        activeCount: activeCookingSteps.length,
        emoji: activeDish?.emoji || '🍳',
        stationEmoji: STATION_CONTEXT_EMOJI[activeStep.station] ?? null,
        title: activeStep.stepLabel,
        detail: activeCookingSteps.length > 1
          ? `${activeCookingSteps.length} kitchen actions active`
          : '',
        remainingLabel: formatRemaining(remaining),
        progressRatio,
      }
    }
    if (cookingFinishedWaitSteps.length > 0) {
      const item = cookingFinishedWaitSteps[cookingFinishedWaitSteps.length - 1]
      return {
        key: `finished-${item.dishId}-${item.stepIndex}`,
        missed: false,
        activeCount: 0,
        emoji: dishes[item.dishId]?.emoji || '🍳',
        stationEmoji: STATION_CONTEXT_EMOJI[item.station] ?? null,
        title: 'Timer finished',
        detail: item.stepLabel,
        remainingLabel: 'ready',
        progressRatio: null as number | null,
      }
    }
    if (cookingWaitSteps.length > 0) {
      const item = cookingWaitSteps[0]
      return {
        key: `waiting-${item.dishId}-${item.stepIndex}`,
        missed: false,
        activeCount: 0,
        emoji: dishes[item.dishId]?.emoji || '🍳',
        stationEmoji: STATION_CONTEXT_EMOJI[item.station] ?? null,
        title: item.stepLabel,
        detail: cookingWaitSteps.length > 1
          ? `${cookingWaitSteps.length} dishes cooking`
          : 'Cooking',
        remainingLabel: '',
        progressRatio: null as number | null,
      }
    }
    return null
  }, [activeCookingSteps, activeDish?.emoji, activeStep, cookingFinishedWaitSteps, cookingWaitSteps, dishes, missedItem, remaining])

  useEffect(() => {
    if (!banner || !wsSend) return
    const timestamp = Date.now() / 1000
    wsSend({
      type: 'kitchen_timer_shown',
      data: {
        timer_key: banner.key,
        title: banner.title,
        detail: banner.detail,
        missed: banner.missed,
        timestamp,
      },
    })
    return () => {
      wsSend({
        type: 'kitchen_timer_hidden',
        data: {
          timer_key: banner.key,
          timestamp: Date.now() / 1000,
        },
      })
    }
  }, [banner?.key, wsSend])

  const queueItems = useMemo(() => {
    return activeCookingSteps.slice(0, 3).map(step => ({
      key: `${step.dishId}-${step.stepIndex}`,
      emoji: dishes[step.dishId]?.emoji || '🍳',
      stationEmoji: STATION_CONTEXT_EMOJI[step.station] ?? null,
      label: step.stepLabel,
    }))
  }, [activeCookingSteps, dishes])

  return (
    <AnimatePresence initial={false}>
      {banner && (
        <motion.div
          key={banner.key}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: isUrgent && !isPaused && !banner.missed ? [1, 1.025, 1] : 1,
            borderColor: banner.missed
              ? ['rgba(254,202,202,1)', 'rgba(239,68,68,1)', 'rgba(254,202,202,1)']
              : undefined,
          }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{
            duration: 0.18,
            scale: isUrgent && !isPaused && !banner.missed ? { repeat: Infinity, duration: 0.75 } : undefined,
            borderColor: banner.missed ? { repeat: 2, duration: 0.28 } : undefined,
          }}
          className="pointer-events-none absolute left-0 right-0 top-[38px] z-20 px-4 py-1.5"
        >
          <div
            className={`rounded-lg border-2 px-3.5 py-2 shadow-xl ${
              banner.missed
                ? 'bg-red-600 text-white border-red-200 shadow-red-950/50'
                : isPaused
                  ? 'bg-slate-600 text-white border-slate-300 shadow-slate-950/50'
                : isUrgent
                  ? 'bg-orange-500 text-white border-orange-100 shadow-orange-950/60 ring-4 ring-orange-300/30'
                  : 'bg-orange-500 text-white border-orange-200 shadow-orange-950/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {/* ⑬ Dish emoji + station context emoji */}
              <div className="flex items-center gap-0.5 leading-none flex-shrink-0">
                <span className="text-2xl">{banner.emoji}</span>
                {banner.stationEmoji && (
                  <span className="text-base -mt-2 -ml-1 drop-shadow">{banner.stationEmoji}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-black leading-tight truncate">
                    {banner.title}
                  </span>
                  {banner.remainingLabel && (
                    <span className="ml-auto shrink-0 rounded bg-black/20 px-2 py-0.5 text-[14px] font-black tabular-nums">
                      {isPaused ? 'paused' : banner.remainingLabel}
                    </span>
                  )}
                </div>
                {banner.detail && (
                  <p className="mt-1 text-[11px] font-semibold leading-snug text-white/85 truncate">
                    {banner.detail}
                  </p>
                )}
                {queueItems.length > 1 && (
                  <div className="mt-1.5 flex gap-1 overflow-hidden">
                    {queueItems.map(item => (
                      <span
                        key={item.key}
                        className="min-w-0 rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-white/90"
                      >
                        <span className="mr-0.5">{item.emoji}</span>
                        {item.stationEmoji && <span className="mr-0.5">{item.stationEmoji}</span>}
                        <span className="align-middle">{item.label}</span>
                      </span>
                    ))}
                  </div>
                )}
                {/* ⑬ Time progress bar: green → yellow → red */}
                {banner.progressRatio != null && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-black/20 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.max(0, Math.min(1, banner.progressRatio)) * 100}%`,
                        backgroundColor: isPaused ? '#cbd5e1' :
                          banner.progressRatio > 0.5 ? '#86efac'
                          : banner.progressRatio > 0.25 ? '#fde047'
                          : '#fca5a5',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
