import { useMemo } from 'react'
import { useGameStore } from '../../stores/gameStore'

export default function DinnerStatusStrip() {
  const dishes = useGameStore((s) => s.dishes)
  const dishOrder = useGameStore((s) => s.cookingDishOrder)
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const cookingWaitSteps = useGameStore((s) => s.cookingWaitSteps)
  const cookingFinishedWaitSteps = useGameStore((s) => s.cookingFinishedWaitSteps)

  const servedCount = dishOrder.filter(id => dishes[id]?.phase === 'served').length
  const activeLabels = useMemo(() => {
    const ready = cookingFinishedWaitSteps.map(step => ({
      key: `ready-${step.dishId}-${step.stepIndex}`,
      text: `${dishes[step.dishId]?.label ?? 'Dish'} ready to check`,
    }))
    const active = activeCookingSteps.map(step => ({
      key: `active-${step.dishId}-${step.stepIndex}`,
      text: `${dishes[step.dishId]?.label ?? 'Dish'}: ${step.stepLabel}`,
    }))
    const waiting = cookingWaitSteps.map(step => ({
      key: `wait-${step.dishId}-${step.stepIndex}`,
      text: `${dishes[step.dishId]?.label ?? 'Dish'} ${step.stepLabel.toLowerCase()}`,
    }))
    return [...ready, ...active, ...waiting].slice(0, 3)
  }, [activeCookingSteps, cookingFinishedWaitSteps, cookingWaitSteps, dishes])

  return (
    <div className="absolute left-4 right-4 top-3 z-30 pointer-events-none">
      <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-md border border-white/15 bg-slate-950/75 px-3 py-2 text-xs text-white shadow-lg backdrop-blur">
        <span className="shrink-0 font-bold text-amber-200">Dinner prep</span>
        <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 font-semibold tabular-nums">
          {servedCount}/{dishOrder.length} served
        </span>
        <div className="min-w-0 flex flex-1 gap-1 overflow-hidden">
          {activeLabels.length > 0 ? activeLabels.map(item => (
            <span key={item.key} className="truncate rounded bg-white/10 px-2 py-0.5 text-white/90">
              {item.text}
            </span>
          )) : (
            <span className="truncate text-white/70">Friends are arriving soon</span>
          )}
        </div>
      </div>
    </div>
  )
}
