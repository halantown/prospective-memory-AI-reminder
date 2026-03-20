/** Phone sidebar — notifications, lock/unlock, ads + messages. */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'

const LOCK_TIMEOUT = 30_000 // 30s

export default function PhoneSidebar() {
  const notifications = useGameStore((s) => s.phoneNotifications)
  const locked = useGameStore((s) => s.phoneLocked)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const gameClock = useGameStore((s) => s.gameClock)
  const wsSend = useGameStore((s) => s.wsSend)

  const lastActivityRef = useRef(Date.now())

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

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div
      className="h-full flex flex-col bg-slate-950 border-l border-slate-700"
      onClick={handleInteraction}
    >
      {/* Phone frame header */}
      <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <span className="text-xs text-slate-400">📱 Phone</span>
        <span className="text-xs text-slate-500">{gameClock}</span>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
      </div>

      {/* Lock screen or content */}
      {locked ? (
        <div
          className="flex-1 phone-locked flex flex-col items-center justify-center cursor-pointer"
          onClick={handleUnlock}
        >
          <div className="text-4xl mb-4">🔒</div>
          <div className="text-3xl font-light text-white mb-1">{gameClock}</div>
          <p className="text-slate-400 text-xs mt-4">Tap to unlock</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notifications.length === 0 ? (
            <p className="text-slate-500 text-xs text-center mt-8">No messages yet</p>
          ) : (
            <AnimatePresence>
              {[...notifications].reverse().map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg p-3 border ${
                    notif.is_ad
                      ? 'bg-yellow-950/30 border-yellow-800/50'
                      : notif.read
                      ? 'bg-slate-800/50 border-slate-700'
                      : 'bg-blue-950/30 border-blue-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {notif.is_ad ? '📢' : '💬'}
                    </span>
                    <span className={`text-xs font-medium ${
                      notif.is_ad ? 'text-yellow-400' : 'text-blue-300'
                    }`}>
                      {notif.sender}
                    </span>
                    {!notif.read && (
                      <span className="w-2 h-2 bg-blue-400 rounded-full ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{notif.preview}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  )
}
