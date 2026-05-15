import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useSoundEffects } from './useSoundEffects'

const PROACTIVE_COMMENTS = [
  "Don't worry, check the recipe if you need to!",
  'The recipe tab has all the steps — take a look!',
  'No rush, you can always check the recipe.',
  'Hey, the recipe is right there if you need a refresher!',
  'Tricky one! The recipe might help.',
]

const ERROR_THRESHOLD = 3
const COOLDOWN_SECONDS = 90

export function useRobotProactivePrompt() {
  const consecutiveErrors = useGameStore((s) => s.consecutiveCookingErrors)
  const lastPromptTime = useGameStore((s) => s.lastProactivePromptGameTime)
  const lastComment = useGameStore((s) => s.lastProactiveComment)
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds)
  const gameTimeFrozen = useGameStore((s) => s.gameTimeFrozen)
  const pmPipelineState = useGameStore((s) => s.pmPipelineState)
  const play = useSoundEffects()
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (consecutiveErrors < ERROR_THRESHOLD) {
      triggeredRef.current = false
      return
    }
    if (triggeredRef.current) return
    if (gameTimeFrozen) return
    if (pmPipelineState) return
    if (elapsedSeconds - lastPromptTime < COOLDOWN_SECONDS) return

    triggeredRef.current = true

    const available = PROACTIVE_COMMENTS.filter((c) => c !== lastComment)
    const comment = available[Math.floor(Math.random() * available.length)]

    play('robotBeep')

    const store = useGameStore.getState()
    store.setRobotSpeaking(comment)

    useGameStore.setState({
      consecutiveCookingErrors: 0,
      lastProactivePromptGameTime: elapsedSeconds,
      lastProactiveComment: comment,
    })

    const speechTimer = setTimeout(() => {
      useGameStore.getState().clearRobotSpeech()
    }, 4000)

    if (store.wsSend) {
      store.wsSend({
        type: 'robot_proactive_prompt',
        data: {
          trigger_reason: 'consecutive_errors',
          error_count: consecutiveErrors,
          comment_text: comment,
          game_time: elapsedSeconds,
          timestamp: Date.now() / 1000,
        },
      })
    }

    return () => clearTimeout(speechTimer)
  }, [consecutiveErrors, lastPromptTime, lastComment, elapsedSeconds, gameTimeFrozen, pmPipelineState, play])
}
