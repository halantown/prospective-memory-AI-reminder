import type { DecoyOption } from '../types'

export const TASK_ORDERS: Record<string, string[]> = {
  A: ['T1','T2','T3','T4'],
  B: ['T2','T4','T1','T3'],
  C: ['T3','T1','T4','T2'],
  D: ['T4','T3','T2','T1'],
}

export const TRIGGER_SCHEDULE = [
  { type: 'real',  delay_after_previous_s: 180, task_position: 1 },
  { type: 'fake',  delay_after_previous_s: 120, trigger_type: 'doorbell' },
  { type: 'real',  delay_after_previous_s: 60,  task_position: 2 },
  { type: 'real',  delay_after_previous_s: 120, task_position: 3 },
  { type: 'fake',  delay_after_previous_s: 60,  trigger_type: 'phone_call' },
  { type: 'real',  delay_after_previous_s: 60,  task_position: 4 },
]

export const SESSION_END_DELAY_AFTER_LAST_TRIGGER_S = 60

export interface PMTaskFrontendDef {
  taskId: string
  guestName: string
  triggerType: 'doorbell' | 'phone_call'
  targetRoom: string | null
  actionType: 'bring_item' | 'take_from_fridge' | 'reply_in_chat'
  greetingLines: string[]
  fakeResolutionLines?: string[]
}

export const PM_TASKS: Record<string, PMTaskFrontendDef> = {
  T1: {
    taskId: 'T1',
    guestName: 'Mei',
    triggerType: 'doorbell',
    targetRoom: 'study',
    actionType: 'bring_item',
    greetingLines: ['Hi! It smells great in here.', 'I am glad I made it before dinner.', 'Good to see you again.'],
  },
  T2: {
    taskId: 'T2',
    guestName: 'Lina',
    triggerType: 'doorbell',
    targetRoom: 'kitchen',
    actionType: 'bring_item',
    greetingLines: ['Hey, thanks for having me.', 'I came straight here after work.', 'I am excited for dinner.'],
  },
  T3: {
    taskId: 'T3',
    guestName: 'Tom',
    triggerType: 'phone_call',
    targetRoom: 'kitchen',
    actionType: 'take_from_fridge',
    greetingLines: ['Hey, I am almost there.', 'I should arrive in a few minutes.', 'See you soon.'],
  },
  T4: {
    taskId: 'T4',
    guestName: 'Delivery',
    triggerType: 'phone_call',
    targetRoom: null,
    actionType: 'reply_in_chat',
    greetingLines: ['Hello, I am confirming your delivery order.', 'Is there anything else you want to add?', 'I can update it now.'],
  },
}

export const DECOY_OPTIONS: Record<string, DecoyOption[]> = {
  T1: [
    { id: 'target',    label: '烘焙书',             isTarget: true },
    { id: 'intra1',    label: '游戏手柄',            isTarget: false },
    { id: 'intra2',    label: '蛋糕盒子',            isTarget: false },
    { id: 'cross1',    label: '礼品袋',              isTarget: false },
    { id: 'cross2',    label: '烧烤架',              isTarget: false },
    { id: 'unrelated', label: '[T1 unrelated TBD]', isTarget: false },
  ],
  T2: [
    { id: 'target',    label: '巧克力',              isTarget: true },
    { id: 'intra1',    label: '礼品袋',              isTarget: false },
    { id: 'intra2',    label: '明信片',              isTarget: false },
    { id: 'cross1',    label: '游戏手柄',            isTarget: false },
    { id: 'cross2',    label: '旧电池',              isTarget: false },
    { id: 'unrelated', label: '[T2 unrelated TBD]', isTarget: false },
  ],
  T3: [
    { id: 'target',    label: '苹果汁',              isTarget: true },
    { id: 'intra1',    label: '烧烤架',              isTarget: false },
    { id: 'intra2',    label: '蓝牙音箱',            isTarget: false },
    { id: 'cross1',    label: '蛋糕盒子',            isTarget: false },
    { id: 'cross2',    label: '纸箱',                isTarget: false },
    { id: 'unrelated', label: '[T3 unrelated TBD]', isTarget: false },
  ],
  T4: [
    { id: 'target',    label: '垃圾袋',              isTarget: true },
    { id: 'intra1',    label: '旧电池',              isTarget: false },
    { id: 'intra2',    label: '纸箱',                isTarget: false },
    { id: 'cross1',    label: '明信片',              isTarget: false },
    { id: 'cross2',    label: '蓝牙音箱',            isTarget: false },
    { id: 'unrelated', label: '[T4 unrelated TBD]', isTarget: false },
  ],
}

export const ITEM_SELECTION_OPTIONS: Record<string, DecoyOption[]> = Object.fromEntries(
  Object.entries(DECOY_OPTIONS).map(([taskId, options]) => [
    taskId,
    options.filter(option => ['target', 'intra1', 'intra2'].includes(option.id)),
  ]),
) as Record<string, DecoyOption[]>

export const FAKE_TRIGGER_LINES: Record<'doorbell' | 'phone_call', string[]> = {
  doorbell: [
    'Hi, I just came to drop this off.',
    'No need to do anything right now.',
    'Enjoy your dinner.',
  ],
  phone_call: [
    'Hi, just confirming I reached the right number.',
    'That is all I needed.',
    'Have a good evening.',
  ],
}
