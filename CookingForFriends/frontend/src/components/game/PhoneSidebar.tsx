/** Phone sidebar — iPhone shell with chat-based message system (v5).
 *
 *  Redesigned from notification cards to a Discord/WhatsApp-style chat interface.
 *  Contact strip on the left, chat view on the right, bottom tab bar.
 *
 *  Components composed inside the iPhone shell:
 *    - LockScreen (per-contact notification summaries)
 *    - ContactStrip (left avatar list)
 *    - ChatView (right chat thread)
 *    - PhoneTabBar (Chats / Recipe tabs)
 *    - KitchenTimerBanner (persistent cooking cue)
 *    - NotificationBanner (non-blocking, auto-dismiss)
 *    - RecipeTab (press-and-hold recipe viewer)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useSoundEffects } from '../../hooks/useSoundEffects'
import ContactStrip from './phone/ContactStrip'
import ChatView from './phone/ChatView'
import PhoneTabBar from './phone/PhoneTabBar'
import RecipeTab from './phone/RecipeTab'
import KitchenTimerBanner from './phone/KitchenTimerBanner'
import NotificationBanner from './phone/NotificationBanner'
import LockScreen from './phone/LockScreen'

const LOCK_TIMEOUT = 15_000

export default function PhoneSidebar() {
  const locked = useGameStore((s) => s.phoneLocked)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const gameClock = useGameStore((s) => s.gameClock)
  const wsSend = useGameStore((s) => s.wsSend)
  const banner = useGameStore((s) => s.phoneBanner)
  const activePhoneTab = useGameStore((s) => s.activePhoneTab)
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const contacts = useGameStore((s) => s.contacts)
  const activeContactId = useGameStore((s) => s.activeContactId)
  const setActiveContactId = useGameStore((s) => s.setActiveContactId)

  const lastActivityRef = useRef(Date.now())
  const play = useSoundEffects()

  const unreadCount = useMemo(
    () => phoneMessages.filter((m) => m.channel === 'chat' && !m.read).length,
    [phoneMessages],
  )

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

  // Play chime on new banner (visual pulse removed)
  useEffect(() => {
    if (banner) {
      play('phoneMessage')
    }
  }, [banner, play])

  const handleUnlock = useCallback(() => {
    setPhoneLocked(false)
    lastActivityRef.current = Date.now()
    if (wsSend) {
      wsSend({ type: 'phone_unlock', data: { timestamp: Date.now() / 1000 } })
    }

    // Auto-navigate to contact with oldest unread
    if (!activeContactId) {
      const unreadMessages = phoneMessages
        .filter((m) => m.channel === 'chat' && !m.read)
        .sort((a, b) => a.timestamp - b.timestamp)
      if (unreadMessages.length > 0 && unreadMessages[0].contactId) {
        setActiveContactId(unreadMessages[0].contactId)
      } else if (contacts.length > 0) {
        setActiveContactId(contacts[0].id)
      }
    }
  }, [setPhoneLocked, wsSend, activeContactId, phoneMessages, contacts, setActiveContactId])

  const handleInteraction = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  return (
    <div className="h-full flex items-center justify-center bg-slate-900 p-3">
      {/* iPhone shell */}
      <div className="relative flex flex-col w-[440px] h-[820px] items-center justify-center">
        {/* Outer bezel — pulse glow on new message */}
        <div
          className={`relative flex flex-col w-[380px] h-[800px] rounded-[40px] border-[3px]
                      bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl shadow-black/50
                      overflow-hidden transition-all duration-150
                      border-slate-600`}
          onPointerDownCapture={handleInteraction}
        >
          {/* Notification Banner (z-30, on top of everything including lock screen) */}
          <NotificationBanner />

          {/* Dynamic Island */}
          <div className="flex justify-center pt-2 pb-1 relative z-10">
            <div className="w-[110px] h-[26px] bg-black rounded-full flex items-center justify-center gap-2">
              <div className="w-[8px] h-[8px] rounded-full bg-slate-700 ring-1 ring-slate-600" />
              <div className="w-[6px] h-[6px] rounded-full bg-slate-800" />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-2 text-[12px]">
            <span className={`text-white font-medium text-[13px] ${locked ? 'invisible' : ''}`}>{gameClock ?? '--:--'}</span>
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

          <KitchenTimerBanner />

          {/* Screen content */}
          {locked ? (
            <LockScreen gameClock={gameClock ?? '--:--'} onUnlock={handleUnlock} />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* App header */}
              <div className="px-4 py-1.5 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                <h3 className="text-white text-sm font-semibold">
                  {activePhoneTab === 'chats' ? '💬 Chats' : '📖 Recipe'}
                </h3>
                <button
                  onClick={() => setPhoneLocked(true)}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors px-2 py-1 rounded"
                >
                  🔒 Lock
                </button>
              </div>

              {/* Tab content */}
              {activePhoneTab === 'chats' ? (
                <div className="flex-1 flex overflow-hidden">
                  <ContactStrip />
                  <ChatView />
                </div>
              ) : (
                <RecipeTab />
              )}

              {/* Bottom tab bar */}
              <PhoneTabBar />
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
