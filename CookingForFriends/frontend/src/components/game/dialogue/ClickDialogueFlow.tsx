/** Click-to-advance dialogue flow for trigger encounters. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { DialogueLine } from '../../../data/triggerEncounters'

const TYPE_MS = 30
const HINT_MS = 30_000
const AUTO_ADVANCE_MS = 45_000

interface ClickDialogueFlowProps {
  lines: DialogueLine[]
  phoneAvatar?: ReactNode
  onComplete: () => void
}

function speakerLabel(speaker: string) {
  return speaker === 'Avatar' ? 'You' : speaker
}

export default function ClickDialogueFlow({ lines, phoneAvatar, onComplete }: ClickDialogueFlowProps) {
  const [lineIndex, setLineIndex] = useState(0)
  const [visibleChars, setVisibleChars] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const completedRef = useRef(false)
  const line = lines[lineIndex]
  const fullText = line?.text ?? ''
  const isTyping = visibleChars < fullText.length

  useEffect(() => {
    setLineIndex(0)
    setVisibleChars(0)
    setShowHint(false)
    completedRef.current = false
  }, [lines])

  useEffect(() => {
    setVisibleChars(0)
    setShowHint(false)
  }, [lineIndex])

  useEffect(() => {
    if (!line || !isTyping) return
    const timer = setTimeout(() => {
      setVisibleChars((n) => Math.min(fullText.length, n + 1))
    }, TYPE_MS)
    return () => clearTimeout(timer)
  }, [fullText.length, isTyping, line, visibleChars])

  const complete = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    onComplete()
  }, [onComplete])

  const advance = useCallback(() => {
    if (!line) {
      complete()
      return
    }
    if (isTyping) {
      setVisibleChars(fullText.length)
      return
    }
    if (lineIndex >= lines.length - 1) {
      complete()
      return
    }
    setLineIndex((i) => i + 1)
  }, [complete, fullText.length, isTyping, line, lineIndex, lines.length])

  useEffect(() => {
    if (!line || isTyping) return
    const hint = setTimeout(() => setShowHint(true), HINT_MS)
    const auto = setTimeout(() => advance(), AUTO_ADVANCE_MS)
    return () => {
      clearTimeout(hint)
      clearTimeout(auto)
    }
  }, [advance, isTyping, line, lineIndex])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  const isPhoneLine = line?.bubblePosition === 'phone'
  const align = line?.bubblePosition === 'right' || line?.bubblePosition === 'robot' ? 'right' : 'left'
  const text = useMemo(() => fullText.slice(0, visibleChars), [fullText, visibleChars])

  if (!line) return null

  return (
    <div
      className="fixed bottom-0 left-0 top-0 z-overlay-dialogue flex items-end justify-center bg-gradient-to-t from-black/45 via-transparent to-transparent p-5"
      style={{ right: 'var(--phone-sidebar-width)', pointerEvents: 'auto' }}
      onClick={advance}
      role="button"
      tabIndex={0}
      aria-label="Advance dialogue"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${lineIndex}-${line.speaker}`}
          className={`flex w-full max-w-3xl ${isPhoneLine ? 'mb-36 justify-end' : align === 'right' ? 'justify-end' : 'justify-start'}`}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <div className={`relative max-w-[300px] border-2 border-slate-900 px-4 py-3 text-slate-900 shadow-[4px_4px_0_rgba(15,23,42,0.45)] ${
            isPhoneLine
              ? 'mr-6 rounded-[28px] bg-white'
              : align === 'right'
                ? 'mr-10 bg-amber-50'
                : 'ml-10 bg-amber-50'
          }`}>
            {isPhoneLine && phoneAvatar && (
              <div className="absolute -top-24 right-5 flex h-24 w-24 items-end justify-center overflow-hidden rounded-full border-2 border-slate-900 bg-sky-100 shadow-[3px_3px_0_rgba(15,23,42,0.35)]">
                {phoneAvatar}
              </div>
            )}
            <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-600">
              {speakerLabel(line.speaker)}
            </div>
            <p className="min-h-[3rem] whitespace-pre-wrap text-sm font-semibold leading-relaxed">
              {text}
            </p>
            {!isTyping && (
              <div className="mt-1 text-right text-xs font-black text-slate-700 animate-pulse">
                {showHint ? 'click to continue ▼' : '▼'}
              </div>
            )}
            <div
              className={`absolute bottom-3 h-4 w-4 rotate-45 border-b-2 border-slate-900 ${
                isPhoneLine
                  ? '-right-[9px] border-r-2 bg-white'
                  : align === 'right'
                    ? '-right-[9px] border-r-2 bg-amber-50'
                    : '-left-[9px] border-l-2 bg-amber-50'
              }`}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
