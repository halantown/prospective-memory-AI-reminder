/** Recipe tab — press-and-hold recipe viewer.
 *
 * Default: "Hold to view recipe" prompt with cookbook icon.
 * While holding: shows all 4 dishes with step lists, highlighting current step.
 * On release: hides recipes, sends recipe_view event to backend with duration.
 */

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { DishId, DishState, CookingStepResult, ActiveCookingStep, CookingWaitStep } from '../../../types'

const DISH_ORDER: DishId[] = ['spaghetti', 'steak', 'tomato_soup', 'roasted_vegetables']

export default function RecipeTab() {
  const [isHolding, setIsHolding] = useState(false)
  const holdStartRef = useRef<number>(0)
  const dishes = useGameStore((s) => s.dishes)
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const cookingWaitSteps = useGameStore((s) => s.cookingWaitSteps)
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
    /* All press/release handlers on the outermost div so that the overlay
       appearing on top never triggers a spurious mouseleave on an inner div */
    <div
      className="flex-1 flex flex-col relative select-none cursor-pointer"
      onMouseDown={handleHoldStart}
      onMouseUp={handleHoldEnd}
      onMouseLeave={handleHoldEnd}
      onTouchStart={handleHoldStart}
      onTouchEnd={handleHoldEnd}
      onTouchCancel={handleHoldEnd}
    >
      {/* Resting state */}
      {!isHolding && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 active:bg-slate-700/30 transition-colors">
          <div className="flex flex-col items-center text-slate-400">
            <span className="text-3xl mb-3">📖</span>
            <p className="text-sm text-center font-medium mb-1">Recipe Book</p>
            <p className="text-xs text-center text-slate-500 leading-relaxed">
              Press and hold to view recipes
            </p>
          </div>
        </div>
      )}

      {/* Recipe overlay — shown while holding */}
      <AnimatePresence>
        {isHolding && (
          <motion.div
            className="absolute inset-0 z-20 bg-slate-900/95 overflow-hidden p-3 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="text-center mb-2 shrink-0">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                📖 Recipes — Release to close
              </span>
            </div>
            {/* 2×2 grid, no scroll */}
            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
              {DISH_ORDER.map(dishId => (
                <DishRecipeCard
                  key={dishId}
                  dish={dishes[dishId]}
                  activeStep={activeCookingSteps.find(s => s.dishId === dishId)}
                  waitStep={cookingWaitSteps.find(s => s.dishId === dishId)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Recipe card for a single dish showing previous/current/next and current details. */
function DishRecipeCard({
  dish,
  activeStep,
  waitStep,
}: {
  dish: DishState
  activeStep: ActiveCookingStep | undefined
  waitStep: CookingWaitStep | undefined
}) {
  const isActive = dish.phase !== 'idle' && dish.phase !== 'served'
  const isDone = dish.phase === 'served'
  const currentIndex = activeStep?.stepIndex ?? waitStep?.stepIndex ?? dish.currentStepIndex
  const previousStep = currentIndex > 0 ? dish.steps[currentIndex - 1] : undefined
  const currentStep = activeStep
    ? { label: activeStep.stepLabel, description: activeStep.stepDescription }
    : waitStep
      ? { label: waitStep.stepLabel, description: waitStep.stepDescription }
      : dish.steps[currentIndex]
        ? { label: dish.steps[currentIndex].label, description: dish.steps[currentIndex].description }
        : undefined
  const nextStep = currentIndex < dish.steps.length - 1 ? dish.steps[currentIndex + 1] : undefined

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

      {isDone ? (
        <div className="flex-1 flex items-center justify-center text-green-300 text-xs font-semibold">
          {dish.emoji} Complete
        </div>
      ) : (
        <div className="flex flex-col gap-1 min-h-0">
          {previousStep && (
            <StepRow
              label={previousStep.label}
              isCurrent={false}
              isCompleted={true}
              result={dish.stepResults.find(r => r.stepIndex === currentIndex - 1)}
            />
          )}
          {currentStep && (
            <>
              <StepRow
                label={currentStep.label}
                isCurrent={isActive}
                isCompleted={false}
                result={dish.stepResults.find(r => r.stepIndex === currentIndex)}
              />
              {isActive && (
                <div className="rounded-md bg-slate-950/70 border border-slate-700/60 px-2 py-1.5">
                  <p className="text-[10px] leading-snug text-slate-200">
                    {currentStep.description || 'Check this step carefully.'}
                  </p>
                </div>
              )}
            </>
          )}
          {nextStep && (
            <StepRow
              label={nextStep.label}
              isCurrent={false}
              isCompleted={false}
              result={undefined}
            />
          )}
        </div>
      )}
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
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
      isCurrent
        ? 'bg-cooking-900/40 border border-cooking-400/40 text-slate-100 font-medium'
        : isCompleted
          ? 'text-slate-500 line-through'
          : 'text-slate-400'
    }`}>
      {resultIcon && <span className="text-[11px]">{resultIcon}</span>}
      {isCurrent && !resultIcon && <span className="text-[11px]">▶</span>}
      {!isCurrent && !isCompleted && !resultIcon && <span className="text-[11px] text-slate-600">○</span>}
      <span className="truncate">{label}</span>
    </div>
  )
}
