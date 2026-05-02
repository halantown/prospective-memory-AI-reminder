/** Kitchen timer banner — persistent primary cue for active cooking steps. */

import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'

export default function KitchenTimerBanner() {
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const missedStepFlashes = useGameStore((s) => s.missedStepFlashes)
  const dishes = useGameStore((s) => s.dishes)

  const activeVisible = activeCookingSteps.slice(-2)
  const allItems = [
    ...activeVisible.map((step) => ({ key: `${step.dishId}-${step.stepIndex}`, missed: false, label: step.stepLabel, emoji: dishes[step.dishId]?.emoji || '🍳' })),
    ...missedStepFlashes.map((f) => ({ key: `missed-${f.dishId}-${f.stepIndex}`, missed: true, label: f.stepLabel, emoji: f.emoji })),
  ]

  return (
    <AnimatePresence initial={false}>
      {allItems.length > 0 && (
        <motion.div
          key="kitchen-timer-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="relative z-40 px-4 pb-2 flex flex-col gap-1.5"
        >
          {allItems.map((item) => (
            <motion.div
              key={item.key}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={`flex items-center gap-2 rounded-full px-3 py-2 shadow-lg border ${
                item.missed
                  ? 'bg-slate-600/80 border-slate-500/50 text-slate-300 shadow-black/20'
                  : 'bg-orange-500/95 border-orange-200/50 text-white shadow-orange-950/30'
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              <span
                className={`text-[13px] font-semibold leading-tight truncate ${
                  item.missed ? 'line-through opacity-70' : ''
                }`}
              >
                {item.missed ? `Missed: ${item.label}` : `${item.label}!`}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
