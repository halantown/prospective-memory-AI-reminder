/**
 * useAudio hook — integrates audio engine with game events.
 *
 * Listens to Zustand store changes and triggers appropriate sounds.
 * Must be mounted once in GameShell (after user interaction to unlock audio).
 */
import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import {
  initBGM, stopBGM, unlockAudio,
  sfxSteakReady, sfxSteakBurning,
  sfxMessageNotify, sfxMessageTimeout,
  sfxScorePlus, sfxScoreMinus,
  robotSpeak,
} from '../utils/audio'

export function useAudio() {
  const phase = useGameStore((s) => s.phase)
  const score = useGameStore((s) => s.score)
  const hobs = useGameStore((s) => s.hobs)
  const messageBubbles = useGameStore((s) => s.messageBubbles)
  const robotText = useGameStore((s) => s.robotText)
  const robotSpeaking = useGameStore((s) => s.robotSpeaking)
  const setRobotSpeaking = useGameStore((s) => s.setRobotSpeaking)

  const prevScore = useRef(score)
  const prevHobStatuses = useRef(hobs.map(h => h.status))
  const prevMsgCount = useRef(messageBubbles.length)
  const prevRobotText = useRef(robotText)
  const audioUnlocked = useRef(false)

  // Unlock audio on first user click (browser requirement)
  useEffect(() => {
    const handler = () => {
      if (!audioUnlocked.current) {
        unlockAudio()
        audioUnlocked.current = true
      }
    }
    document.addEventListener('click', handler, { once: false })
    return () => document.removeEventListener('click', handler)
  }, [])

  // Start BGM when block starts, stop on block end
  useEffect(() => {
    if (phase === 'block_running') {
      initBGM()
    } else if (phase === 'block_end' || phase === 'welcome') {
      stopBGM()
    }
  }, [phase])

  // Score change → ding / thud
  useEffect(() => {
    const delta = score - prevScore.current
    if (delta > 0) sfxScorePlus()
    else if (delta < 0) sfxScoreMinus()
    prevScore.current = score
  }, [score])

  // Hob status transitions → sizzle / alarm
  useEffect(() => {
    hobs.forEach((hob, i) => {
      const prev = prevHobStatuses.current[i]
      if (prev !== hob.status) {
        if (hob.status === 'ready') sfxSteakReady()
        else if (hob.status === 'burning') sfxSteakBurning()
      }
    })
    prevHobStatuses.current = hobs.map(h => h.status)
  }, [hobs])

  // New message → notification chime
  useEffect(() => {
    if (messageBubbles.length > prevMsgCount.current) {
      sfxMessageNotify()
    }
    prevMsgCount.current = messageBubbles.length
  }, [messageBubbles.length])

  // Message expired → check last expired
  useEffect(() => {
    const lastExpired = messageBubbles.filter(m => m.expired).length
    // We track this via score decrease rather than separately
  }, [messageBubbles])

  // Robot speech via Web Speech API
  useEffect(() => {
    if (robotText && robotText !== prevRobotText.current) {
      robotSpeak(robotText, {
        lang: 'en-US',
        rate: 0.9,
        onStart: () => setRobotSpeaking?.(true),
        onEnd: () => setRobotSpeaking?.(false),
      })
    }
    prevRobotText.current = robotText
  }, [robotText, setRobotSpeaking])
}
