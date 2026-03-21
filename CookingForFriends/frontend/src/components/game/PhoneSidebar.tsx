/** Phone sidebar — iPhone shell with interactive message system.
 *  Messages include Q&A with reply buttons, ads, chat, and PM triggers.
 *  PM triggers look identical to regular chat messages (no special styling).
 *  Auto-locks after 15s of inactivity.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { PhoneMessage } from '../../types'

const LOCK_TIMEOUT = 15_000 // 15s
const BANNER_DURATION = 3_000 // 3s

export default function PhoneSidebar() {
  const messages = useGameStore((s) => s.phoneMessages)
  const locked = useGameStore((s) => s.phoneLocked)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const markMessageRead = useGameStore((s) => s.markMessageRead)
  const replyToMessage = useGameStore((s) => s.replyToMessage)
  const gameClock = useGameStore((s) => s.gameClock)
  const wsSend = useGameStore((s) => s.wsSend)
  const banner = useGameStore((s) => s.phoneBanner)
  const setBanner = useGameStore((s) => s.setPhoneBanner)

  const lastActivityRef = useRef(Date.now())
  const feedRef = useRef<HTMLDivElement>(null)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sort: unreplied messages first, then by timestamp desc
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aUnreplied = a.replies && a.replies.length > 0 && !a.replied
      const bUnreplied = b.replies && b.replies.length > 0 && !b.replied

      if (aUnreplied && !bUnreplied) return -1
      if (!aUnreplied && bUnreplied) return 1

      return b.timestamp - a.timestamp
    })
  }, [messages])

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

  // Auto-scroll to top (newest) when new messages arrive
  useEffect(() => {
    if (feedRef.current && !locked) {
      feedRef.current.scrollTop = 0
    }
  }, [messages.length, locked])

  // Auto-dismiss banner after 3s
  useEffect(() => {
    if (banner) {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = setTimeout(() => {
        setBanner(null)
      }, BANNER_DURATION)
    }
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    }
  }, [banner, setBanner])

  const handleUnlock = () => {
    setPhoneLocked(false)
    lastActivityRef.current = Date.now()
    if (wsSend) {
      wsSend({ type: 'phone_unlock', data: { timestamp: Date.now() / 1000 } })
    }
  }

  const handleInteraction = () => {
    lastActivityRef.current = Date.now()
  }

  const handleBannerClick = useCallback(() => {
    if (locked) handleUnlock()
    handleInteraction()
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    setBanner(null)
    // Scroll to top after unlocking (newest/unreplied will be at top)
    setTimeout(() => {
      if (feedRef.current) feedRef.current.scrollTop = 0
    }, 100)
  }, [locked, setBanner])

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

  const handleReply = useCallback((msg: PhoneMessage, replyId: string, replyText: string) => {
    if (msg.replied) return
    replyToMessage(msg.id, replyId, replyText)
    lastActivityRef.current = Date.now()
    if (wsSend) {
      wsSend({
        type: 'phone_reply',
        data: {
          message_id: msg.id,
          reply_id: replyId,
          timestamp: Date.now() / 1000,
        },
      })
    }
  }, [replyToMessage, wsSend])

  const unreadCount = messages.filter(m => !m.read && !m.is_ad).length

  return (
    <div className="h-full flex items-center justify-center bg-slate-900 p-3">
      {/* iPhone shell */}
      <div className="relative flex flex-col w-full max-w-[320px] h-full max-h-[680px]">
        {/* Notification Banner — shows on top even when locked */}
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

        {/* Outer bezel */}
        <div
          className="relative flex flex-col flex-1 rounded-[40px] border-[3px] border-slate-600
                      bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl shadow-black/50
                      overflow-hidden"
          onClick={handleInteraction}
        >
          {/* Dynamic Island / Notch */}
          <div className="flex justify-center pt-2 pb-1 relative z-10">
            <div className="w-[90px] h-[25px] bg-black rounded-full flex items-center justify-center gap-2">
              <div className="w-[8px] h-[8px] rounded-full bg-slate-700 ring-1 ring-slate-600" />
              <div className="w-[6px] h-[6px] rounded-full bg-slate-800" />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-1 text-[10px]">
            <span className="text-white font-medium">{gameClock}</span>
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
              className="flex-1 phone-locked flex flex-col items-center justify-center cursor-pointer px-4"
              onClick={(e) => { e.stopPropagation(); handleUnlock() }}
            >
              <div className="text-5xl mb-6">🔒</div>
              <div className="text-4xl font-extralight text-white mb-1 tracking-wider">{gameClock}</div>
              <p className="text-slate-400 text-xs mt-6 animate-pulse">Tap to unlock</p>
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

              {/* Message feed */}
              <div ref={feedRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {sortedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <span className="text-3xl mb-2">📭</span>
                    <p className="text-xs">No messages yet</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {sortedMessages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        onRead={() => handleReadMessage(msg)}
                        onReply={(replyId, replyText) => handleReply(msg, replyId, replyText)}
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


function MessageBubble({
  msg,
  onRead,
  onReply,
}: {
  msg: PhoneMessage
  onRead: () => void
  onReply: (replyId: string, replyText: string) => void
}) {
  useEffect(() => {
    if (!msg.read) {
      const timer = setTimeout(onRead, 300)
      return () => clearTimeout(timer)
    }
  }, [msg.read, onRead])

  const isAd = msg.is_ad
  const hasReplies = msg.replies && msg.replies.length > 0
  const needsReply = hasReplies && !msg.replied

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: msg.replied ? 0.55 : 1, y: 0 }}
      transition={{ layout: { type: 'spring', stiffness: 200, damping: 25 } }}
      className={`rounded-2xl border overflow-hidden ${
        isAd
          ? 'bg-slate-800/30 border-slate-700/30'
          : needsReply
          ? 'bg-blue-950/40 border-blue-700/50 border-l-[3px] border-l-blue-400'
          : msg.replied
          ? 'bg-slate-800/30 border-slate-700/30'
          : msg.read
          ? 'bg-slate-800/40 border-slate-700/50'
          : 'bg-blue-950/30 border-blue-800/40'
      }`}
    >
      {/* Message header + content */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${isAd ? 'bg-slate-700/50 text-slate-400' : 'bg-blue-600/50 text-blue-200'}`}>
            {msg.avatar}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className={`text-[11px] font-semibold ${
              isAd ? 'text-slate-500' : 'text-blue-300'
            }`}>
              {msg.sender}
            </span>
            {isAd && (
              <span className="text-[8px] bg-slate-600/50 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                AD
              </span>
            )}
          </div>
          {!msg.read && !isAd && (
            <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
          )}
          {msg.replied && (
            <span className="text-[10px] text-green-400">✓</span>
          )}
        </div>
        <p className={`text-[11px] leading-relaxed pl-9 ${
          isAd ? 'text-slate-500' : 'text-slate-300'
        }`}>
          {msg.text}
        </p>
      </div>

      {/* Reply buttons — vertical stack, full width */}
      {hasReplies && !msg.replied && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {msg.replies!.map((reply) => (
            <button
              key={reply.id}
              onClick={(e) => {
                e.stopPropagation()
                onReply(reply.id, reply.text)
              }}
              style={{ height: '36px' }}
              className="w-full text-[11px] px-3 rounded-lg bg-blue-600/20 text-blue-200
                         border border-blue-500/30 hover:bg-blue-600/40 hover:border-blue-400/50
                         transition-colors active:scale-95 text-center"
            >
              {reply.text}
            </button>
          ))}
        </div>
      )}

      {/* Selected reply — right-aligned blue bubble */}
      {msg.replied && msg.replySelected && (
        <div className="px-3 pb-2.5 flex justify-end">
          <div className="bg-blue-600/50 text-blue-100 text-[11px] px-3 py-1.5 rounded-2xl rounded-br-sm
                          max-w-[75%] flex items-center gap-1.5">
            <span>{msg.replySelected}</span>
            <span className="text-green-300 text-[10px]">✓</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
