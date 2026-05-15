/** Chat bubble — single message in the chat view.
 *  Supports friend (left-aligned), participant (right-aligned), and feedback variants. */

import { motion } from 'framer-motion'

interface ChatBubbleProps {
  text: string
  variant?: 'friend' | 'participant' | 'feedback'
  /** Brief green/red border flash for participant bubbles */
  flashResult?: 'correct' | 'incorrect' | null
  /** Visual accent for feedback bubbles */
  feedbackType?: 'correct' | 'incorrect' | 'expired' | null
}

export default function ChatBubble({ text, variant = 'friend', flashResult, feedbackType }: ChatBubbleProps) {
  const isParticipant = variant === 'participant'
  const isFeedback = variant === 'feedback'

  const bgClass = isParticipant
    ? 'bg-blue-600 text-white'
    : isFeedback
      ? 'bg-slate-600/40 text-slate-200 italic'
      : 'bg-slate-700/50 text-slate-200'

  const borderFlash = flashResult === 'correct'
    ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-slate-800'
    : flashResult === 'incorrect'
      ? 'ring-2 ring-red-400 ring-offset-1 ring-offset-slate-800'
      : ''

  const accentBar = feedbackType === 'correct'
    ? 'border-l-[3px] border-green-400'
    : feedbackType === 'incorrect'
      ? 'border-l-[3px] border-orange-400'
      : ''

  const expiredStyle = feedbackType === 'expired' ? 'opacity-50' : ''

  return (
    <div className={`flex ${isParticipant ? 'justify-end' : 'justify-start'} ${expiredStyle}`}>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed
                    ${bgClass} ${borderFlash} ${accentBar}`}
      >
        {feedbackType === 'expired' && <span className="mr-1">⏰</span>}
        {text}
      </motion.div>
    </div>
  )
}
