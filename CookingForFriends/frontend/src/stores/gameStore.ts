/** Global game store — Zustand (composed from domain slices). */

import { create } from 'zustand'
import type { TaskOrder, CookingDefinitions } from '../types'
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
      cookingScore: { correct: 0, wrong: 0, missed: 0 },
      diningPhase: 'idle' as const,
      diningSeats: [{ ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }],
      diningSelectedUtensil: null,
      diningRound: 0,
      diningScore: 0,
      visitors: [],
      phoneMessages: [],
      phoneNotifications: [],
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

    totalScore: () => get().kitchenScore + get().diningScore,
  }
})
