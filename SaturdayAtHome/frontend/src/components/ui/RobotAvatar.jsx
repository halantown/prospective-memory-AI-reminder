import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Bot } from 'lucide-react'

/**
 * Robot avatar — fixed bottom-right, 80px.
 * T20-1: Always visible, subtle idle pulse.
 * T20-3: Speech bubble with typewriter effect, stays 2s after text completes, then fades.
 * T20-4: Triggered by WS reminder_fire → triggerRobot(text).
 */
const CHAR_DELAY = 15    // ms per character for typewriter
const LINGER_MS = 2000   // stay visible after typewriter finishes

export default function RobotAvatar() {
  const robotSpeaking = useGameStore((s) => s.robotSpeaking)
  const robotText = useGameStore((s) => s.robotText)
  const clearRobotText = useGameStore((s) => s.clearRobotText)

  const [displayText, setDisplayText] = useState('')
  const [showBubble, setShowBubble] = useState(false)
  const timerRef = useRef(null)
  const lingerRef = useRef(null)

  // Typewriter effect
  useEffect(() => {
    if (robotText) {
      setShowBubble(true)
      setDisplayText('')
      let idx = 0
      clearTimeout(timerRef.current)
      clearTimeout(lingerRef.current)

      const tick = () => {
        idx++
        setDisplayText(robotText.slice(0, idx))
        if (idx < robotText.length) {
          timerRef.current = setTimeout(tick, CHAR_DELAY)
        } else {
          // Text complete — linger, then fade
          lingerRef.current = setTimeout(() => {
            setShowBubble(false)
            // Clear store after fade animation
            setTimeout(() => clearRobotText(), 400)
          }, LINGER_MS)
        }
      }
      timerRef.current = setTimeout(tick, CHAR_DELAY)
    } else {
      setShowBubble(false)
      setDisplayText('')
    }

    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(lingerRef.current)
    }
  }, [robotText, clearRobotText])

  return (
    <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end pointer-events-none">
      {/* Speech bubble */}
      <AnimatePresence>
        {showBubble && displayText && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl px-4 py-3 shadow-xl border border-slate-200 max-w-[280px] mb-3 pointer-events-auto"
          >
            <p className="text-sm text-slate-700 leading-relaxed">{displayText}</p>
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white border-r border-b border-slate-200 transform rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Robot body — 80px, always visible */}
      <motion.div
        animate={robotSpeaking
          ? { scale: [1, 1.06, 1] }
          : { scale: [1, 1.02, 1] }
        }
        transition={robotSpeaking
          ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
        }
        className="w-[80px] h-[80px] bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center pointer-events-auto cursor-default"
      >
        <Bot size={40} className="text-white" />
      </motion.div>
    </div>
  )
}
