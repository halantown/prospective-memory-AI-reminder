/**
 * Centralized sound effects for game actions.
 *
 * Two sources:
 *   1. Synthesized — Web Audio API oscillators/noise. Cheap, no assets.
 *   2. Files — .mp3/.wav loaded via decodeAudioData. For sounds that
 *      synthesis can't fake convincingly (doorbell, phone ring, …).
 *
 * To swap a synthesized sound for a real recording, drop the file in
 * /public/assets/sounds/ and add it to AUDIO_FILES below — the file path
 * takes precedence over the synthesized version.
 */

import { useCallback, useEffect, useRef } from 'react'

/* ── Audio context singleton ─────────────────────────────── */

let _audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}

/* ── File loader (with cache) ────────────────────────────── */

const bufferCache: Map<string, Promise<AudioBuffer>> = new Map()

function loadAudioFile(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url)
  if (cached) return cached
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
      return res.arrayBuffer()
    })
    .then((data) => getCtx().decodeAudioData(data))
  bufferCache.set(url, promise)
  promise.catch(() => bufferCache.delete(url))
  return promise
}

function playBuffer(buffer: AudioBuffer, vol = 0.8) {
  const ctx = getCtx()
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = vol
  src.connect(gain)
  gain.connect(ctx.destination)
  src.start()
}

function playFile(url: string, vol = 0.8) {
  loadAudioFile(url)
    .then((buffer) => playBuffer(buffer, vol))
    .catch((err) => console.warn('[sound] failed to play', url, err))
}

/* ── Low-level synthesis helpers ─────────────────────────── */

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

interface SweepOpts {
  startFreq: number
  endFreq: number
  duration: number
  type?: OscillatorType
  gain?: number
  startOffset?: number
}

function playSweep({ startFreq, endFreq, duration, type = 'sine', gain: vol = 0.1, startOffset = 0 }: SweepOpts) {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  const t = ctx.currentTime + startOffset
  osc.frequency.setValueAtTime(startFreq, t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(0.001, endFreq), t + duration)
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

interface FilteredNoiseOpts {
  duration: number
  vol?: number
  startOffset?: number
  filterType?: BiquadFilterType
  filterFreq?: number
  filterQ?: number
}

function playFilteredNoise({
  duration,
  vol = 0.06,
  startOffset = 0,
  filterType = 'bandpass',
  filterFreq = 800,
  filterQ = 5,
}: FilteredNoiseOpts) {
  const ctx = getCtx()
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq
  filter.Q.value = filterQ
  const gain = ctx.createGain()
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  const t = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  src.start(t)
  src.stop(t + duration + 0.02)
}

/* ── File-backed sounds ──────────────────────────────────── */

const AUDIO_FILES: Partial<Record<SoundName, string>> = {
  doorbell: '/assets/sounds/doorbell.mp3',
  // phoneRing: '/assets/sounds/phone_ring.mp3', // uncomment when asset arrives
}

/* ── Synthesized sound definitions ───────────────────────── */

/** Sizzle — short noise burst for placing steak / flipping */
function sizzle() {
  playFilteredNoise({ duration: 0.45, vol: 0.09, filterType: 'highpass', filterFreq: 3500, filterQ: 0.7 })
  playFilteredNoise({ duration: 0.45, vol: 0.05, filterType: 'bandpass', filterFreq: 1800, filterQ: 1.2, startOffset: 0.02 })
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
  playFilteredNoise({ duration: 0.25, vol: 0.04, filterType: 'lowpass', filterFreq: 400, filterQ: 0.8 })
}

/** Doorbell — synthesized fallback (ding-dong). Replaced by mp3 when present. */
function doorbellSynth() {
  playTone({ freq: 660, duration: 0.5, type: 'sine', gain: 0.18 })
  playTone({ freq: 660 * 0.8, duration: 0.5, type: 'sine', gain: 0.1, startOffset: 0.02 })
  playTone({ freq: 523, duration: 0.6, type: 'sine', gain: 0.18, startOffset: 0.55 })
  playTone({ freq: 523 * 0.8, duration: 0.6, type: 'sine', gain: 0.1, startOffset: 0.57 })
}

/** Phone ring — classic US dual-tone (480Hz + 620Hz), two on/off bursts. */
function phoneRing() {
  for (let i = 0; i < 2; i++) {
    const offset = i * 0.55
    playTone({ freq: 480, duration: 0.4, type: 'sine', gain: 0.09, startOffset: offset })
    playTone({ freq: 620, duration: 0.4, type: 'sine', gain: 0.09, startOffset: offset })
  }
}

/** Footstep — low-pass noise thump */
function footstep() {
  playFilteredNoise({ duration: 0.07, vol: 0.1, filterType: 'lowpass', filterFreq: 350, filterQ: 1 })
}

/** Door open — wooden creak (sweep + filtered noise) */
function doorOpen() {
  playFilteredNoise({ duration: 0.35, vol: 0.05, filterType: 'lowpass', filterFreq: 250, filterQ: 0.7 })
  playSweep({ startFreq: 500, endFreq: 180, duration: 0.35, type: 'sawtooth', gain: 0.03 })
}

/** Clink — glass/plate tap */
function clink() {
  playTone({ freq: 2400, duration: 0.16, type: 'triangle', gain: 0.08 })
  playTone({ freq: 3100, duration: 0.12, type: 'triangle', gain: 0.04, startOffset: 0.015 })
}

/** Chop — knife on cutting board */
function chop() {
  playFilteredNoise({ duration: 0.06, vol: 0.14, filterType: 'highpass', filterFreq: 1800, filterQ: 0.7 })
  playTone({ freq: 90, duration: 0.08, type: 'sine', gain: 0.16 })
}

/** Pour — water/liquid stream */
function pour() {
  playFilteredNoise({ duration: 0.85, vol: 0.07, filterType: 'bandpass', filterFreq: 2400, filterQ: 1 })
  playFilteredNoise({ duration: 0.85, vol: 0.03, filterType: 'lowpass', filterFreq: 600, filterQ: 0.5, startOffset: 0.05 })
}

/** Fridge open — soft click + low hum */
function fridgeOpen() {
  playFilteredNoise({ duration: 0.04, vol: 0.1, filterType: 'highpass', filterFreq: 1500 })
  playTone({ freq: 65, duration: 0.45, type: 'sine', gain: 0.08, startOffset: 0.05 })
}

/** Success — three rising triangle tones */
function success() {
  playTone({ freq: 880, duration: 0.1, type: 'triangle' })
  playTone({ freq: 1175, duration: 0.1, type: 'triangle', startOffset: 0.08 })
  playTone({ freq: 1568, duration: 0.18, type: 'triangle', startOffset: 0.16 })
}

/** Error — two descending square tones */
function error() {
  playTone({ freq: 440, duration: 0.12, type: 'square', gain: 0.06 })
  playTone({ freq: 330, duration: 0.18, type: 'square', gain: 0.06, startOffset: 0.1 })
}

/** Cooking correct — ascending two-tone chime (casual mobile-game ding) */
function cookingCorrect() {
  playTone({ freq: 523, duration: 0.08, gain: 0.3 })       // C5
  playTone({ freq: 659, duration: 0.12, gain: 0.3, startOffset: 0.08 }) // E5
}

/** Cooking wrong — low buzzer (quiz-show style) */
function cookingWrong() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = 180
  filter.type = 'bandpass'
  filter.frequency.value = 180
  filter.Q.value = 5
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  const t = ctx.currentTime
  gain.gain.setValueAtTime(0.35, t)
  gain.gain.linearRampToValueAtTime(0, t + 0.3)
  osc.start(t)
  osc.stop(t + 0.32)
}

