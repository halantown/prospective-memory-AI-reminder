/** Trigger encounter dialogue/configuration.
 *
 * "Cutscene" is reserved for encoding/tutorial videos. Gameplay doorbell and
 * phone moments use trigger encounters.
 */

import type { Condition, DecoyOption } from '../types'

export type EncounterTriggerType = 'doorbell' | 'phone'
export type BubblePosition = 'left' | 'right' | 'robot' | 'phone'

export interface DialogueLine {
  speaker: string
  text: string
  bubblePosition: BubblePosition
}

export interface TriggerEncounterConfig {
  id: string
  taskId?: string
  type: EncounterTriggerType
  isPM: boolean
  npcId: string
  npcName: string
  greetingDialogue: DialogueLine[]
  reminderEC0?: string
  reminderEC1?: string
  itemOptions?: DecoyOption[]
  correctItem?: string
  fakeActionLabel?: string
  fakeDialogue?: DialogueLine[]
}

export const TRIGGER_ENCOUNTERS: Record<string, TriggerEncounterConfig> = {
  T1: {
    id: 'pm_mei',
    taskId: 'T1',
    type: 'doorbell',
    isPM: true,
    npcId: 'mei',
    npcName: 'Mei',
    greetingDialogue: [
      { speaker: 'Mei', text: 'Hey! Thanks for having me over!', bubblePosition: 'right' },
      { speaker: 'Avatar', text: 'Of course! Come on in.', bubblePosition: 'left' },
      { speaker: 'Mei', text: 'Something smells amazing in the kitchen!', bubblePosition: 'right' },
      { speaker: 'Avatar', text: "Haha, I'm trying my best.", bubblePosition: 'left' },
    ],
    reminderEC1: 'By the way, remember what came up when you and Mei played games and ate dessert.',
    reminderEC0: 'By the way, remember you promised to give Mei something.',
    itemOptions: [
      { id: 'target', label: '烘焙书', isTarget: true },
      { id: 'intra1', label: '游戏手柄', isTarget: false },
      { id: 'intra2', label: '蛋糕盒子', isTarget: false },
    ],
    correctItem: 'target',
  },
}

export function getTriggerEncounterConfig(taskId: string | null | undefined) {
  if (!taskId) return null
  return TRIGGER_ENCOUNTERS[taskId] ?? null
}

export function getEncounterReminder(config: TriggerEncounterConfig, condition: Condition | string | null | undefined) {
  return condition === 'EE1'
    ? config.reminderEC1 ?? config.reminderEC0
    : config.reminderEC0 ?? config.reminderEC1
}
