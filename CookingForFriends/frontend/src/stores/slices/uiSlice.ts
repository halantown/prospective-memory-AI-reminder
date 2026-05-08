import type { StateCreator } from 'zustand'
import type { GameState, UISlice } from './types'

export const createUISlice: StateCreator<GameState, [], [], UISlice> = (set) => ({
  visitors: [],
  activeTriggerEffects: [],
  gameClock: '17:00',
  elapsedSeconds: 0,
  blockError: null,
  wsConnected: false,
  wsSend: null,

  addVisitor: (name) => set((s) => ({
    visitors: s.visitors.includes(name) ? s.visitors : [...s.visitors, name],
  })),

  addTriggerEffect: (triggerEvent, opts) => set((s) => ({
    activeTriggerEffects: [
      ...s.activeTriggerEffects,
      { triggerEvent, timestamp: Date.now(), ...opts },
    ],
  })),

  clearTriggerEffect: (triggerEvent, timestamp) => set((s) => ({
    activeTriggerEffects: s.activeTriggerEffects.filter(e => {
      if (e.triggerEvent !== triggerEvent) return true
      if (timestamp !== undefined) return e.timestamp !== timestamp
      return false
    }),
  })),

  setGameClock: (clock) => set({ gameClock: clock }),
  setElapsedSeconds: (s) => set({ elapsedSeconds: s }),
  setBlockError: (msg) => set({ blockError: msg }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setWsSend: (fn) => set({ wsSend: fn }),
})
