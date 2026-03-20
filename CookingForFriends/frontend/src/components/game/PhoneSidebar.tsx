/** Phone sidebar — iPhone shell with notifications, lock/unlock, ads + messages. */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'

const LOCK_TIMEOUT = 30_000 // 30s

export default function PhoneSidebar() {
  const notifications = useGameStore((s) => s.phoneNotifications)
  const locked = useGameStore((s) => s.phoneLocked)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const markNotificationRead = useGameStore((s) => s.markNotificationRead)
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
    <div className="h-full flex items-center justify-center bg-slate-900 p-3">
      {/* iPhone shell */}
      <div className="relative flex flex-col w-full max-w-[320px] h-full max-h-[680px]">
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
              <div className="px-4 py-2 border-b border-slate-700/50">
                <h3 className="text-white text-sm font-semibold">💬 Messages</h3>
              </div>

              {/* Notification feed */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <span className="text-3xl mb-2">📭</span>
                    <p className="text-xs">No messages yet</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {[...notifications].reverse().map((notif) => (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          if (!notif.read) {
                            markNotificationRead(notif.id)
                            if (wsSend) {
                              wsSend({
                                type: 'phone_action',
                                data: { action: 'read_notification', notif_id: notif.id, timestamp: Date.now() / 1000 },
                              })
                            }
                          }
                        }}
                        className={`rounded-2xl p-3 border cursor-pointer transition-colors ${
                          notif.is_ad
                            ? 'bg-yellow-950/30 border-yellow-800/40'
                            : notif.read
                            ? 'bg-slate-800/40 border-slate-700/50'
                            : 'bg-blue-950/30 border-blue-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                            ${notif.is_ad ? 'bg-yellow-900/50' : 'bg-blue-900/50'}`}>
                            {notif.is_ad ? '📢' : '💬'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-semibold block ${
                              notif.is_ad ? 'text-yellow-400' : 'text-blue-300'
                            }`}>
                              {notif.sender}
                            </span>
                            <p className="text-[11px] text-slate-300 truncate">{notif.preview}</p>
                          </div>
                          {!notif.read && (
                            <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
                          )}
                        </div>
                      </motion.div>
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
