/** Contact strip — narrow vertical avatar list (Discord-style) with 3-state badges. */

import { useMemo } from 'react'
import { useGameStore } from '../../../stores/gameStore'

/**
 * Badge states per contact:
 *  - 'count' (number badge): unread messages the participant hasn't seen yet
 *  - 'dot' (red dot): all messages read but some questions unanswered
 *  - 'none': all messages read and answered
 */
type BadgeState = { type: 'count'; count: number } | { type: 'dot' } | { type: 'none' }

export default function ContactStrip() {
  const contacts = useGameStore((s) => s.contacts)
  const activeContactId = useGameStore((s) => s.activeContactId)
  const setActiveContactId = useGameStore((s) => s.setActiveContactId)
  const markContactMessagesRead = useGameStore((s) => s.markContactMessagesRead)
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const wsSend = useGameStore((s) => s.wsSend)

  const badgeByContact = useMemo(() => {
    const badges: Record<string, BadgeState> = {}
    for (const contact of contacts) {
      const msgs = phoneMessages.filter(
        (m) => m.channel === 'chat' && m.contactId === contact.id
      )
      const unreadCount = msgs.filter((m) => !m.read).length
      if (unreadCount > 0) {
        badges[contact.id] = { type: 'count', count: unreadCount }
      } else {
        const hasUnanswered = msgs.some((m) => m.correctChoice && !m.answered && !m.expired)
        badges[contact.id] = hasUnanswered ? { type: 'dot' } : { type: 'none' }
      }
    }
    return badges
  }, [contacts, phoneMessages])

  const handleContactClick = (contactId: string) => {
    const prev = activeContactId
    setActiveContactId(contactId)
    markContactMessagesRead(contactId)
    if (wsSend && prev !== contactId) {
      wsSend({
        type: 'phone_contact_switch',
        data: { fromContactId: prev, toContactId: contactId, timestamp: Date.now() / 1000 },
      })
    }
  }

  // Only show contacts who have at least one message
  const visibleContacts = useMemo(
    () => contacts.filter((c) => phoneMessages.some((m) => m.channel === 'chat' && m.contactId === c.id)),
    [contacts, phoneMessages]
  )

  return (
    <div className="flex flex-col items-center gap-1.5 py-2 px-1 w-[54px] shrink-0 overflow-y-auto">
      {visibleContacts.length === 0 && (
        <div className="mt-2 flex flex-col items-center gap-2 opacity-45">
          <div className="h-9 w-9 rounded-full border border-slate-700/60 bg-slate-800/35" />
          <div className="h-9 w-9 rounded-full border border-slate-700/45 bg-slate-800/25" />
          <div className="h-9 w-9 rounded-full border border-slate-700/30 bg-slate-800/15" />
        </div>
      )}
      {visibleContacts.map((contact) => {
        const isActive = contact.id === activeContactId
        const badge = badgeByContact[contact.id] || { type: 'none' }

        return (
          <button
            key={contact.id}
            onClick={() => handleContactClick(contact.id)}
            className={`relative w-9 h-9 rounded-full flex items-center justify-center text-sm
                        transition-all duration-150 shrink-0
                        ${isActive
                          ? 'bg-blue-600/50 ring-2 ring-blue-400/60 scale-105'
                          : 'bg-slate-700/50 hover:bg-slate-600/50'
                        }`}
            title={contact.name}
          >
            <span className="text-[18px] leading-none">{contact.avatar}</span>
            {/* Number badge: unread unseen messages */}
            {badge.type === 'count' && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full
                              text-[8px] font-bold text-white flex items-center justify-center
                              ring-1 ring-slate-900">
                {badge.count > 9 ? '9+' : badge.count}
              </span>
            )}
            {/* Red dot: read but unanswered questions */}
            {badge.type === 'dot' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full
                              ring-1 ring-slate-900" />
            )}
          </button>
        )
      })}
    </div>
  )
}
