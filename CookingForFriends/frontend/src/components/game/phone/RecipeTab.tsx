/** Recipe tab — press-and-hold recipe viewer.
 *
 * Default: "Hold to view recipe" prompt with cookbook icon.
 * While holding: shows all 4 dishes with step lists, highlighting current step.
 * On release: hides recipes, sends recipe_view event to backend with duration.
 */

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { DishId, DishState, CookingStepResult } from '../../../types'

const DISH_ORDER: DishId[] = ['spaghetti', 'steak', 'tomato_soup', 'roasted_vegetables']

export default function RecipeTab() {
  const [isHolding, setIsHolding] = useState(false)
  const holdStartRef = useRef<number>(0)
  const dishes = useGameStore((s) => s.dishes)
  const wsSend = useGameStore((s) => s.wsSend)

  const handleHoldStart = useCallback(() => {
    holdStartRef.current = Date.now()
    setIsHolding(true)
  }, [])

  const handleHoldEnd = useCallback(() => {
    if (!isHolding) return
    setIsHolding(false)

    const start = holdStartRef.current
    const end = Date.now()
    const durationMs = end - start

    // Send recipe_view event to backend for logging
    if (wsSend && durationMs > 200) {
      wsSend({
        type: 'recipe_view',
        data: {
          start_ts: start / 1000,
          end_ts: end / 1000,
          duration_ms: durationMs,
          active_dishes: DISH_ORDER.filter(d => dishes[d].phase !== 'idle'),
        },
      })
    }
  }, [isHolding, dishes, wsSend])

  return (
    <div className="flex-1 flex flex-col relative select-none">
      {/* Hold trigger area */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-4 cursor-pointer active:bg-slate-700/30 transition-colors"
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onMouseLeave={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
        onTouchCancel={handleHoldEnd}
      >
        {!isHolding && (
          <div className="flex flex-col items-center text-slate-400">
            <span className="text-3xl mb-3">📖</span>
            <p className="text-xs text-center font-medium mb-1">Recipe Book</p>
            <p className="text-[10px] text-center text-slate-500 leading-relaxed">
              Press and hold to view recipes
            </p>
          </div>
        )}
      </div>

      {/* Recipe overlay — shown while holding; captures release events too */}
      <AnimatePresence>
        {isHolding && (
          <motion.div
            className="absolute inset-0 z-20 bg-slate-900/95 overflow-hidden p-3 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchEnd={handleHoldEnd}
            onTouchCancel={handleHoldEnd}
          >
            <div className="text-center mb-2 shrink-0">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                📖 Recipes — Release to close
              </span>
            </div>
            {/* 2×2 grid, no scroll */}
            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
              {DISH_ORDER.map(dishId => (
                <DishRecipeCard key={dishId} dish={dishes[dishId]} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Recipe card for a single dish showing all steps */
function DishRecipeCard({ dish }: { dish: DishState }) {
  const isActive = dish.phase !== 'idle' && dish.phase !== 'served'
  const isDone = dish.phase === 'served'

  return (
    <div className={`rounded-lg border p-2 flex flex-col min-h-0 overflow-hidden ${
      isActive ? 'border-cooking-400/50 bg-slate-800/80' :
      isDone ? 'border-slate-600/30 bg-slate-800/40' :
      'border-slate-700/40 bg-slate-800/30'
    }`}>
      {/* Dish header */}
      <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
        <span className="text-xs">{dish.emoji}</span>
        <span className={`text-[11px] font-semibold truncate ${isActive ? 'text-slate-100' : 'text-slate-400'}`}>
          {dish.label}
        </span>
        {isDone && <span className="text-[9px] text-green-400 ml-auto shrink-0">✓</span>}
        {dish.phase === 'idle' && <span className="text-[9px] text-slate-500 ml-auto shrink-0">…</span>}
      </div>

      {/* Step list — scrollable if too many steps */}
      <div className="flex flex-col gap-0.5 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-600">
        {dish.steps.map((step, idx) => {
          const isCurrent = idx === dish.currentStepIndex && isActive
          const isCompleted = idx < dish.currentStepIndex
          const result = dish.stepResults.find(r => r.stepIndex === idx)

          return (
            <StepRow
              key={step.id}
              label={step.label}
              isCurrent={isCurrent}
              isCompleted={isCompleted}
              result={result}
            />
          )
        })}
      </div>
    </div>
  )
}

function StepRow({
  label,
  isCurrent,
  isCompleted,
  result,
}: {
  label: string
  isCurrent: boolean
  isCompleted: boolean
  result: CookingStepResult | undefined
}) {
  const resultIcon = result
    ? result.result === 'correct' ? '✅'
    : result.result === 'wrong' ? '❌'
    : '⏭️'
    : null

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${
      isCurrent
        ? 'bg-cooking-900/40 border border-cooking-400/40 text-slate-100 font-medium'
        : isCompleted
          ? 'text-slate-500 line-through'
          : 'text-slate-400'
    }`}>
      {resultIcon && <span className="text-[9px]">{resultIcon}</span>}
      {isCurrent && !resultIcon && <span className="text-[9px]">▶</span>}
      {!isCurrent && !isCompleted && !resultIcon && <span className="text-[9px] text-slate-600">○</span>}
      <span className="truncate">{label}</span>
    </div>
  )
}
