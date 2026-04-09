/** Lock screen — updated with per-contact notification summaries. */

import { useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { PhoneMessage, Contact } from '../../../types'

const MAX_LOCK_PREVIEWS = 4

export default function LockScreen({
  gameClock,
  onUnlock,
}: {
  gameClock: string
  onUnlock: () => void
}) {
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const contacts = useGameStore((s) => s.contacts)
  const setActiveContactId = useGameStore((s) => s.setActiveContactId)

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

    return Object.values(grouped)
      .sort((a, b) => b.latest.timestamp - a.latest.timestamp)
      .slice(0, MAX_LOCK_PREVIEWS)
  }, [phoneMessages, contacts])

  const handlePreviewClick = useCallback((contactId: string) => {
    setActiveContactId(contactId)
    onUnlock()
  }, [setActiveContactId, onUnlock])

  return (
    <div
      className="flex-1 phone-locked flex flex-col px-4 pt-3 pb-4"
      onClick={(e) => { e.stopPropagation(); onUnlock() }}
    >
      {/* Clock */}
      <div className="flex flex-col items-center mb-4">
        <div className="text-2xl mb-1">🔒</div>
        <div className="text-3xl font-extralight text-white tracking-wider">{gameClock ?? '--:--'}</div>
      </div>

      {/* Per-contact notification previews */}
      {contactPreviews.length > 0 && (
        <div className="flex flex-col gap-1.5 w-full">
          <AnimatePresence>
            {contactPreviews.map((preview, idx) => (
              <motion.div
                key={preview.latest.contactId || idx}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.04, type: 'spring', stiffness: 280, damping: 22 }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (preview.latest.contactId) handlePreviewClick(preview.latest.contactId)
                }}
                className="flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer
                           bg-slate-800/60 border border-slate-700/40 backdrop-blur-sm"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600/50 flex items-center justify-center
                                text-xs font-bold text-blue-100 flex-shrink-0">
                  {preview.contact?.avatar || '💬'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-blue-300 leading-none">
                      {preview.contact?.name || 'Unknown'}
                    </span>
                    {preview.count > 1 && (
                      <span className="text-[8px] bg-red-500/80 text-white px-1 rounded-full font-bold">
                        {preview.count}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-300 truncate leading-tight mt-0.5">
                    {preview.latest.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Unlock prompt */}
      <div className="mt-auto flex flex-col items-center gap-1.5 cursor-pointer">
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
