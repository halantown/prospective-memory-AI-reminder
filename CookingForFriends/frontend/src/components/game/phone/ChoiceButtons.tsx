/** Choice buttons — inline reply buttons with randomized answer position. */

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'

interface ChoiceButtonsProps {
  correctChoice: string
  wrongChoice: string
  /** null = frontend randomizes; 0 = correct first; 1 = correct second */
  correctPosition?: number | null
  onChoose: (chosenText: string, isCorrect: boolean, correctPositionShown: number) => void
}

export default function ChoiceButtons({
  correctChoice,
  wrongChoice,
  correctPosition,
  onChoose,
}: ChoiceButtonsProps) {
  const [randomPosition] = useState(() => Math.random() < 0.5 ? 0 : 1)

  // Randomize button order once on first render; stable across re-renders.
  const resolvedPosition = useMemo(() => {
    if (correctPosition === 0 || correctPosition === 1) return correctPosition
    return randomPosition
  }, [correctPosition, randomPosition])

  const buttons = useMemo(() => {
    return resolvedPosition === 0
      ? [correctChoice, wrongChoice]
      : [wrongChoice, correctChoice]
  }, [resolvedPosition, correctChoice, wrongChoice])

  const [flashIndex, setFlashIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)

  const handleClick = useCallback((idx: number) => {
    if (answered) return
    const chosenText = buttons[idx]
    const isCorrect = chosenText === correctChoice
    setFlashIndex(idx)
    setAnswered(true)
    onChoose(chosenText, isCorrect, resolvedPosition)
  }, [answered, buttons, correctChoice, onChoose, resolvedPosition])

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      {buttons.map((text, idx) => {
        const isFlashing = flashIndex === idx

        let bgClass = 'bg-blue-600/15 text-blue-200 border-blue-500/25 hover:bg-blue-600/30 hover:border-blue-400/40'

        if (answered) {
          if (flashIndex === idx) {
            bgClass = 'bg-blue-600/30 text-blue-200 border-blue-400/50'
          } else {
            bgClass = 'bg-slate-700/20 text-slate-500 border-slate-600/20'
          }
        }

        return (
          <motion.button
            key={idx}
            onClick={() => handleClick(idx)}
            disabled={answered}
            animate={isFlashing ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.2 }}
            className={`w-full py-2.5 px-3 text-[13px] font-medium rounded-xl
                       border transition-colors leading-tight text-left
                       ${bgClass}
                       ${answered ? 'cursor-default' : 'active:scale-95 cursor-pointer'}`}
          >
            {text}
          </motion.button>
        )
      })}
    </div>
  )
}
