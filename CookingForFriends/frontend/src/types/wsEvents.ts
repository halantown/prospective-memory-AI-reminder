import type { DecoyOption } from '.'

interface BlockStartEvent {
  event: 'block_start'
  data: Record<string, unknown>
}

interface TimeTickEvent {
  event: 'time_tick'
  data: { game_clock?: string; elapsed?: number; frozen?: boolean }
}

interface RobotSpeakEvent {
  event: 'robot_speak'
  data: { text: string }
}

interface RobotIdleCommentEvent {
  event: 'robot_idle_comment'
  data: { text: string; comment_id: string }
}

interface RobotMoveEvent {
  event: 'robot_move'
  data: { to_room: string }
}

interface PMTriggerEvent {
  event: 'pm_trigger'
  data: {
    is_fake?: boolean
    task_id?: string
    trigger_type?: 'doorbell' | 'phone_call'
    position?: number
    schedule_index?: number
    condition?: 'EE1' | 'EE0'
    guest_name?: string
    reminder_text?: string
    greeting_lines?: string[]
    fake_resolution_lines?: string[]
    item_options?: DecoyOption[]
  }
}

interface AvatarActionEvent {
  event: 'avatar_action'
  data: Record<string, unknown>
}

interface SessionEndEvent {
  event: 'session_end'
  data: { next_phase?: string; reason?: string }
}

interface HeartbeatAckEvent {
  event: 'heartbeat_ack'
  data: { frozen?: boolean }
}

interface PhoneContactsEvent {
  event: 'phone_contacts'
  data: { contacts?: Array<{ id: string; name: string; avatar: string }> }
}

interface PhoneMessageEvent {
  event: 'phone_message'
  data: {
    id: string
    text: string
    channel?: string
    contact_id?: string
    sender?: string
    correct_choice?: string
    wrong_choice?: string
    correct_position?: number | null
    feedback_correct?: string
    feedback_incorrect?: string
  }
}

interface BlockEndEvent {
  event: 'block_end'
  data: Record<string, unknown>
}

interface BlockErrorEvent {
  event: 'block_error'
  data: { message?: string }
}

interface PMReceivedEvent {
  event: 'pm_received'
  data: Record<string, unknown>
}

interface OngoingTaskEvent {
  event: 'ongoing_task_event'
  data: Record<string, unknown>
}

interface ForceSyncEvent {
  event: 'force_sync'
  data: Record<string, unknown>
}

interface KeepaliveEvent {
  event: 'keepalive'
  data: Record<string, unknown>
}

export type WSServerEvent =
  | BlockStartEvent
  | TimeTickEvent
  | RobotSpeakEvent
  | RobotIdleCommentEvent
  | RobotMoveEvent
  | PMTriggerEvent
  | AvatarActionEvent
  | SessionEndEvent
  | HeartbeatAckEvent
  | PhoneContactsEvent
  | PhoneMessageEvent
  | BlockEndEvent
  | BlockErrorEvent
  | PMReceivedEvent
  | OngoingTaskEvent
  | ForceSyncEvent
  | KeepaliveEvent
