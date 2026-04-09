/** Core type definitions for Cooking for Friends experiment platform. */

// ── Session & Experiment ──

export type Condition = 'CONTROL' | 'AF' | 'AFCB'
export type Phase =
  | 'welcome'
  | 'onboarding'
  | 'encoding'
  | 'playing'
  | 'microbreak'
  | 'block_end'
  | 'debrief'
  | 'complete'

export interface SessionData {
  session_id: string
  participant_id: string
  group: string
  condition_order: Condition[]
  current_block: number
}

// ── Rooms ──

export type RoomId = 'kitchen' | 'dining_room' | 'living_room' | 'study' | 'bathroom' | 'hallway'

export interface RoomConfig {
  id: RoomId
  label: string
  x: number
  y: number
  width: number
  height: number
}

// ── Cooking ──

export type DishId = 'spaghetti' | 'steak' | 'tomato_soup' | 'roasted_vegetables'

export type KitchenStationId =
  | 'fridge'
  | 'cutting_board'
  | 'spice_rack'
  | 'burner1'
  | 'burner2'
  | 'burner3'
  | 'oven'
  | 'plating_area'

export interface CookingStep {
  id: string
  label: string
  station: KitchenStationId
  description: string
}

export type DishPhase = 'idle' | 'prep' | 'cooking' | 'waiting' | 'ready' | 'plated' | 'served'

export interface DishState {
  id: DishId
  label: string
  emoji: string
  phase: DishPhase
  currentStepIndex: number
  steps: CookingStep[]
  /** Whether the next step can be performed (backend may gate transitions) */
  stepReady: boolean
  startedAt: number | null
  completedAt: number | null
}

// ── PM Tasks ──

export interface EncodingCardData {
  trigger_description: string
  target_room: string
  target_description: string
  target_image: string
  action_description: string
  encoding_text: string
  visual_cues: {
    target: string
    distractor: string
    cue: string
  }
  quiz_question: string
  quiz_options: string[]
  quiz_correct_index: number
}

export interface PMEncodingCard {
  trial_number: number
  encoding_card: EncodingCardData
  task_config: PMTaskConfig
}

export interface BlockEncoding {
  block_number: number
  condition: string
  day_story: string
  cards: PMEncodingCard[]
}

export interface PMTaskConfig {
  task_id: string
  trigger_event?: string
  trigger_type?: string
  target_room: string
  target_object?: string
  target_action?: string
  distractor_object?: string
  action_destination?: string
  discriminating_cue?: string
}

export interface ActivePMTrial {
  triggerId: string
  triggerEvent: string
  serverTriggerTs: number
  receivedAt: number
  taskConfig: PMTaskConfig
}

export interface PMTargetItem {
  id: string
  label: string
  emoji: string
  description: string
  position: { x: string; y: string }
}

// ── WebSocket Messages ──

export interface ServerMessage {
  event: string
  data: Record<string, unknown>
  server_ts: number
}

export interface ClientMessage {
  type: string
  data: Record<string, unknown>
}

// ── Kitchen / Ongoing Tasks ──

export type SteakState = 'empty' | 'raw' | 'cooking' | 'ready_to_flip' | 'cooking_side2' | 'ready_to_plate' | 'done' | 'burnt' | 'ash'

// ── Dining ──

export type DiningPhase = 'idle' | 'active'

export type UtensilType = 'plate' | 'knife' | 'fork' | 'glass'

export interface SeatState {
  plate: boolean
  knife: boolean
  fork: boolean
  glass: boolean
}

export interface DiningState {
  currentRound: number
  seats: SeatState[]
  selectedUtensil: UtensilType | null
  totalCompleted: number
}

export interface Pan {
  id: number
  state: SteakState
  timer: number | null
  placedAt: number | null
}

// ── Phone ──

export interface Contact {
  id: string
  name: string
  avatar: string  // emoji
}

export interface PhoneMessage {
  id: string
  text: string
  channel: 'chat' | 'notification'
  // Chat-specific fields (channel === 'chat')
  contactId?: string
  correctChoice?: string
  wrongChoice?: string
  correctPosition?: number | null  // null = frontend randomizes, 0|1 = forced
  feedbackCorrect?: string
  feedbackIncorrect?: string
  // Notification-specific fields (channel === 'notification')
  sender?: string
  // State tracking
  timestamp: number
  read: boolean
  answered: boolean
  answeredCorrect?: boolean
  feedbackVisible?: boolean   // true after feedback delay has elapsed
  respondedAt?: number
  userChoice?: string  // the actual text the participant chose
}

/** @deprecated Use PhoneMessage instead — kept for backward compat with old phone_notification events */
export interface PhoneNotification {
  id: string
  sender: string
  preview: string
  is_ad: boolean
  timestamp: number
  read: boolean
}

// ── Robot ──

export interface RobotState {
  room: RoomId
  speaking: boolean
  text: string
  visible: boolean
}

// ── NASA-TLX ──

export interface NasaTLX {
  mental_demand: number
  effort: number
  frustration: number
}

// ── Quiz ──

export interface QuizQuestion {
  trialNumber: number
  questionType: 'trigger' | 'target' | 'action'
  question: string
  options: string[]
  correctAnswer: string
}

