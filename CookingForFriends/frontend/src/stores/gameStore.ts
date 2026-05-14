/** Global game store — Zustand (composed from domain slices). */

import { create } from 'zustand'
import type {
  TaskOrder, CookingDefinitions, DishId, DishState, ActiveCookingStep, CookingWaitStep,
} from '../types'
import type { GameState } from './slices/types'
import { createSessionSlice } from './slices/sessionSlice'
import { createCookingSlice, createInitialDishes, EMPTY_SEAT, initialPans, FALLBACK_DISH_ORDER } from './slices/cookingSlice'
import { createPhoneSlice } from './slices/phoneSlice'
import { createPMSlice } from './slices/pmSlice'
import { createUISlice } from './slices/uiSlice'

export type { GameState }
export { FALLBACK_DISH_ORDER }

export const useGameStore = create<GameState>()((...a) => {
  const [set, get] = a
  return {
    ...createSessionSlice(...a),
    ...createCookingSlice(...a),
    ...createPhoneSlice(...a),
    ...createPMSlice(...a),
    ...createUISlice(...a),

    setSession: (data) => {
      const cookingState = data.cooking_definitions
        ? {
            cookingDefinitions: data.cooking_definitions as CookingDefinitions,
            cookingDishOrder: (data.cooking_definitions as CookingDefinitions).dish_order,
            dishes: createInitialDishes(data.cooking_definitions as CookingDefinitions),
          }
        : {}
      set({
        sessionId: data.session_id,
        participantId: data.participant_id,
        condition: data.condition,
        taskOrder: (data.task_order as TaskOrder) || null,
        isTest: data.is_test ?? false,
        currentPhase: data.current_phase ?? 'welcome',
        ...cookingState,
      })
    },

    resetBlock: () => set((s) => ({
      currentRoom: 'kitchen',
      previousRoom: null,
      avatarMoving: false,
      pans: [...initialPans],
      kitchenScore: 0,
      dishes: createInitialDishes(s.cookingDefinitions),
      activeStation: null,
      activeCookingSteps: [],
      missedStepFlashes: [],
      cookingWaitSteps: [],
      cookingFinishedWaitSteps: [],
      cookingScore: { correct: 0, wrong: 0, missed: 0 },
      diningPhase: 'idle' as const,
      diningSeats: [{ ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }],
      diningSelectedUtensil: null,
      diningRound: 0,
      diningScore: 0,
      visitors: [],
      phoneMessages: [],
      phoneLocked: true,
      phoneBanner: null,
      contacts: [],
      activeContactId: null,
      activePhoneTab: 'chats' as const,
      recipeTabBounce: false,
      phoneTabPrompt: null,
      lockSystemNotifications: [],
      robot: { room: 'kitchen' as const, speaking: false, text: '', visible: true },
      activePMTrials: [],
      completedPMTrialIds: new Set<string>(),
      pmTargetSelected: null,
      pmActionPhase: 'idle' as const,
      activeTriggerEffects: [],
      gameClock: '17:00',
      elapsedSeconds: 0,
    })),

    restoreRuntimeState: (state) => set((s) => {
      const cooking = state.cooking as Record<string, unknown> | undefined
      const cookingDishes = cooking?.dishes as Record<string, {
        phase?: string
        current_step_index?: number
        results?: Array<{ step_index: number; result: 'correct' | 'wrong' | 'missed' }>
        started_at?: number | null
        completed_at?: number | null
      }> | undefined
      const activeStepsRaw = (cooking?.active_steps as Array<Record<string, unknown>> | undefined) ?? []
      const waitStepsRaw = (cooking?.wait_steps as Array<Record<string, unknown>> | undefined) ?? []

      const dishes: Record<DishId, DishState> = { ...s.dishes }
      for (const dishId of s.cookingDishOrder) {
        const restored = cookingDishes?.[dishId]
        const current = dishes[dishId]
        if (!restored || !current) continue
        const hasActive = activeStepsRaw.some((step) => step.dish === dishId)
        const hasWait = waitStepsRaw.some((step) => step.dish === dishId)
        const backendPhase = restored.phase ?? current.phase
        const phase: DishState['phase'] = hasActive
          ? 'cooking'
          : hasWait
            ? 'waiting'
            : backendPhase === 'done'
              ? 'served'
              : backendPhase === 'waiting'
                ? 'waiting'
                : backendPhase === 'idle'
                  ? 'idle'
                  : 'prep'
        dishes[dishId] = {
          ...current,
          phase,
          currentStepIndex: restored.current_step_index ?? current.currentStepIndex,
          stepReady: hasActive,
          startedAt: restored.started_at ? restored.started_at * 1000 : current.startedAt,
          completedAt: restored.completed_at ? restored.completed_at * 1000 : current.completedAt,
          stepResults: (restored.results ?? []).map((result) => ({
            dishId,
            stepIndex: result.step_index,
            result: result.result,
          })),
        }
      }

      const activeCookingSteps: ActiveCookingStep[] = activeStepsRaw.map((step) => ({
        dishId: step.dish as DishId,
        stepIndex: step.step_index as number,
        stepLabel: step.label as string,
        stepDescription: (step.description as string) || '',
        station: step.station as ActiveCookingStep['station'],
        options: (step.options as ActiveCookingStep['options']) || [],
        activatedAt: step.activated_at ? (step.activated_at as number) * 1000 : Date.now(),
        activatedGameTime: step.activated_game_time as number | undefined,
        deadlineGameTime: step.deadline_game_time as number | undefined,
        windowSeconds: (step.window_s as number) || 30,
        stepType: 'active',
      }))

      const cookingWaitSteps: CookingWaitStep[] = waitStepsRaw.map((step) => ({
        dishId: step.dish as DishId,
        stepIndex: step.step_index as number,
        stepLabel: step.label as string,
        stepDescription: (step.description as string) || '',
        station: step.station as CookingWaitStep['station'],
        startedAt: Date.now(),
        startedGameTime: step.started_game_time as number | undefined,
        durationS: (step.wait_duration_s as number) || 60,
      }))

      const score = { correct: 0, wrong: 0, missed: 0 }
      for (const dish of Object.values(dishes)) {
        for (const result of dish.stepResults) {
          if (result.result === 'correct') score.correct++
          else if (result.result === 'wrong') score.wrong++
          else score.missed++
        }
      }

      const clock = state.clock as { game_clock?: string; game_time_s?: number; frozen?: boolean } | undefined
      return {
        dishes,
        activeCookingSteps,
        cookingWaitSteps,
        cookingFinishedWaitSteps: [],
        cookingScore: score,
        gameClock: clock?.game_clock ?? s.gameClock,
        elapsedSeconds: clock?.game_time_s ?? s.elapsedSeconds,
        gameTimeFrozen: clock?.frozen ?? s.gameTimeFrozen,
      }
    }),

    totalScore: () => get().kitchenScore + get().diningScore,
  }
})
