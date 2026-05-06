/** Notification banner — non-blocking, auto-dismiss top overlay.
 *
 *  Two roles:
 *  1. System notifications (weather, battery, delivery) — auto-dismiss 3s, no contact nav.
 *  2. Cross-contact chat alerts — shows sender + preview. Tap → navigate to contact.
 *
 *  Floats as a rounded pill below the Dynamic Island. Shows on lock screen too. */

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'

const CHAT_BANNER_DURATION = 5_000
const SYSTEM_BANNER_DURATION = 3_000

export default function NotificationBanner() {
  const banner = useGameStore((s) => s.phoneBanner)
  const contacts = useGameStore((s) => s.contacts)
  const setBanner = useGameStore((s) => s.setPhoneBanner)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const setActiveContactId = useGameStore((s) => s.setActiveContactId)
  const setActivePhoneTab = useGameStore((s) => s.setActivePhoneTab)
  const wsSend = useGameStore((s) => s.wsSend)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!banner) return
    const duration = banner.channel === 'notification' ? SYSTEM_BANNER_DURATION : CHAT_BANNER_DURATION
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setBanner(null), duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [banner, setBanner])

  const contact = banner?.channel === 'chat' && banner.contactId
    ? contacts.find((c) => c.id === banner.contactId)
    : null
  const displayName = contact?.name || banner?.sender || 'System'
  const isSystemNotification = banner?.channel === 'notification'
  const displayAvatar = contact?.avatar || '📱'
  const duration = isSystemNotification ? SYSTEM_BANNER_DURATION : CHAT_BANNER_DURATION

  const handleClick = useCallback(() => {
    if (!banner) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (banner.channel === 'chat' && banner.contactId) {
      setPhoneLocked(false)
      setActivePhoneTab('chats')
      setActiveContactId(banner.contactId)
      if (wsSend) {
        wsSend({ type: 'phone_unlock', data: { timestamp: Date.now() / 1000 } })
      }
    }
    setBanner(null)
  }, [banner, setBanner, setPhoneLocked, setActiveContactId, setActivePhoneTab, wsSend])

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={`banner-${banner.id}`}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          className="absolute top-[52px] left-3 right-3 z-30
                     rounded-xl shadow-xl shadow-black/40
                     border cursor-pointer overflow-hidden"
          style={{
            backgroundColor: isSystemNotification ? 'rgba(30, 41, 59, 0.96)' : '#ffffff',
            borderColor: isSystemNotification ? 'rgba(148, 163, 184, 0.35)' : 'rgba(255, 255, 255, 0.2)',
          }}
          onClick={handleClick}
        >
          {/* Countdown bar — shrinks from full width to 0 over BANNER_DURATION */}
          <motion.div
            key={`bar-${banner.id}`}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className={`h-[3px] rounded-t-xl ${isSystemNotification ? 'bg-slate-400' : 'bg-blue-500'}`}
          />
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center
                            text-xl flex-shrink-0 shadow-sm">
              {displayAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className={`text-[13px] font-semibold leading-none ${isSystemNotification ? 'text-slate-100' : 'text-slate-900'}`}>{displayName}</span>
                <span className={`text-[10px] font-medium ${isSystemNotification ? 'text-slate-400' : 'text-slate-400'}`}>now</span>
              </div>
              <p className={`text-[13px] leading-snug line-clamp-2 ${isSystemNotification ? 'text-slate-300' : 'text-slate-600'}`}>{banner.text}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
