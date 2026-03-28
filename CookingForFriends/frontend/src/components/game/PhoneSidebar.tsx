/** Phone sidebar — iPhone shell with message system (v3).
 *
 *  Three visual categories, one card layout:
 *    1. Question  → life-context message + two choice buttons
 *    2. Notification → text only, no buttons
 *    3. PM trigger  → identical to notification (frontend never knows)
 *
 *  Messages stay visible until pushed off by newer messages.
 *  Card height adapts to content. No countdown bar.
 *  Correct/incorrect answers flash green/red then fade out.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { PhoneMessage } from '../../types'
import { useSoundEffects } from '../../hooks/useSoundEffects'

const LOCK_TIMEOUT = 15_000
const BANNER_DURATION = 3_000
const FEEDBACK_FLASH_MS = 200
const FADE_OUT_MS = 300

export default function PhoneSidebar() {
  const messages = useGameStore((s) => s.phoneMessages)
  const locked = useGameStore((s) => s.phoneLocked)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const markMessageRead = useGameStore((s) => s.markMessageRead)
  const answerPhoneMessage = useGameStore((s) => s.answerPhoneMessage)
  const removePhoneMessage = useGameStore((s) => s.removePhoneMessage)
  const gameClock = useGameStore((s) => s.gameClock)
  const wsSend = useGameStore((s) => s.wsSend)
  const banner = useGameStore((s) => s.phoneBanner)
  const setBanner = useGameStore((s) => s.setPhoneBanner)

  const lastActivityRef = useRef(Date.now())
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const play = useSoundEffects()
  const [panelPulse, setPanelPulse] = useState(false)

  // Active messages (newest at bottom)
  const activeMessages = useMemo(() => {
    return messages
      .filter(m => m.status === 'active')
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [messages])

  // Remove messages after fade-out animation completes
  useEffect(() => {
    const fading = messages.filter(m =>
      m.status === 'dismissed' || m.status === 'answered_correct' || m.status === 'answered_incorrect'
    )
    if (fading.length === 0) return

    const timers = fading.map(msg => {
      const delay = msg.status === 'dismissed'
        ? FADE_OUT_MS
        : FEEDBACK_FLASH_MS + FADE_OUT_MS
      return setTimeout(() => removePhoneMessage(msg.id), delay)
    })
    return () => timers.forEach(clearTimeout)
  }, [messages, removePhoneMessage])

  // Auto-lock after timeout
  useEffect(() => {
    if (locked) return
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > LOCK_TIMEOUT) {
        setPhoneLocked(true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [locked, setPhoneLocked])

  // Banner: play chime, pulse panel, auto-dismiss
  useEffect(() => {
    if (banner) {
      play('phoneMessage')

      setPanelPulse(true)
      const pulseTimer = setTimeout(() => setPanelPulse(false), 150)

      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = setTimeout(() => setBanner(null), BANNER_DURATION)

      return () => {
        clearTimeout(pulseTimer)
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      }
    }
  }, [banner, setBanner, play])

  const handleUnlock = useCallback(() => {
    setPhoneLocked(false)
    lastActivityRef.current = Date.now()
    if (wsSend) {
      wsSend({ type: 'phone_unlock', data: { timestamp: Date.now() / 1000 } })
    }
  }, [setPhoneLocked, wsSend])

  const handleInteraction = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  const handleBannerClick = useCallback(() => {
    if (locked) handleUnlock()
    handleInteraction()
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    setBanner(null)
  }, [locked, setBanner, handleUnlock, handleInteraction])

  const handleReadMessage = useCallback((msg: PhoneMessage) => {
    if (!msg.read) {
      markMessageRead(msg.id)
      if (wsSend) {
        wsSend({
          type: 'phone_read',
          data: { message_id: msg.id, timestamp: Date.now() / 1000 },
        })
      }
    }
  }, [markMessageRead, wsSend])

  const handleAnswer = useCallback((msg: PhoneMessage, choiceIndex: number) => {
    if (msg.status !== 'active' || msg.category !== 'question') return
    answerPhoneMessage(msg.id, choiceIndex)
    lastActivityRef.current = Date.now()
    if (wsSend) {
      wsSend({
        type: 'phone_reply',
        data: {
          message_id: msg.id,
          choice_index: choiceIndex,
          timestamp: Date.now() / 1000,
        },
      })
    }
  }, [answerPhoneMessage, wsSend])

  const unreadCount = messages.filter(m => m.status === 'active' && !m.read).length

  return (
    <div className="h-full flex items-center justify-center bg-slate-900 p-3">
      {/* iPhone shell */}
      <div className="relative flex flex-col w-full max-w-[320px] h-full max-h-[680px]">
        {/* Notification Banner */}
        <AnimatePresence>
          {banner && (
            <motion.div
              key={`banner-${banner.id}`}
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute top-0 left-0 right-0 z-30 rounded-b-2xl bg-slate-900/95 backdrop-blur-lg
                         border-b-2 border-blue-500/60 p-3 shadow-2xl shadow-blue-500/20 cursor-pointer"
              onClick={handleBannerClick}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-500/70 flex items-center justify-center
                                text-sm font-bold text-white ring-2 ring-blue-400/40">
                  {banner.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{banner.sender}</span>
                    <span className="text-[9px] text-blue-400 font-medium">now</span>
                  </div>
                  <p className="text-[11px] text-slate-200 truncate mt-0.5">{banner.text}</p>
                </div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse flex-shrink-0" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Outer bezel — pulse glow on new message */}
        <div
          className={`relative flex flex-col flex-1 rounded-[40px] border-[3px]
                      bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl shadow-black/50
                      overflow-hidden transition-all duration-150
                      ${panelPulse
                        ? 'border-blue-400 shadow-blue-500/40'
                        : 'border-slate-600'
                      }`}
          onPointerDownCapture={handleInteraction}
        >
          {/* Dynamic Island */}
          <div className="flex justify-center pt-2 pb-1 relative z-10">
            <div className="w-[90px] h-[25px] bg-black rounded-full flex items-center justify-center gap-2">
              <div className="w-[8px] h-[8px] rounded-full bg-slate-700 ring-1 ring-slate-600" />
              <div className="w-[6px] h-[6px] rounded-full bg-slate-800" />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-1 text-[10px]">
            <span className="text-white font-medium">{gameClock ?? '--:--'}</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {unreadCount}
                </span>
              )}
              <span className="text-white/60">📶</span>
              <span className="text-white/60">🔋</span>
            </div>
          </div>

          {/* Screen content */}
          {locked ? (
            <div
              className="flex-1 phone-locked flex flex-col px-4 pt-3 pb-4"
              onClick={(e) => { e.stopPropagation(); handleUnlock() }}
            >
              <div className="flex flex-col items-center mb-4">
                <div className="text-2xl mb-1">🔒</div>
                <div className="text-3xl font-extralight text-white tracking-wider">{gameClock ?? '--:--'}</div>
              </div>

              <LockScreenPreviews messages={activeMessages} onUnlock={handleUnlock} />

              <div className="mt-auto flex flex-col items-center gap-1.5 cursor-pointer">
                <svg
                  width="36" height="36" viewBox="0 0 48 48" fill="none"
                  className="animate-bounce"
                >
                  <circle cx="24" cy="14" r="6" fill="white" opacity="0.3" />
                  <circle cx="24" cy="14" r="3.5" fill="white" opacity="0.5" />
                  <path
                    d="M24 20 L24 34 M24 34 L20 30 M24 34 L28 30"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    opacity="0.7"
                  />
                  <circle cx="24" cy="14" r="10" stroke="white" strokeWidth="1" opacity="0.15" />
                  <circle cx="24" cy="14" r="14" stroke="white" strokeWidth="0.8" opacity="0.08" />
                </svg>
                <p className="text-white/70 text-sm font-medium tracking-wide animate-pulse">
                  Tap to unlock
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* App header */}
              <div className="px-4 py-2 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="text-white text-sm font-semibold">💬 Messages</h3>
                <button
                  onClick={() => setPhoneLocked(true)}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors px-2 py-1 rounded"
                >
                  🔒 Lock
                </button>
              </div>

              {/* Message list — scrollable overflow hidden, newest at bottom */}
              <div className="flex-1 flex flex-col justify-end px-3 py-2 gap-2 overflow-hidden">
                {activeMessages.length === 0 && messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <span className="text-3xl mb-2">📭</span>
                    <p className="text-xs">No messages yet</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {messages
                      .filter(m => m.status === 'active' || m.status === 'answered_correct' || m.status === 'answered_incorrect' || m.status === 'dismissed')
                      .sort((a, b) => a.timestamp - b.timestamp)
                      .map((msg) => (
                        <MessageCard
                          key={msg.id}
                          msg={msg}
                          onRead={() => handleReadMessage(msg)}
                          onAnswer={(choiceIndex) => handleAnswer(msg, choiceIndex)}
                        />
                      ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          )}

          {/* Home indicator bar */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="w-[120px] h-[4px] bg-white/20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════
   MessageCard — unified layout, dynamic height, choice buttons
   ═══════════════════════════════════════════════════════════════ */

function MessageCard({
  msg,
  onRead,
  onAnswer,
}: {
  msg: PhoneMessage
  onRead: () => void
  onAnswer: (choiceIndex: number) => void
}) {
  // Mark as read after brief visibility
  useEffect(() => {
    if (!msg.read && msg.status === 'active') {
      const timer = setTimeout(onRead, 300)
      return () => clearTimeout(timer)
    }
  }, [msg.read, msg.status, onRead])

  const isAnswered = msg.status === 'answered_correct' || msg.status === 'answered_incorrect'
  const isDismissed = msg.status === 'dismissed'
  const isFading = isAnswered || isDismissed

  // Border color for feedback flash
  const borderColor =
    msg.status === 'answered_correct' ? '#4ade80' :
    msg.status === 'answered_incorrect' ? '#f87171' :
    'rgba(51,65,85,0.5)' // slate-700/50

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{
        opacity: isFading ? 0 : 1,
        y: 0,
        scale: 1,
        borderColor,
      }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{
        opacity: {
          duration: isFading ? FADE_OUT_MS / 1000 : 0.2,
          delay: isAnswered ? FEEDBACK_FLASH_MS / 1000 : 0,
        },
        borderColor: { duration: 0.1 },
        layout: { type: 'spring', stiffness: 300, damping: 30 },
      }}
      className="rounded-2xl border-2 overflow-hidden bg-slate-800/40 flex flex-col shrink-0"
    >
      {/* Header: avatar + sender */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-600/50 flex items-center justify-center
                          text-xs font-bold text-blue-200 flex-shrink-0">
            {msg.avatar}
          </div>
          <span className="text-[11px] font-semibold text-blue-300">{msg.sender}</span>
        </div>
      </div>

      {/* Message body */}
      <div className="px-3 pb-2">
        <p className="text-[12px] leading-relaxed text-slate-200 pl-9">
          {msg.text}
        </p>
      </div>

      {/* Choice buttons — only for questions with active status */}
      {msg.category === 'question' && msg.status === 'active' && msg.choices && (
        <div className="px-3 pb-2.5 flex gap-2">
          {msg.choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); onAnswer(idx) }}
              className="flex-1 py-2 px-2 text-[11px] font-medium rounded-xl
                         bg-blue-600/15 text-blue-200 border border-blue-500/25
                         hover:bg-blue-600/30 hover:border-blue-400/40
                         transition-colors active:scale-95 leading-tight"
            >
              {choice}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}


/* ═══════════════════════════════════════════════════════════════
   Lock screen previews — show latest active messages
   ═══════════════════════════════════════════════════════════════ */

const MAX_LOCK_PREVIEWS = 3

function LockScreenPreviews({
  messages,
  onUnlock,
}: {
  messages: PhoneMessage[]
  onUnlock: () => void
}) {
  const previews = [...messages]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_LOCK_PREVIEWS)

  if (previews.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <AnimatePresence>
        {previews.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: idx * 0.04, type: 'spring', stiffness: 280, damping: 22 }}
            onClick={(e) => { e.stopPropagation(); onUnlock() }}
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer
                       bg-slate-800/60 border border-slate-700/40 backdrop-blur-sm"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600/50 flex items-center justify-center
                            text-xs font-bold text-blue-100 flex-shrink-0">
              {msg.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-semibold text-blue-300 leading-none block">
                {msg.sender}
              </span>
              <p className="text-[10px] text-slate-300 truncate leading-tight mt-0.5">
                {msg.text}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
