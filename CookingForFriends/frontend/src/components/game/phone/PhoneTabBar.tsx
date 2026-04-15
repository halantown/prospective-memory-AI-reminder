/** Phone tab bar — bottom navigation: Chats and Recipe tabs. */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'

export default function PhoneTabBar() {
  const activeTab = useGameStore((s) => s.activePhoneTab)
  const setActiveTab = useGameStore((s) => s.setActivePhoneTab)
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const recipeTabBounce = useGameStore((s) => s.recipeTabBounce)
  const wsSend = useGameStore((s) => s.wsSend)

  const totalUnread = useMemo(() => {
    return phoneMessages.filter((m) => m.channel === 'chat' && !m.read).length
  }, [phoneMessages])

  const handleTabClick = (tab: 'chats' | 'recipe') => {
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
      <button
        onClick={() => handleTabClick('chats')}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors relative
                    ${activeTab === 'chats' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'}`}
      >
        <span className="text-base">💬</span>
        <span className="text-[12px] font-medium">Chats</span>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 right-1 bg-red-500 text-white text-[7px] font-bold
                          px-1 py-0 rounded-full min-w-[14px] text-center">
            {totalUnread}
          </span>
        )}
        {activeTab === 'chats' && (
          <motion.div
            layoutId="phoneTabIndicator"
            className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-400 rounded-full"
          />
        )}
      </button>

      {/* Recipe tab */}
      <motion.button
        onClick={() => handleTabClick('recipe')}
        animate={recipeTabBounce ? { scale: [1, 1.2, 1, 1.15, 1] } : {}}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors relative
                    ${activeTab === 'recipe' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-300'}`}
      >
        <span className="text-base">📖</span>
        <span className="text-[12px] font-medium">Recipe</span>
        {activeTab === 'recipe' && (
          <motion.div
            layoutId="phoneTabIndicator"
            className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-400 rounded-full"
          />
        )}
      </motion.button>
    </div>
  )
}
