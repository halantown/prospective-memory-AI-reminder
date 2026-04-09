/** Choice buttons — inline reply buttons for question messages. */

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface ChoiceButtonsProps {
  choices: string[]
  correctIndex?: number
  disabled: boolean
  selectedIndex?: number
  onChoose: (index: number) => void
}

export default function ChoiceButtons({
  choices,
  correctIndex,
  disabled,
  selectedIndex,
  onChoose,
}: ChoiceButtonsProps) {
  const [flashIndex, setFlashIndex] = useState<number | null>(null)
  const [flashType, setFlashType] = useState<'correct' | 'incorrect' | null>(null)

  const handleClick = useCallback((idx: number) => {
    if (disabled) return
    const isCorrect = correctIndex !== undefined && idx === correctIndex
    setFlashIndex(idx)
    setFlashType(isCorrect ? 'correct' : 'incorrect')
    onChoose(idx)

    setTimeout(() => {
      setFlashIndex(null)
      setFlashType(null)
    }, 600)
  }, [disabled, correctIndex, onChoose])

  const isAnswered = selectedIndex !== undefined

  return (
    <div className="flex gap-2 mt-1.5">
      {choices.map((choice, idx) => {
        const isSelected = selectedIndex === idx
        const isFlashing = flashIndex === idx

        let bgClass = 'bg-blue-600/15 text-blue-200 border-blue-500/25 hover:bg-blue-600/30 hover:border-blue-400/40'

        if (isAnswered) {
          if (isSelected) {
            bgClass = flashType === 'correct'
              ? 'bg-green-500/30 text-green-200 border-green-400/50'
              : 'bg-red-500/30 text-red-200 border-red-400/50'
          } else {
            bgClass = 'bg-slate-700/20 text-slate-500 border-slate-600/20'
          }
        }

        return (
          <motion.button
            key={idx}
            onClick={() => handleClick(idx)}
            disabled={disabled}
            animate={isFlashing ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.2 }}
            className={`flex-1 py-2 px-2 text-[11px] font-medium rounded-xl
                       border transition-colors leading-tight
                       ${bgClass}
                       ${disabled ? 'cursor-default' : 'active:scale-95 cursor-pointer'}`}
          >
            {choice}
          </motion.button>
        )
      })}
    </div>
  )
}
