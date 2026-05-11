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
  tutorialActionLabel?: string
  tutorialRobotLine?: string
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
      { id: 'target', label: 'Baking book', isTarget: true },
      { id: 'intra1', label: 'Cookbook', isTarget: false },
      { id: 'intra2', label: 'Novel', isTarget: false },
    ],
    correctItem: 'target',
  },
  T2: {
    id: 'pm_sophia',
    taskId: 'T2',
    type: 'doorbell',
    isPM: true,
    npcId: 'sophia',
    npcName: 'Sophia',
    greetingDialogue: [
      { speaker: 'Sophia', text: 'Hi! Thanks for inviting me tonight.', bubblePosition: 'right' },
      { speaker: 'Avatar', text: 'I am glad you could make it.', bubblePosition: 'left' },
      { speaker: 'Sophia', text: 'I came straight from campus, so I am ready for dinner.', bubblePosition: 'right' },
    ],
    reminderEC1: 'By the way, remember what Anna asked you to pass along after her trip.',
    reminderEC0: 'By the way, remember you promised to give Sophia something.',
    itemOptions: [
      { id: 'target', label: 'Chocolate', isTarget: true },
      { id: 'intra1', label: 'Cookies', isTarget: false },
      { id: 'intra2', label: 'Candy', isTarget: false },
    ],
    correctItem: 'target',
  },
  T3: {
    id: 'pm_benjamin',
    taskId: 'T3',
    type: 'phone',
    isPM: true,
    npcId: 'benjamin',
    npcName: 'Benjamin',
    greetingDialogue: [
      { speaker: 'Benjamin', text: 'Hey! I am on my way and should be there soon.', bubblePosition: 'phone' },
      { speaker: 'Avatar', text: 'Great, see you soon.', bubblePosition: 'left' },
      { speaker: 'Benjamin', text: "Can't wait, I am starving.", bubblePosition: 'phone' },
    ],
    reminderEC1: 'By the way, remember what came up when you and Benjamin were camping.',
    reminderEC0: 'By the way, remember you promised to do something for Benjamin.',
    itemOptions: [
      { id: 'target', label: 'Apple juice', isTarget: true },
      { id: 'intra1', label: 'Orange juice', isTarget: false },
      { id: 'intra2', label: 'Iced tea', isTarget: false },
    ],
    correctItem: 'target',
  },
  T4: {
    id: 'pm_courier',
    taskId: 'T4',
    type: 'phone',
    isPM: true,
    npcId: 'courier',
    npcName: 'Courier',
    greetingDialogue: [
      { speaker: 'Courier', text: 'Hello, I am confirming your delivery order.', bubblePosition: 'phone' },
      { speaker: 'Avatar', text: 'Thanks for calling.', bubblePosition: 'left' },
      { speaker: 'Courier', text: 'I can still add something if you need it.', bubblePosition: 'phone' },
    ],
    reminderEC1: 'By the way, remember what you noticed this morning while changing the decorative light batteries.',
    reminderEC0: 'By the way, remember you wanted to add something to your delivery order.',
    itemOptions: [
      { id: 'target', label: '垃圾袋', isTarget: true },
      { id: 'intra1', label: '旧电池', isTarget: false },
      { id: 'intra2', label: '纸箱', isTarget: false },
    ],
    correctItem: 'target',
  },
  fake_doorbell: {
    id: 'fake_courier_doorbell',
    type: 'doorbell',
    isPM: false,
    npcId: 'courier',
    npcName: 'Courier',
    greetingDialogue: [
      { speaker: 'Courier', text: 'Hi, quick delivery check.', bubblePosition: 'right' },
      { speaker: 'Avatar', text: 'Sure, what do you need?', bubblePosition: 'left' },
    ],
    fakeDialogue: [
      { speaker: 'Courier', text: 'Could you sign for this small package?', bubblePosition: 'right' },
    ],
    fakeActionLabel: 'Sign for the package',
  },
  fake_phone_call: {
    id: 'fake_phone_call',
    type: 'phone',
    isPM: false,
    npcId: 'courier',
    npcName: 'Courier',
    greetingDialogue: [
      { speaker: 'Courier', text: 'Hi, I am checking that I have the right number.', bubblePosition: 'phone' },
      { speaker: 'Avatar', text: 'Yes, this is me.', bubblePosition: 'left' },
    ],
    fakeDialogue: [
      { speaker: 'Courier', text: 'That is all I needed. Thanks!', bubblePosition: 'phone' },
    ],
    fakeActionLabel: 'End the call',
  },
  tutorial_sam: {
    id: 'tutorial_sam',
    type: 'doorbell',
    isPM: false,
    npcId: 'sam_tutorial',
    npcName: 'Sam',
    greetingDialogue: [
      { speaker: 'Sam', text: 'Hi! I am here to pick something up.', bubblePosition: 'right' },
      { speaker: 'Avatar', text: 'Right, come in for a second.', bubblePosition: 'left' },
    ],
    tutorialRobotLine: 'Sam is here to pick something up.',
    tutorialActionLabel: 'Give Sam the newspaper',
  },
}

export function getTriggerEncounterConfig(taskId: string | null | undefined) {
  if (!taskId) return null
  return TRIGGER_ENCOUNTERS[taskId] ?? null
}

export function getActiveTriggerEncounterConfig({
  taskId,
  triggerType,
  isFake,
}: {
  taskId: string | null | undefined
  triggerType?: 'doorbell' | 'phone_call'
  isFake?: boolean
}) {
  if (isFake) {
    return triggerType === 'phone_call'
      ? TRIGGER_ENCOUNTERS.fake_phone_call
      : TRIGGER_ENCOUNTERS.fake_doorbell
  }
  return getTriggerEncounterConfig(taskId)
}

export function getEncounterReminder(config: TriggerEncounterConfig, condition: Condition | string | null | undefined) {
  return condition === 'EE1'
    ? config.reminderEC1 ?? config.reminderEC0
    : config.reminderEC0 ?? config.reminderEC1
}
