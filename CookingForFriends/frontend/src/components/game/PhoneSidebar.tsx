/** Phone sidebar — iPhone shell with chat-based message system (v5).
 *
 *  Redesigned from notification cards to a Discord/WhatsApp-style chat interface.
 *  Contact strip on the left, chat view on the right, bottom tab bar.
 *
 *  Components composed inside the iPhone shell:
 *    - ContactStrip (left avatar list)
 *    - ChatView (right chat thread)
 *    - PhoneTabBar (Chats / Recipe tabs)
 *    - KitchenTimerBanner (persistent cooking cue)
 *    - NotificationBanner (non-blocking, auto-dismiss)
 *    - RecipeTab (press-and-hold recipe viewer)
 */

import { useEffect, useMemo } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useSoundEffects } from '../../hooks/useSoundEffects'
import ContactStrip from './phone/ContactStrip'
import ChatView from './phone/ChatView'
import PhoneTabBar from './phone/PhoneTabBar'
import RecipeTab from './phone/RecipeTab'
import NotificationBanner from './phone/NotificationBanner'
import KitchenTimerBanner from './phone/KitchenTimerBanner'

export default function PhoneSidebar() {
  const gameClock = useGameStore((s) => s.gameClock)
  const banner = useGameStore((s) => s.phoneBanner)
  const activePhoneTab = useGameStore((s) => s.activePhoneTab)
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const activeCookingSteps = useGameStore((s) => s.activeCookingSteps)
  const missedStepFlashes = useGameStore((s) => s.missedStepFlashes)

  const play = useSoundEffects()

  const unreadCount = useMemo(
    () => phoneMessages.filter((m) => m.channel === 'chat' && !m.read).length,
    [phoneMessages],
  )
  const hasKitchenCue = activeCookingSteps.length > 0 || missedStepFlashes.length > 0

  // Play chime on new banner (visual pulse removed)
  useEffect(() => {
    if (banner) {
      play('phoneMessage')
    }
  }, [banner, play])

  return (
    <div className="h-full flex items-center justify-center bg-slate-900 p-3">
      {/* iPhone shell */}
      <div className="relative flex flex-col w-[440px] max-h-full items-center justify-center">
        {/* Outer bezel — pulse glow on new message */}
        <div
          className={`relative flex flex-col w-[380px] max-h-[calc(100vh-24px)] h-[840px] rounded-[40px] border-[3px]
                      bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl shadow-black/50
                      overflow-hidden transition-all duration-150
                      border-slate-600`}
        >
          {/* Dynamic Island */}
          <div className="flex justify-center pt-2 pb-1 relative z-10 shrink-0">
            <div className="w-[110px] h-[26px] bg-black rounded-full flex items-center justify-center gap-2">
              <div className="w-[8px] h-[8px] rounded-full bg-slate-700 ring-1 ring-slate-600" />
              <div className="w-[6px] h-[6px] rounded-full bg-slate-800" />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-2 text-[12px] shrink-0">
            <span className="text-white font-medium text-[13px]">{gameClock ?? '--:--'}</span>
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
          <NotificationBanner />

          {/* Screen content */}
          <div className="relative flex-1 flex flex-col overflow-hidden min-h-0">
            {/* App header */}
            <div className="px-4 py-1.5 border-b border-slate-700/50 flex items-center shrink-0">
              <h3 className="text-white text-sm font-semibold truncate">
                {activePhoneTab === 'chats' ? '💬 Chats' : '📖 Recipe'}
              </h3>
            </div>
            <KitchenTimerBanner />

            {/* Tab content */}
            {activePhoneTab === 'chats' ? (
              <div className={`flex-1 flex min-h-0 overflow-hidden ${hasKitchenCue ? 'pt-[var(--kitchen-banner-height)]' : ''}`}>
                <ContactStrip />
                <ChatView />
              </div>
            ) : (
              <div className={`flex-1 flex min-h-0 overflow-hidden ${hasKitchenCue ? 'pt-[var(--kitchen-banner-height)]' : ''}`}>
                <RecipeTab />
              </div>
            )}

            {/* Bottom tab bar */}
            <PhoneTabBar />
          </div>

          {/* Home indicator bar */}
          <div className="flex justify-center pb-2 pt-1 shrink-0">
            <div className="w-[120px] h-[4px] bg-white/20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
