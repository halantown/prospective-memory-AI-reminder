/**
 * PM Task configurations for the experiment.
 * NOTE: correct answers are NOT stored here — they stay backend-only
 * to prevent participants from inspecting via DevTools.
 *
 * These are defaults. When remote config is loaded, the store's remoteConfig
 * takes priority.
 */

export const MEDICINE_TASKS = {
  medicine_a: {
    prompt: 'Take your prescribed medicine',
    bottles: [
      { id: 'round_red',  label: 'Red round bottle',  shape: 'round',  color: '#e57373' },
      { id: 'square_red', label: 'Red square bottle', shape: 'square', color: '#ef5350' },
    ],
    amounts: ['1 tablet', '2 tablets', '3 tablets'],
  },
  medicine_b: {
    prompt: 'Take your vitamin supplement',
    bottles: [
      { id: 'round_orange',  label: 'Orange round bottle',  shape: 'round',  color: '#ffb74d' },
      { id: 'square_orange', label: 'Orange square bottle', shape: 'square', color: '#ffa726' },
    ],
    amounts: ['500mg × 1', '500mg × 2', '1000mg × 1'],
  },
}

// Trigger icon mapping — which kitchen icon triggers each task
export const TRIGGER_ICONS = {
  medicine_a: { icon: '🍽️', label: 'Dinner ready' },
  medicine_b: { icon: '☕', label: 'Coffee done' },
  laundry_c:  { icon: '👕', label: 'Laundry done' },
  laundry_d:  { icon: '🌅', label: 'Getting dark' },
  comm_e:     { icon: '📱', label: 'Friend online' },
  comm_f:     { icon: '🚪', label: 'Doorbell' },
  chores_g:   { icon: '🍲', label: 'Slow cooker' },
  chores_h:   { icon: '🗑️', label: 'Rubbish truck' },
}

/**
 * Merge remote config pm_tasks into MEDICINE_TASKS.
 * Call this after remote config loads.
 */
export function getMedicineConfig(remoteConfig) {
  if (!remoteConfig?.pm_tasks) return MEDICINE_TASKS
  const merged = { ...MEDICINE_TASKS }
  for (const [id, remote] of Object.entries(remoteConfig.pm_tasks)) {
    if (merged[id]) {
      merged[id] = {
        ...merged[id],
        prompt: remote.prompt ?? merged[id].prompt,
        bottles: remote.options ?? merged[id].bottles,
        amounts: remote.amounts ?? merged[id].amounts,
      }
    }
  }
  return merged
}

export function getTriggerIcons(remoteConfig) {
  if (!remoteConfig?.trigger_icons) return TRIGGER_ICONS
  const merged = { ...TRIGGER_ICONS }
  for (const [id, remote] of Object.entries(remoteConfig.trigger_icons)) {
    merged[id] = { icon: remote.icon ?? '❓', label: remote.label ?? id }
  }
  return merged
}
