import type { StateCreator } from 'zustand'
import type { GameState, PhoneSlice } from './types'

export const createPhoneSlice: StateCreator<GameState, [], [], PhoneSlice> = (set) => ({
  phoneMessages: [],
  phoneNotifications: [],
  phoneLocked: false,
  phoneLastActivity: Date.now(),
  phoneBanner: null,
  contacts: [],
  activeContactId: null,
  activePhoneTab: 'chats',
  recipeTabBounce: false,
  phoneTabPrompt: null,
  lockSystemNotifications: [],

  addPhoneMessage: (msg) => set((s) => {
    if (s.phoneMessages.some((m) => m.id === msg.id)) return s
    return { phoneMessages: [...s.phoneMessages, msg] }
  }),

  addPhoneNotification: (notif) => set((s) => ({
    phoneNotifications: [...s.phoneNotifications, notif],
  })),

  setPhoneLocked: (_locked) => set({ phoneLocked: false, phoneLastActivity: Date.now() }),

  markNotificationRead: (id) => set((s) => ({
    phoneNotifications: s.phoneNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
  })),

  markMessageRead: (id) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) =>
      m.id === id ? { ...m, read: true } : m
    ),
  })),

  markContactMessagesRead: (contactId) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) =>
      m.contactId === contactId && !m.read ? { ...m, read: true } : m
    ),
  })),

  answerPhoneMessage: (messageId, chosenText, isCorrect) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) => {
      if (m.id !== messageId || m.answered) return m
      return {
        ...m,
        answered: true,
        answeredCorrect: isCorrect,
        userChoice: chosenText,
        respondedAt: Date.now(),
      }
    }),
  })),

  showMessageFeedback: (messageId) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) =>
      m.id === messageId ? { ...m, feedbackVisible: true } : m
    ),
  })),

  expirePhoneMessage: (_id) => {},

  removePhoneMessage: (id) => set((s) => ({
    phoneMessages: s.phoneMessages.filter((m) => m.id !== id),
  })),

  setPhoneBanner: (msg) => set({ phoneBanner: msg }),
  setContacts: (contacts) => set({ contacts }),
  setActiveContactId: (id) => set({ activeContactId: id }),
  setActivePhoneTab: (tab) => set({ activePhoneTab: tab }),
  setRecipeTabBounce: (bounce) => set({ recipeTabBounce: bounce }),
  setPhoneTabPrompt: (tab) => set({ phoneTabPrompt: tab }),

  addLockSystemNotification: (notif) => set((s) => ({
    lockSystemNotifications: [...s.lockSystemNotifications, notif].slice(-2),
  })),
})