/** Cooking missed — descending two-tone (gentle "you lost this one") */
function cookingMissed() {
  playTone({ freq: 440, duration: 0.1, type: 'triangle', gain: 0.25 })
  playTone({ freq: 330, duration: 0.15, type: 'triangle', gain: 0.25, startOffset: 0.1 })
}

/** Robot beep — two quick blips (friendly electronic chirp) */
function robotBeep() {
  playTone({ freq: 800, duration: 0.06, gain: 0.2 })
  playTone({ freq: 1000, duration: 0.06, gain: 0.2, startOffset: 0.1 })
}

/** Phone message soft — same as phoneMessage but at ~half volume for expiry cue */
function phoneMessageSoft() {
  playTone({ freq: 1200, duration: 0.08, type: 'triangle', gain: 0.05 })
  playTone({ freq: 1400, duration: 0.1, type: 'triangle', gain: 0.05, startOffset: 0.1 })
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
  | 'doorbell'
  | 'phoneRing'
  | 'footstep'
  | 'doorOpen'
  | 'clink'
  | 'chop'
  | 'pour'
  | 'fridgeOpen'
  | 'success'
  | 'error'
  | 'cookingCorrect'
  | 'cookingWrong'
  | 'cookingMissed'
  | 'robotBeep'
  | 'phoneMessageSoft'

const SYNTH_MAP: Record<SoundName, () => void> = {
  sizzle,
  plateDing,
  burnBuzz,
  pmSelect,
  pmConfirm,
  tableComplete,
  phoneMessage,
  ashCrumble,
  doorbell: doorbellSynth,
  phoneRing,
  footstep,
  doorOpen,
  clink,
  chop,
  pour,
  fridgeOpen,
  success,
  error,
  cookingCorrect,
  cookingWrong,
  cookingMissed,
  robotBeep,
  phoneMessageSoft,
}

export const ALL_SOUND_NAMES: SoundName[] = Object.keys(SYNTH_MAP) as SoundName[]

/** Returns true when this sound is backed by an audio file (vs synthesized). */
export function isFileBackedSound(name: SoundName): boolean {
  return Boolean(AUDIO_FILES[name])
}

export function playSound(name: SoundName) {
  try {
    const fileUrl = AUDIO_FILES[name]
    if (fileUrl) {
      playFile(fileUrl)
      return
    }
    SYNTH_MAP[name]()
  } catch {
    // Audio API unavailable — silent fallback
  }
}

/** Eagerly download all file-backed sounds so the first play is instant. */
export function preloadAudioFiles() {
  for (const url of Object.values(AUDIO_FILES)) {
    if (url) loadAudioFile(url).catch(() => {})
  }
}

/**
 * Returns a stable `play` callback. Usage:
 * ```ts
 * const play = useSoundEffects()
 * play('sizzle')
 * ```
 *
 * On first mount this also kicks off a background preload of file-backed
 * sounds so subsequent plays don't have a fetch delay.
 */
export function useSoundEffects() {
  const preloadedRef = useRef(false)
  useEffect(() => {
    if (preloadedRef.current) return
    preloadedRef.current = true
    preloadAudioFiles()
  }, [])
  return useCallback((name: SoundName) => playSound(name), [])
}
