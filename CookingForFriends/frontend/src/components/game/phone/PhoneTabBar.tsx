/** Phone tab bar — bottom navigation: Chats and Recipe tabs. */

import { useEffect, useRef, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'

const BOUNCE_DURATION_MS = 2000
const CHATS_BOUNCE_COOLDOWN_MS = 60_000
const CHATS_UNREAD_THRESHOLD = 3

const BOUNCE_KEYFRAMES = { y: [0, -16, 0, -10, 0, -4, 0] }
const BOUNCE_TRANSITION = { duration: BOUNCE_DURATION_MS / 1000, ease: 'easeInOut' as const }

export default function PhoneTabBar() {
  const activeTab = useGameStore((s) => s.activePhoneTab)
  const setActiveTab = useGameStore((s) => s.setActivePhoneTab)
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const recipeTabBounce = useGameStore((s) => s.recipeTabBounce)
  const setRecipeTabBounce = useGameStore((s) => s.setRecipeTabBounce)
  const phoneTabPrompt = useGameStore((s) => s.phoneTabPrompt)
  const setPhoneTabPrompt = useGameStore((s) => s.setPhoneTabPrompt)
  const wsSend = useGameStore((s) => s.wsSend)

  const totalUnread = useMemo(() => {
    return phoneMessages.filter((m) => m.channel === 'chat' && !m.read).length
  }, [phoneMessages])

  // ── Chats bounce: ≥3 unread, rate-limited 60s ──────────────────────────────
  const [chatsBouncing, setChatsBouncing] = useState(false)
  const lastChatsBounceAt = useRef<number>(0)
  const chatsBounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (
      totalUnread >= CHATS_UNREAD_THRESHOLD &&
      activeTab !== 'chats' &&
      Date.now() - lastChatsBounceAt.current > CHATS_BOUNCE_COOLDOWN_MS
    ) {
      lastChatsBounceAt.current = Date.now()
      setChatsBouncing(true)
      if (chatsBounceTimer.current) clearTimeout(chatsBounceTimer.current)
      chatsBounceTimer.current = setTimeout(() => setChatsBouncing(false), BOUNCE_DURATION_MS)
    }
    return () => {
      if (chatsBounceTimer.current) clearTimeout(chatsBounceTimer.current)
    }
  }, [totalUnread, activeTab])

  // ── Recipe bounce: auto-reset after 2s ──────────────────────────────────────
  useEffect(() => {
    if (!recipeTabBounce) return
    const t = setTimeout(() => setRecipeTabBounce(false), BOUNCE_DURATION_MS)
    return () => clearTimeout(t)
  }, [recipeTabBounce, setRecipeTabBounce])

  const handleTabClick = (tab: 'chats' | 'recipe') => {
    if (phoneTabPrompt === tab) {
      setPhoneTabPrompt(null)
    }
    if (tab === activeTab) return
    setActiveTab(tab)
    if (wsSend) {
      wsSend({
        type: 'phone_tab_switch',
        data: { tab, timestamp: Date.now() / 1000 },
      })
    }
  }

  return (
    <div className="flex items-center justify-around border-t border-slate-700/40 py-1.5 shrink-0 bg-slate-800/60">
      {/* Chats tab */}
      <motion.button
        onClick={() => handleTabClick('chats')}
        animate={chatsBouncing || phoneTabPrompt === 'chats' ? BOUNCE_KEYFRAMES : {}}
        transition={phoneTabPrompt === 'chats' ? { ...BOUNCE_TRANSITION, repeat: Infinity, repeatDelay: 0.2 } : BOUNCE_TRANSITION}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors relative
                    ${activeTab === 'chats' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'}
                    ${phoneTabPrompt === 'chats' ? 'bg-amber-400/15 ring-2 ring-amber-300/70 shadow-[0_0_16px_rgba(251,191,36,0.55)]' : ''}`}
      >
        <span className="text-base">💬</span>
        <span className="text-[12px] font-medium">Chats</span>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 right-1 bg-red-500 text-white text-[7px] font-bold
                          px-1 py-0 rounded-full min-w-[14px] text-center">
            {totalUnread}
          </span>
        )}
        {(activeTab === 'chats' || phoneTabPrompt === 'chats') && (
          <motion.div
            layoutId="phoneTabIndicator"
            className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${phoneTabPrompt === 'chats' ? 'bg-amber-300' : 'bg-blue-400'}`}
          />
        )}
      </motion.button>

      {/* Recipe tab */}
      <motion.button
        onClick={() => handleTabClick('recipe')}
        animate={recipeTabBounce || phoneTabPrompt === 'recipe' ? BOUNCE_KEYFRAMES : {}}
        transition={phoneTabPrompt === 'recipe' ? { ...BOUNCE_TRANSITION, repeat: Infinity, repeatDelay: 0.2 } : BOUNCE_TRANSITION}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors relative
                    ${activeTab === 'recipe' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'}
                    ${phoneTabPrompt === 'recipe' ? 'bg-amber-400/15 ring-2 ring-amber-300/70 shadow-[0_0_16px_rgba(251,191,36,0.55)]' : ''}`}
      >
        <span className="text-base">📖</span>
        <span className="text-[12px] font-medium">Recipe</span>
        {(activeTab === 'recipe' || phoneTabPrompt === 'recipe') && (
          <motion.div
            layoutId="phoneTabIndicator"
            className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${phoneTabPrompt === 'recipe' ? 'bg-amber-300' : 'bg-blue-400'}`}
          />
        )}
      </motion.button>
    </div>
  )
}
