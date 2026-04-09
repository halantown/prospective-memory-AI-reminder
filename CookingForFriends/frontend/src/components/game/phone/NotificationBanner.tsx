/** Notification banner — non-blocking, auto-dismiss top overlay.
 *
 *  Two roles:
 *  1. System notifications (weather, battery, delivery) — auto-dismiss 3s, no contact nav.
 *  2. Cross-contact chat alerts — shows sender + preview. Tap → navigate to contact.
 *
 *  Shows on lock screen too (on top of lock screen content). */

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'

const BANNER_DURATION = 3_000

export default function NotificationBanner() {
  const banner = useGameStore((s) => s.phoneBanner)
  const contacts = useGameStore((s) => s.contacts)
  const setBanner = useGameStore((s) => s.setPhoneBanner)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const setActiveContactId = useGameStore((s) => s.setActiveContactId)
  const setActivePhoneTab = useGameStore((s) => s.setActivePhoneTab)
  const wsSend = useGameStore((s) => s.wsSend)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss after BANNER_DURATION
  useEffect(() => {
    if (!banner) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setBanner(null), BANNER_DURATION)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [banner, setBanner])

  // Derive display info from banner
  const contact = banner?.channel === 'chat' && banner.contactId
    ? contacts.find((c) => c.id === banner.contactId)
    : null
  const displayName = contact?.name || banner?.sender || 'System'
  const displayAvatar = contact?.avatar || '📱'

  const handleClick = useCallback(() => {
    if (!banner) return
    if (timerRef.current) clearTimeout(timerRef.current)

    // If from a real contact (chat channel), navigate to that chat
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
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute top-0 left-0 right-0 z-30 rounded-b-2xl bg-slate-900/95 backdrop-blur-lg
                     border-b-2 border-blue-500/60 p-3 shadow-2xl shadow-blue-500/20 cursor-pointer"
          onClick={handleClick}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-500/70 flex items-center justify-center
                            text-sm font-bold text-white ring-2 ring-blue-400/40">
              {displayAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">{displayName}</span>
                <span className="text-[9px] text-blue-400 font-medium">now</span>
              </div>
              <p className="text-[11px] text-slate-200 truncate mt-0.5">{banner.text}</p>
            </div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse flex-shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
