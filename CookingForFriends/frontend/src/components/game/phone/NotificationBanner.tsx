/** Notification banner — non-blocking, auto-dismiss top overlay.
 *
 *  Two roles:
 *  1. System notifications (weather, battery, delivery) — auto-dismiss 5s, no contact nav.
 *  2. Cross-contact chat alerts — shows sender + preview. Tap → navigate to contact.
 *
 *  Floats as a rounded pill below the Dynamic Island. Shows on lock screen too. */

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'

const BANNER_DURATION = 5_000

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
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setBanner(null), BANNER_DURATION)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [banner, setBanner])

  const contact = banner?.channel === 'chat' && banner.contactId
    ? contacts.find((c) => c.id === banner.contactId)
    : null
  const displayName = contact?.name || banner?.sender || 'System'
  const displayAvatar = contact?.avatar || '📱'

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
                     rounded-2xl bg-slate-800/95 backdrop-blur-xl
                     border border-slate-600/50 shadow-2xl shadow-black/50
                     cursor-pointer overflow-hidden"
          onClick={handleClick}
        >
          {/* Accent line */}
          <div className="h-[2px] w-full bg-gradient-to-r from-blue-500/80 via-blue-400/60 to-transparent" />
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-700/80 flex items-center justify-center
                            text-lg flex-shrink-0 shadow-inner">
              {displayAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-[12px] font-semibold text-white leading-none">{displayName}</span>
                <span className="text-[9px] text-slate-400 font-medium">now</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">{banner.text}</p>
            </div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse flex-shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
