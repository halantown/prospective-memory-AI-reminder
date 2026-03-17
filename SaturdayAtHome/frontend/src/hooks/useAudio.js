import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'

// Web Audio API beep as placeholder — replace with new Audio('/ding.mp3') when a real sound file is available
function createBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Audio not available
  }
}

export function useAudio() {
  const robotText = useGameStore(s => s.robotText)
  const finishSpeaking = useGameStore(s => s.finishSpeaking)
  const prevRobotText = useRef(null)
  const prevTriggers = useRef(null)

  const handleTriggerChange = useCallback(() => {
    const triggers = useGameStore.getState().triggers
    const prev = prevTriggers.current
    if (prev) {
      for (let i = 0; i < triggers.length; i++) {
        if (prev[i] && triggers[i].state !== prev[i].state && triggers[i].state !== 'inactive') {
          createBeep()
          break
        }
      }
    }
    prevTriggers.current = triggers.map(t => ({ ...t }))
  }, [])

  useEffect(() => {
    prevTriggers.current = useGameStore.getState().triggers.map(t => ({ ...t }))
    const unsub = useGameStore.subscribe(handleTriggerChange)
    return unsub
  }, [handleTriggerChange])

  // Robot TTS via Web Speech API
  useEffect(() => {
    if (robotText && robotText !== prevRobotText.current) {
      prevRobotText.current = robotText
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(robotText)
        utterance.lang = 'en-US'
        utterance.rate = 0.9
        utterance.onend = () => finishSpeaking()
        utterance.onerror = () => finishSpeaking()
        window.speechSynthesis.speak(utterance)
      } else {
        setTimeout(() => finishSpeaking(), 3000)
      }
    }
  }, [robotText, finishSpeaking])
}
