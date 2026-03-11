import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Mail, Reply, Check } from 'lucide-react'

const AVATAR_COLORS = {
  S: 'bg-violet-500',
  M: 'bg-rose-500',
  D: 'bg-sky-500',
  default: 'bg-slate-500',
}

const fmtTime = (ts) => {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function EmailListItem({ email, isSelected, onSelect }) {
  const color = AVATAR_COLORS[email.avatar] || AVATAR_COLORS.default
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(email.id) }}
      className={`w-full text-left px-3 py-2.5 flex gap-3 items-start rounded-lg transition-colors ${
        isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
      }`}
    >
      <div className={`${color} w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5`}>
        {email.avatar}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm truncate ${!email.read ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
            {email.from}
          </span>
          <span className="text-[10px] text-slate-400 shrink-0 ml-auto">{fmtTime(email.receivedAt)}</span>
        </div>
        <p className={`text-xs truncate ${!email.read ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>
          {email.subject}
        </p>
      </div>
      {!email.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-3" />}
      {email.replied && <Check size={14} className="text-green-500 shrink-0 mt-3" />}
    </button>
  )
}

function EmailDetail({ email, onReply }) {
  const color = AVATAR_COLORS[email.avatar] || AVATAR_COLORS.default
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-lg font-bold text-slate-800 mb-2">{email.subject}</h3>
        <div className="flex items-center gap-3">
          <div className={`${color} w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold`}>
            {email.avatar}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">{email.from}</p>
            <p className="text-xs text-slate-400">{fmtTime(email.receivedAt)}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-4 overflow-auto">
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{email.body}</p>
      </div>

      {/* Reply actions */}
      <div className="border-t border-slate-200 px-5 py-3">
        {!email.replied ? (
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onReply(email.id, 'A') }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-lg transition-colors"
            >
              <Reply size={14} />
              {email.option_a}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReply(email.id, 'B') }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold rounded-lg transition-colors"
            >
              <Reply size={14} />
              {email.option_b}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium py-2">
            <Check size={16} />
            Replied: "{email.replyChoice === 'A' ? email.option_a : email.option_b}"
          </div>
        )}
      </div>
    </div>
  )
}

export default function MessagesCard({ isExpanded }) {
  const messageBubbles = useGameStore((s) => s.messageBubbles)
  const replyToBubble = useGameStore((s) => s.replyToBubble)
  const selectEmail = useGameStore((s) => s.selectEmail)
  const selectedEmailId = useGameStore((s) => s.selectedEmailId)
  const unreadCount = useGameStore((s) => s.unreadCount)

  const selectedEmail = messageBubbles.find((e) => e.id === selectedEmailId) || messageBubbles[messageBubbles.length - 1]

  if (!isExpanded) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-4 gap-2">
        <div className="relative">
          <Mail size={28} className="text-slate-400" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-3 bg-blue-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
        <h3 className="text-base font-black tracking-wider text-slate-700">Inbox</h3>
        {messageBubbles.length > 0 && (
          <p className="text-[11px] text-slate-400">{messageBubbles.length} emails</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-white/80">
        <Mail size={22} className="text-slate-600" />
        <h2 className="text-lg font-black tracking-wider text-slate-700">Inbox</h2>
        {unreadCount > 0 && (
          <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {unreadCount} new
          </span>
        )}
      </div>

      {messageBubbles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Mail size={40} className="opacity-30" />
          <p className="text-sm">No emails yet</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Email list */}
          <div className="w-2/5 border-r border-slate-200 overflow-y-auto p-2 space-y-1 bg-white/50">
            {[...messageBubbles].reverse().map((email) => (
              <EmailListItem
                key={email.id}
                email={email}
                isSelected={selectedEmail?.id === email.id}
                onSelect={selectEmail}
              />
            ))}
          </div>

          {/* Email content */}
          <div className="flex-1 bg-white overflow-hidden">
            {selectedEmail ? (
              <motion.div
                key={selectedEmail.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full"
              >
                <EmailDetail email={selectedEmail} onReply={replyToBubble} />
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Select an email to read
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
