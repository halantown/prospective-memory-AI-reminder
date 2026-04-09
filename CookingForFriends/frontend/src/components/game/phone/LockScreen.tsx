/** Lock screen — two-section notification view (system / chat), iPhone-style. */

import { useMemo, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { PhoneMessage, Contact } from '../../../types'

export default function LockScreen({
  gameClock,
  onUnlock,
}: {
  gameClock: string
  onUnlock: () => void
}) {
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const contacts = useGameStore((s) => s.contacts)
  const lockSystemNotifications = useGameStore((s) => s.lockSystemNotifications)
  const setActiveContactId = useGameStore((s) => s.setActiveContactId)

  const [systemExpanded, setSystemExpanded] = useState(true)
  const [chatExpanded, setChatExpanded] = useState(true)

  // Group active unread messages by contact
  const contactPreviews = useMemo(() => {
    const grouped: Record<string, { contact: Contact | null; count: number; latest: PhoneMessage }> = {}
    const activeUnread = phoneMessages
      .filter((m) => m.channel === 'chat' && !m.read)
      .sort((a, b) => b.timestamp - a.timestamp)
    for (const msg of activeUnread) {
      const cid = msg.contactId || '_unknown'
      if (!grouped[cid]) {
        const contact = contacts.find((c) => c.id === cid) || null
        grouped[cid] = { contact, count: 0, latest: msg }
      }
      grouped[cid].count++
    }
    return Object.values(grouped).sort((a, b) => b.latest.timestamp - a.latest.timestamp)
  }, [phoneMessages, contacts])

  const handlePreviewClick = useCallback((contactId: string) => {
    setActiveContactId(contactId)
    onUnlock()
  }, [setActiveContactId, onUnlock])

  const hasSysNotifs = lockSystemNotifications.length > 0
  const hasChatNotifs = contactPreviews.length > 0

  return (
    <div
      className="flex-1 phone-locked flex flex-col px-3 pt-3 pb-4 overflow-y-auto"
      onClick={(e) => { e.stopPropagation(); onUnlock() }}
    >
      {/* Clock */}
      <div className="flex flex-col items-center mb-4">
        <div className="text-2xl mb-1">🔒</div>
        <div className="text-3xl font-extralight text-white tracking-wider">{gameClock ?? '--:--'}</div>
      </div>

      {/* System notifications section */}
      {hasSysNotifs && (
        <div className="mb-2">
          <button
            className="w-full flex items-center gap-2 mb-1.5"
            onClick={(e) => { e.stopPropagation(); setSystemExpanded((v) => !v) }}
          >
            <div className="flex-1 h-px bg-slate-600/60" />
            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest whitespace-nowrap">
              系统通知 {systemExpanded ? '▾' : '▸'}
            </span>
            <div className="flex-1 h-px bg-slate-600/60" />
          </button>
          <AnimatePresence initial={false}>
            {systemExpanded && (
              <motion.div
                key="sys"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden flex flex-col gap-1"
              >
                {lockSystemNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-start gap-2 rounded-xl px-2.5 py-2
                               bg-slate-800/55 border border-slate-700/35 backdrop-blur-sm"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-700/70 flex items-center justify-center
                                    text-xs flex-shrink-0 mt-0.5">
                      📱
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-semibold text-slate-300 leading-none">{notif.sender}</span>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{notif.text}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Chat messages section */}
      {hasChatNotifs && (
        <div className="mb-2">
          <button
            className="w-full flex items-center gap-2 mb-1.5"
            onClick={(e) => { e.stopPropagation(); setChatExpanded((v) => !v) }}
          >
            <div className="flex-1 h-px bg-slate-600/60" />
            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest whitespace-nowrap">
              消息 {chatExpanded ? '▾' : '▸'}
            </span>
            <div className="flex-1 h-px bg-slate-600/60" />
          </button>
          <AnimatePresence initial={false}>
            {chatExpanded && (
              <motion.div
                key="chat"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden flex flex-col gap-1"
              >
                {contactPreviews.map((preview) => (
                  <motion.div
                    key={preview.latest.contactId}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (preview.latest.contactId) handlePreviewClick(preview.latest.contactId)
                    }}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer
                               bg-slate-800/55 border border-slate-700/35 backdrop-blur-sm"
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-700/70 flex items-center justify-center
                                    text-xs flex-shrink-0">
                      {preview.contact?.avatar || '💬'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-slate-200 leading-none">
                          {preview.contact?.name || 'Unknown'}
                        </span>
                        {preview.count > 0 && (
                          <span className="text-[8px] bg-red-500 text-white px-1 rounded-full font-bold">
                            {preview.count}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                        {preview.latest.text}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Unlock prompt */}
      <div className="mt-auto flex flex-col items-center gap-1.5 cursor-pointer pt-2">
        <svg
          width="36" height="36" viewBox="0 0 48 48" fill="none"
          className="animate-bounce"
        >
          <circle cx="24" cy="14" r="6" fill="white" opacity="0.3" />
          <circle cx="24" cy="14" r="3.5" fill="white" opacity="0.5" />
          <path
            d="M24 20 L24 34 M24 34 L20 30 M24 34 L28 30"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            opacity="0.7"
          />
          <circle cx="24" cy="14" r="10" stroke="white" strokeWidth="1" opacity="0.15" />
          <circle cx="24" cy="14" r="14" stroke="white" strokeWidth="0.8" opacity="0.08" />
        </svg>
        <p className="text-white/70 text-sm font-medium tracking-wide animate-pulse">
          Tap to unlock
        </p>
      </div>
    </div>
  )
}
