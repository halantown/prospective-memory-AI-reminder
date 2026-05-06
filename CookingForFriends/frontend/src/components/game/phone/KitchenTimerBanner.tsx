/** Kitchen timer banner — persistent primary cue for active cooking steps. */

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { ActiveCookingStep } from '../../../types'

function formatRemaining(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds))
  return `${safe}s`
}

function remainingSeconds(step: ActiveCookingStep, elapsedSeconds: number, now: number) {
  if (step.deadlineGameTime != null) {
    return step.deadlineGameTime - elapsedSeconds
  }
  const elapsedWallSeconds = (now - step.activatedAt) / 1000
  return step.windowSeconds - elapsedWallSeconds
}

export default function KitchenTimerBanner() {
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const missedStepFlashes = useGameStore((s) => s.missedStepFlashes)
  const dishes = useGameStore((s) => s.dishes)
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (activeCookingSteps.length === 0) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [activeCookingSteps.length])

  const missedItem = missedStepFlashes[missedStepFlashes.length - 1]
  const activeStep = activeCookingSteps[0]
  const activeDish = activeStep ? dishes[activeStep.dishId] : null
  const remaining = activeStep ? remainingSeconds(activeStep, elapsedSeconds, now) : 0
  const urgencyThreshold = activeStep ? activeStep.windowSeconds * 0.25 : 0
  const isUrgent = Boolean(activeStep && remaining <= urgencyThreshold)

  const banner = useMemo(() => {
    if (missedItem) {
      return {
        key: `missed-${missedItem.dishId}-${missedItem.stepIndex}`,
        missed: true,
        emoji: missedItem.emoji,
        title: 'Missed!',
        detail: missedItem.stepLabel,
        remainingLabel: '',
      }
    }
    if (activeStep) {
      return {
        key: `${activeStep.dishId}-${activeStep.stepIndex}`,
        missed: false,
        emoji: activeDish?.emoji || '🍳',
        title: activeStep.stepLabel,
        detail: activeStep.stepDescription || activeDish?.label || 'Kitchen step',
        remainingLabel: formatRemaining(remaining),
      }
    }
    return null
  }, [activeDish?.emoji, activeDish?.label, activeStep, missedItem, remaining])

  return (
    <AnimatePresence initial={false}>
      {banner && (
        <motion.div
          key={banner.key}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: isUrgent && !banner.missed ? [1, 1.025, 1] : 1,
            borderColor: banner.missed
              ? ['rgba(254,202,202,1)', 'rgba(239,68,68,1)', 'rgba(254,202,202,1)']
              : undefined,
          }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{
            duration: 0.18,
            scale: isUrgent && !banner.missed ? { repeat: Infinity, duration: 0.75 } : undefined,
            borderColor: banner.missed ? { repeat: 2, duration: 0.28 } : undefined,
          }}
          className="relative z-20 px-4 py-2 shrink-0"
        >
          <div
            className={`rounded-lg border-2 px-4 py-3 shadow-2xl ${
              banner.missed
                ? 'bg-red-600 text-white border-red-200 shadow-red-950/50'
                : isUrgent
                  ? 'bg-orange-500 text-white border-orange-100 shadow-orange-950/60 ring-4 ring-orange-300/30'
                  : 'bg-orange-500 text-white border-orange-200 shadow-orange-950/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">{banner.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-black leading-tight truncate">
                    {banner.title}
                  </span>
                  {banner.remainingLabel && (
                    <span className="ml-auto shrink-0 rounded bg-black/20 px-2 py-0.5 text-[15px] font-black tabular-nums">
                      {banner.remainingLabel}
                    </span>
                  )}
                </div>
                {banner.detail && (
                  <p className="mt-1 text-[11px] font-semibold leading-snug text-white/85 truncate">
                    {banner.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
