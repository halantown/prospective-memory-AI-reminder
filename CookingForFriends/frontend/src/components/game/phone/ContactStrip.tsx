/** Contact strip — narrow vertical avatar list (Discord-style). */

import { useMemo } from 'react'
import { useGameStore } from '../../../stores/gameStore'

export default function ContactStrip() {
  const contacts = useGameStore((s) => s.contacts)
  const activeContactId = useGameStore((s) => s.activeContactId)
  const setActiveContactId = useGameStore((s) => s.setActiveContactId)
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const wsSend = useGameStore((s) => s.wsSend)

  const unreadByContact = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const msg of phoneMessages) {
      if (msg.status === 'active' && !msg.read && msg.contactId !== '_system') {
        counts[msg.contactId] = (counts[msg.contactId] || 0) + 1
      }
    }
    return counts
  }, [phoneMessages])

  const handleContactClick = (contactId: string) => {
    const prev = activeContactId
    setActiveContactId(contactId)
    if (wsSend && prev !== contactId) {
      wsSend({
        type: 'phone_contact_switch',
        data: { fromContactId: prev, toContactId: contactId, timestamp: Date.now() / 1000 },
      })
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5 py-2 px-1 w-12 border-r border-slate-700/40 shrink-0 overflow-y-auto">
      {contacts.map((contact) => {
        const isActive = contact.id === activeContactId
        const unread = unreadByContact[contact.id] || 0

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
            <span className="text-base leading-none">{contact.avatar}</span>
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full
                              text-[8px] font-bold text-white flex items-center justify-center
                              ring-1 ring-slate-900">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
