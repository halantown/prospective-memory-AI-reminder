import type {
  Phase, RoomId, Pan, PhoneMessage, RobotState, SessionData,
  ActivePMTrial, DiningPhase, SeatState, UtensilType,
  DishId, DishState, KitchenStationId, Contact,
  ActiveCookingStep, CookingWaitStep,
  TaskOrder, PMPipelineState, PMPipelineStep,
  CookingDefinitions,
} from '../../types'

export interface SessionSlice {
  sessionId: string | null
  participantId: string | null
  condition: string | null
  phase: Phase
  currentRoom: RoomId
  previousRoom: RoomId | null
  avatarMoving: boolean

  setPhase: (phase: Phase) => void
  setCurrentRoom: (room: RoomId) => void
  setAvatarMoving: (moving: boolean) => void
}

export interface CookingSlice {
  pans: Pan[]
  kitchenScore: number
  cookingDefinitions: CookingDefinitions | null
  cookingDishOrder: DishId[]
  dishes: Record<DishId, DishState>
  activeStation: KitchenStationId | null
  activeCookingSteps: ActiveCookingStep[]
  missedStepFlashes: { dishId: string; stepIndex: number; stepLabel: string; emoji: string }[]
  cookingStepFeedback: { dishId: DishId; stepIndex: number; result: 'correct' | 'wrong'; station: KitchenStationId; timestamp: number } | null
  cookingWaitSteps: CookingWaitStep[]
  cookingScore: { correct: number; wrong: number; missed: number }
  diningPhase: DiningPhase
  diningSeats: SeatState[]
  diningSelectedUtensil: UtensilType | null
  diningRound: number
  diningScore: number

  setPans: (pans: Pan[]) => void
  updatePan: (panId: number, update: Partial<Pan>) => void
  addKitchenScore: (points: number) => void
  initializeCookingDefinitions: (definitions: CookingDefinitions) => void
  setActiveStation: (station: KitchenStationId | null) => void
  advanceDishStep: (dishId: DishId) => void
  setDishStepReady: (dishId: DishId, ready: boolean) => void
  setDishPhase: (dishId: DishId, phase: DishState['phase']) => void
  handleCookingStepActivate: (data: Record<string, unknown>) => void
  handleCookingStepResult: (data: Record<string, unknown>) => void
  handleCookingStepTimeout: (data: Record<string, unknown>) => void
  handleCookingWaitStart: (data: Record<string, unknown>) => void
  handleCookingWaitEnd: (data: Record<string, unknown>) => void
  clearCookingStepFeedback: () => void
  getActiveStepForStation: (station: KitchenStationId) => ActiveCookingStep | undefined
  setDiningPhase: (phase: DiningPhase) => void
  selectUtensil: (utensil: UtensilType | null) => void
  placeUtensil: (seatIndex: number) => boolean
  completeDiningRound: () => void
  addDiningScore: (points: number) => void
  handleOngoingTaskEvent: (data: Record<string, unknown>) => void
}

export interface PhoneSlice {
  phoneMessages: PhoneMessage[]
  phoneLocked: boolean
  phoneLastActivity: number
  phoneBanner: PhoneMessage | null
  contacts: Contact[]
  activeContactId: string | null
  activePhoneTab: 'chats' | 'recipe'
  recipeTabBounce: boolean
  phoneTabPrompt: 'chats' | 'recipe' | null
  lockSystemNotifications: Array<{ id: string; sender: string; text: string; timestamp: number }>

  addPhoneMessage: (msg: PhoneMessage) => void
  setPhoneLocked: (locked: boolean) => void
  markMessageRead: (id: string) => void
  markContactMessagesRead: (contactId: string) => void
  answerPhoneMessage: (messageId: string, chosenText: string, isCorrect: boolean) => void
  showMessageFeedback: (messageId: string) => void
  expirePhoneMessage: (id: string) => void
  removePhoneMessage: (id: string) => void
  setPhoneBanner: (msg: PhoneMessage | null) => void
  setContacts: (contacts: Contact[]) => void
  setActiveContactId: (id: string | null) => void
  setActivePhoneTab: (tab: 'chats' | 'recipe') => void
  setRecipeTabBounce: (bounce: boolean) => void
  setPhoneTabPrompt: (tab: 'chats' | 'recipe' | null) => void
  addLockSystemNotification: (notif: { id: string; sender: string; text: string; timestamp: number }) => void
}

export interface PMSlice {
  robot: RobotState
  activePMTrials: ActivePMTrial[]
  completedPMTrialIds: Set<string>
  pmTargetSelected: string | null
  pmActionPhase: 'idle' | 'target_select' | 'action_confirm' | 'completed'
  taskOrder: TaskOrder | null
  isTest: boolean
  currentPhase: string
  pmPipelineState: PMPipelineState | null
  gameTimeFrozen: boolean
  cutsceneTaskIndex: number
  cutsceneSegmentIndex: number

  setRobotSpeaking: (text: string) => void
  clearRobotSpeech: () => void
  setRobotRoom: (room: RoomId) => void
  addPMTrial: (trial: ActivePMTrial) => void
  completePMTrial: (triggerId: string) => void
  setPMTargetSelected: (target: string | null) => void
  setPMActionPhase: (phase: 'idle' | 'target_select' | 'action_confirm' | 'completed') => void
  setTaskOrder: (order: TaskOrder) => void
  setIsTest: (isTest: boolean) => void
  setPMPipelineState: (state: PMPipelineState | null) => void
  advancePMPipelineStep: (step: PMPipelineStep) => void
  setGameTimeFrozen: (frozen: boolean) => void
  setCutsceneTaskIndex: (i: number) => void
  setCutsceneSegmentIndex: (i: number) => void
  getActivePMForRoom: (room: RoomId) => ActivePMTrial | undefined
  hasActivePMTrigger: () => boolean
}

export interface UISlice {
  visitors: string[]
  activeTriggerEffects: Array<{ triggerEvent: string; timestamp: number; isFake?: boolean; duration?: number }>
  gameClock: string
  elapsedSeconds: number
  blockError: string | null
  wsConnected: boolean
  wsSend: ((msg: Record<string, unknown>) => void) | null

  addVisitor: (name: string) => void
  addTriggerEffect: (triggerEvent: string, opts?: { isFake?: boolean; duration?: number }) => void
  clearTriggerEffect: (triggerEvent: string, timestamp?: number) => void
  setGameClock: (clock: string) => void
  setElapsedSeconds: (s: number) => void
  setBlockError: (msg: string) => void
  setWsConnected: (connected: boolean) => void
  setWsSend: (fn: ((msg: Record<string, unknown>) => void) | null) => void
}

export interface CrossSlice {
  setSession: (data: SessionData) => void
  resetBlock: () => void
  totalScore: () => number
}

export type GameState = SessionSlice & CookingSlice & PhoneSlice & PMSlice & UISlice & CrossSlice
