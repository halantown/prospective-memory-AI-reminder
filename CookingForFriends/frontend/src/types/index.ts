/** Core type definitions for Cooking for Friends experiment platform. */

// ── Session & Experiment ──

export type Condition = 'EE1' | 'EE0'

export type ExperimentPhase =
  | 'TOKEN_INPUT'
  | 'WELCOME'
  | 'CONSENT'
  | 'DEMOGRAPHICS'
  | 'MSE_PRE'
  | 'STORY_INTRO'
  | 'ENCODING_VIDEO_1'
  | 'MANIP_CHECK_1'
  | 'ASSIGN_1'
  | 'ENCODING_VIDEO_2'
  | 'MANIP_CHECK_2'
  | 'ASSIGN_2'
  | 'ENCODING_VIDEO_3'
  | 'MANIP_CHECK_3'
  | 'ASSIGN_3'
  | 'ENCODING_VIDEO_4'
  | 'MANIP_CHECK_4'
  | 'ASSIGN_4'
  | 'RECAP'
  | 'TUTORIAL_PHONE'
  | 'TUTORIAL_COOKING'
  | 'TUTORIAL_TRIGGER'
  | 'EVENING_TRANSITION'
  | 'MAIN_EXPERIMENT'
  | 'POST_MANIP_CHECK'
  | 'POST_SUBJECTIVE_DV'
  | 'POST_NASA_TLX'
  | 'POST_MSE'
  | 'POST_RETRO_CHECK'
  | 'DEBRIEF'
  | 'COMPLETED'

export type UIPhase = 'welcome' | 'session_transition' | 'complete'

export type Phase = UIPhase | ExperimentPhase

export type TaskOrder = 'A' | 'B' | 'C' | 'D'

export interface ExperimentConfig {
  phase: ExperimentPhase | string
  condition: Condition | string
  task_order: TaskOrder | string
  [key: string]: unknown
}

export interface ExperimentResponseInput {
  phase?: ExperimentPhase | string
  question_id: string
  response_type: 'integer' | 'text' | 'choice' | 'scale' | 'boolean' | 'object' | string
  value: unknown
  timestamp?: number
  metadata?: Record<string, unknown>
}

export type PMPipelineStep =
  | 'idle'
  | 'trigger_event'
  | 'greeting'
  | 'reminder'
  | 'item_selection'
  | 'confidence_rating'
  | 'auto_execute'
  | 'fake_resolution'
  | 'direct_request'
  | 'completed'

export interface PMPipelineState {
  step: PMPipelineStep
  taskId: string | null         // null for fake triggers
  triggerType: 'doorbell' | 'phone_call'
  isFake: boolean
  taskPosition: number | null   // 1-4 for real, null for fake
  scheduleIndex: number
  firedAt: number               // client-side Date.now()/1000
  wasInterrupted: boolean
  condition?: Condition
  guestName?: string
  reminderText?: string
  greetingLines?: string[]
  fakeResolutionLines?: string[]
  itemOptions?: DecoyOption[]
  triggerRespondedAt?: number | null
  triggerTimedOut?: boolean
  triggerTimeoutStage?: 0 | 1 | 2
}

export interface DecoyOption {
  id: string
  label: string
  isTarget: boolean
}

export interface CutsceneSegment {
  taskId: string
  segmentIndex: number   // 0-3
  placeholder: string    // placeholder constant string
}

export interface SessionData {
  session_id: string
  participant_id: string
  token?: string
  condition: string
  task_order?: string
  is_test?: boolean
  current_phase?: string
  cooking_definitions?: CookingDefinitions
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
  stepType: 'active' | 'wait'
  waitDurationS: number
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
  /** Results for completed steps */
  stepResults: CookingStepResult[]
}

// ── Cooking: Backend-driven distractor system ──

export interface CookingStepOption {
  id: string
  text: string
}

export interface CookingDefinitionStep {
  id: string
  label: string
  station: KitchenStationId
  description: string
  step_type: 'active' | 'wait'
  wait_duration_s: number
}

export interface CookingDefinitionDish {
  id: DishId
  label: string
  emoji: string
  steps: CookingDefinitionStep[]
}

export interface CookingTimelineDefinitionEntry {
  t: number
  dish: DishId
  step_index: number
  step_type: 'active' | 'wait'
}

export interface CookingDefinitions {
  recipe_version: string
  dish_order: DishId[]
  dishes: Record<DishId, CookingDefinitionDish>
  timeline: CookingTimelineDefinitionEntry[]
}

export type CookingStepResultType = 'correct' | 'wrong' | 'missed'

export interface CookingStepResult {
  dishId: DishId
  stepIndex: number
  result: CookingStepResultType
  chosenOptionId?: string
  responseTimeMs?: number
}

export interface ActiveCookingStep {
  dishId: DishId
  stepIndex: number
  stepLabel: string
  stepDescription: string
  station: KitchenStationId
  options: CookingStepOption[]
  activatedAt: number
  activatedGameTime?: number
  deadlineGameTime?: number
  windowSeconds: number
  stepType: 'active' | 'wait'
  waitDurationS?: number
}

export interface CookingWaitStep {
  dishId: DishId
  stepIndex: number
  stepLabel: string
  stepDescription: string
  station: KitchenStationId
  startedAt: number
  startedGameTime?: number
  durationS: number
}

export interface CookingFinishedWaitStep {
  dishId: DishId
  stepIndex: number
  stepLabel: string
  stepDescription: string
  station: KitchenStationId
  finishedAt: number
}

export interface KitchenTimerBannerItem {
  id: string
  icon: string
  message: string
  appearedAt: number
  dishId?: DishId
  stepIndex?: number
  station?: KitchenStationId
  status?: 'active' | 'warning'
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
  feedbackMissed?: string
  // Notification-specific fields (channel === 'notification')
  sender?: string
  // State tracking
  timestamp: number
  read: boolean
  answered: boolean
  answeredCorrect?: boolean
  expired?: boolean            // true when reply window expired
  feedbackVisible?: boolean   // true after feedback delay has elapsed
  respondedAt?: number
  expiredAt?: number
  userChoice?: string  // the actual text the participant chose
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
