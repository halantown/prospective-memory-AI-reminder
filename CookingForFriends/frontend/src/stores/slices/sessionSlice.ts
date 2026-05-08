import type { StateCreator } from 'zustand'
import type { GameState, SessionSlice } from './types'

export const createSessionSlice: StateCreator<GameState, [], [], SessionSlice> = (set, get) => ({
  sessionId: null,
  participantId: null,
  condition: null,
  phase: 'welcome',
  currentRoom: 'kitchen',
  previousRoom: null,
  avatarMoving: false,

  setPhase: (phase) => set({ phase }),

  setCurrentRoom: (room) => {
    const prev = get().currentRoom
    set({ currentRoom: room, previousRoom: prev })
    const send = get().wsSend
    if (send) {
      send({
        type: 'room_switch',
        data: { from: prev, to: room, timestamp: Date.now() / 1000 },
      })
    }
  },

  setAvatarMoving: (moving) => set({ avatarMoving: moving }),
})
