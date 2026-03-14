/**
 * Audio engine — BGM, sound effects, and TTS.
 *
 * BGM: Howler.js loop, auto-duck during robot speech.
 * SFX: Web Audio API procedural generation (no files needed).
 * TTS: Web Speech API with ducking callbacks.
 */
import { Howl } from 'howler'

// ─── Singleton AudioContext (lazy-init after user gesture) ─────────────────
let ctx = null
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

// ─── BGM ───────────────────────────────────────────────────────────────────
let bgm = null
let BGM_NORMAL = 0.35
const BGM_DUCKED = 0.08
let bgmDuckActive = false

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function initBGM(src = '/audio/bgm.mp3') {
  if (bgm) return
  bgm = new Howl({
    src: [src, '/audio/bgm.wav'],   // mp3 preferred, wav fallback
    loop: true,
    volume: 0,
    html5: true,
  })
  bgm.play()
  bgm.fade(0, BGM_NORMAL, 2000)
}

export function stopBGM() {
  if (!bgm) return
  bgm.fade(bgm.volume(), 0, 1000)
  setTimeout(() => {
    bgm?.stop()
    bgm = null
    bgmDuckActive = false
  }, 1100)
}

function duckBGM() {
  bgmDuckActive = true
  bgm?.fade(bgm.volume(), BGM_DUCKED, 300)
}

function unduckBGM() {
  bgmDuckActive = false
  bgm?.fade(bgm.volume(), BGM_NORMAL, 800)
}

export function setBGMNormalVolume(volume, fadeMs = 1400) {
  BGM_NORMAL = clamp(Number(volume) || 0, 0.05, 0.8)
  if (bgm && !bgmDuckActive) {
    bgm.fade(bgm.volume(), BGM_NORMAL, fadeMs)
  }
}

// ─── Web Audio API procedural SFX ──────────────────────────────────────────

function playTone(freq, duration, type = 'sine', volume = 0.3, rampDown = true) {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.value = volume
  if (rampDown) gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + duration)
}

function playNoise(duration, volume = 0.15) {
  const ac = getCtx()
  const bufferSize = ac.sampleRate * duration
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5
  const source = ac.createBufferSource()
  source.buffer = buffer
  const gain = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 3000
  filter.Q.value = 1
  gain.gain.value = volume
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  source.start()
  source.stop(ac.currentTime + duration)
}

// ─── Named sound effects ───────────────────────────────────────────────────

/** Steak → READY: short sizzle */
export function sfxSteakReady() {
  playNoise(0.4, 0.12)
  playTone(800, 0.15, 'sine', 0.1)
}

/** Steak → BURNING: low alarm */
export function sfxSteakBurning() {
  playTone(180, 0.3, 'sawtooth', 0.25)
  setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.2), 300)
}

/** New message notification */
export function sfxMessageNotify() {
  playTone(880, 0.08, 'sine', 0.2)
  setTimeout(() => playTone(1100, 0.12, 'sine', 0.2), 100)
  setTimeout(() => playTone(1320, 0.15, 'sine', 0.15), 200)
}

/** Message timeout: low thud */
export function sfxMessageTimeout() {
  playTone(200, 0.25, 'sine', 0.25)
}

/** Score gained: bright ding */
export function sfxScorePlus() {
  playTone(1200, 0.12, 'sine', 0.18)
  setTimeout(() => playTone(1600, 0.15, 'sine', 0.15), 80)
}

/** Score lost: low thud */
export function sfxScoreMinus() {
  playTone(250, 0.2, 'triangle', 0.2)
  setTimeout(() => playTone(180, 0.25, 'triangle', 0.15), 120)
}

/** Robot pre-speech chime (0.3s before TTS) */
export function sfxRobotChime() {
  playTone(660, 0.08, 'sine', 0.15)
  setTimeout(() => playTone(880, 0.1, 'sine', 0.12), 90)
}

// ─── Robot TTS via Web Speech API ──────────────────────────────────────────

let currentUtterance = null

/**
 * Speak text via Web Speech API.
 * Handles BGM ducking and returns a Promise that resolves when speech ends.
 * @param {string} text
 * @param {object} options
 * @returns {Promise<void>}
 */
export function robotSpeak(text, { lang = 'en-US', rate = 0.9, onStart, onEnd } = {}) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn('[Audio] Web Speech API not available')
      resolve()
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    // Play chime 300ms before speaking
    sfxRobotChime()

    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      utter.rate = rate
      utter.pitch = 1.0
      currentUtterance = utter

      utter.onstart = () => {
        duckBGM()
        onStart?.()
      }

      utter.onend = () => {
        unduckBGM()
        currentUtterance = null
        onEnd?.()
        resolve()
      }

      utter.onerror = (e) => {
        console.warn('[Audio] TTS error:', e)
        unduckBGM()
        currentUtterance = null
        onEnd?.()
        resolve()
      }

      window.speechSynthesis.speak(utter)
    }, 300)
  })
}

export function stopSpeech() {
  window.speechSynthesis?.cancel()
  unduckBGM()
  currentUtterance = null
}

/**
 * Resume AudioContext after user gesture (required by browsers).
 * Call this from a click handler early in the app lifecycle.
 */
export function unlockAudio() {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
}
