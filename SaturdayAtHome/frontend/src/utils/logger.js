/**
 * Structured frontend logger for action monitoring.
 * Usage:
 *   import { createLogger } from '../utils/logger'
 *   const log = createLogger('GameStore')
 *   log.info('steak_spawn', { hobId: 0 })
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV

export function createLogger(module) {
  const fmt = (action) => {
    const ts = new Date().toISOString().substring(11, 23)
    return `[${ts}] [${module}] ${action}`
  }

  return {
    info: (action, data) => isDev && console.log(fmt(action), data ?? ''),
    warn: (action, data) => console.warn(fmt(action), data ?? ''),
    error: (action, data) => console.error(fmt(action), data ?? ''),
  }
}
