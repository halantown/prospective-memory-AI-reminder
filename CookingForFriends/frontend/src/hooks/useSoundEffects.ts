/**
 * Centralized sound effects for game actions.
 * Uses Web Audio API with synthesized tones — no external audio files needed.
 */

import { useCallback, useRef } from 'react'

/* ── Audio context singleton ─────────────────────────────── */

let _audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}

/* ── Low-level helpers ───────────────────────────────────── */

interface ToneOpts {
  freq: number
  duration: number
  type?: OscillatorType
  gain?: number
  startOffset?: number
}

function playTone({ freq, duration, type = 'sine', gain: vol = 0.12, startOffset = 0 }: ToneOpts) {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = freq
  osc.type = type
  const t = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

function playNoise(duration: number, vol = 0.06, startOffset = 0) {
  const ctx = getCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const gain = ctx.createGain()
  src.connect(gain)
  gain.connect(ctx.destination)
  const t = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  src.start(t)
  src.stop(t + duration + 0.02)
}

/* ── Sound effect definitions ────────────────────────────── */

/** Sizzle — short noise burst for placing steak / flipping */
function sizzle() {
  playNoise(0.35, 0.1)
  playTone({ freq: 200, duration: 0.2, type: 'sawtooth', gain: 0.04 })
}

/** Plate ding — cheerful rising two-tone */
function plateDing() {
  playTone({ freq: 784, duration: 0.15 })          // G5
  playTone({ freq: 1047, duration: 0.25, startOffset: 0.12 }) // C6
}

/** Burn buzz — low harsh tone */
function burnBuzz() {
  playTone({ freq: 150, duration: 0.4, type: 'sawtooth', gain: 0.1 })
  playTone({ freq: 155, duration: 0.4, type: 'square', gain: 0.05 })
}

/** PM item select — soft click */
function pmSelect() {
  playTone({ freq: 600, duration: 0.08, type: 'triangle' })
}

/** PM item confirm — positive chime */
function pmConfirm() {
  playTone({ freq: 880, duration: 0.12 })           // A5
  playTone({ freq: 1175, duration: 0.18, startOffset: 0.1 }) // D6
}

/** Table setting complete — success fanfare */
function tableComplete() {
  playTone({ freq: 523, duration: 0.12 })            // C5
  playTone({ freq: 659, duration: 0.12, startOffset: 0.1 }) // E5
  playTone({ freq: 784, duration: 0.12, startOffset: 0.2 }) // G5
  playTone({ freq: 1047, duration: 0.3, startOffset: 0.3 })  // C6
}

/** Phone message — notification blip */
function phoneMessage() {
  playTone({ freq: 1200, duration: 0.08, type: 'triangle' })
  playTone({ freq: 1400, duration: 0.1, type: 'triangle', startOffset: 0.1 })
}

/** Ash crumble — quiet low noise */
function ashCrumble() {
  playNoise(0.25, 0.04)
}

/* ── Hook ────────────────────────────────────────────────── */

export type SoundName =
  | 'sizzle'
  | 'plateDing'
  | 'burnBuzz'
  | 'pmSelect'
  | 'pmConfirm'
  | 'tableComplete'
  | 'phoneMessage'
  | 'ashCrumble'

const SOUND_MAP: Record<SoundName, () => void> = {
  sizzle,
  plateDing,
  burnBuzz,
  pmSelect,
  pmConfirm,
  tableComplete,
  phoneMessage,
  ashCrumble,
}

/**
 * Returns a stable `play` callback. Usage:
 * ```ts
 * const play = useSoundEffects()
 * play('sizzle')
 * ```
 */
export function useSoundEffects() {
  const mapRef = useRef(SOUND_MAP)
  return useCallback((name: SoundName) => {
    try {
      mapRef.current[name]()
    } catch {
      // Audio API unavailable — silent fallback
    }
  }, [])
}
