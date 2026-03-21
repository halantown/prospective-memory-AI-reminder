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

export type RoomId = 'kitchen' | 'dining' | 'living_room' | 'study' | 'balcony'

export interface RoomConfig {
  id: RoomId
  label: string
  x: number
  y: number
  width: number
  height: number
}

// ── PM Tasks ──

export interface PMEncodingCard {
  trial_number: number
  trigger_description: string
  target_room: string
  target_description: string
  target_image: string
  action_description: string
  visual_cues: Record<string, string | number>
}

export interface BlockEncoding {
  block_number: number
  condition: string
  day_story: string
  pm_tasks: PMEncodingCard[]
}

export interface PMTaskConfig {
  task_id: string
  trigger_event: string
  target_room: string
  target_object: string
  target_action: string
  distractor_object: string
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

export type SteakState = 'empty' | 'raw' | 'cooking' | 'ready_to_flip' | 'cooking_side2' | 'ready_to_plate' | 'done' | 'burnt'

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

