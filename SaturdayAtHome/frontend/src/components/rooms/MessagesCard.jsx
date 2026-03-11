import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Mail, Reply, Check, X, Clock } from 'lucide-react'

const AVATAR_COLORS = {
  '芳': 'bg-violet-500',
  '明': 'bg-sky-500',
  '王': 'bg-teal-500',
  '🛵': 'bg-amber-500',
  '📦': 'bg-emerald-500',
  default: 'bg-slate-500',
}

const MESSAGE_TIMEOUT_MS = 15000

const fmtTime = (ts) => {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function CountdownBar({ receivedAt, onExpire }) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - receivedAt
      const pct = Math.max(0, 100 - (elapsed / MESSAGE_TIMEOUT_MS) * 100)
      setProgress(pct)
      if (pct <= 0) { onExpire(); return }
      requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [receivedAt, onExpire])

  const color = progress > 50 ? 'bg-green-500' : progress > 25 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-colors ${color}`} style={{ width: `${progress}%` }} />
    </div>
  )
}

function EmailListItem({ email, isSelected, onSelect, onExpire }) {
  const color = AVATAR_COLORS[email.avatar] || AVATAR_COLORS.default
  const isActive = !email.replied && !email.expired
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(email.id) }}
      className={`w-full text-left px-3 py-2.5 flex gap-3 items-start rounded-lg transition-colors ${
        email.expired ? 'opacity-50 bg-red-50 border border-red-100' :
        isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
      }`}
    >
      <div className={`${color} w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5 ${email.expired ? 'grayscale' : ''}`}>
        {email.avatar}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm truncate ${
            email.expired ? 'text-red-400 line-through' :
            !email.read ? 'font-bold text-slate-900' : 'font-medium text-slate-600'
          }`}>
            {email.from}
          </span>
          <span className="text-[10px] text-slate-400 shrink-0 ml-auto">{fmtTime(email.receivedAt)}</span>
        </div>
        <p className={`text-xs truncate ${
          email.expired ? 'text-red-300' :
          !email.read ? 'font-semibold text-slate-700' : 'text-slate-500'
        }`}>
          {email.subject}
        </p>
        {isActive && (
          <div className="mt-1.5">
            <CountdownBar receivedAt={email.receivedAt} onExpire={() => onExpire(email.id)} />
          </div>
        )}
      </div>
      {email.expired && <X size={14} className="text-red-400 shrink-0 mt-3" />}
      {!email.read && !email.expired && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-3" />}
      {email.replied && <Check size={14} className={email.replyCorrect ? 'text-green-500' : 'text-yellow-500'} />}
    </button>
  )
}

function EmailDetail({ email, onReply, onExpire }) {
  const color = AVATAR_COLORS[email.avatar] || AVATAR_COLORS.default
  const isActive = !email.replied && !email.expired
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

      {/* Countdown bar for active messages */}
      {isActive && (
        <div className="px-5 py-1">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={12} className="text-slate-400" />
            <span className="text-[10px] text-slate-400 font-medium">Reply before time runs out</span>
          </div>
          <CountdownBar receivedAt={email.receivedAt} onExpire={() => onExpire(email.id)} />
        </div>
      )}

      {/* Reply actions */}
      <div className="border-t border-slate-200 px-5 py-3">
        {email.expired ? (
          <div className="flex items-center gap-2 text-red-500 text-sm font-medium py-2">
            <X size={16} />
            Expired — no reply sent (−2 points)
          </div>
        ) : !email.replied ? (
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onReply(email.id, 'option_a') }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-lg transition-colors"
            >
              <Reply size={14} />
              {email.option_a}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReply(email.id, 'option_b') }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold rounded-lg transition-colors"
            >
              <Reply size={14} />
              {email.option_b}
            </button>
          </div>
        ) : (
          <div className={`flex items-center gap-2 text-sm font-medium py-2 ${email.replyCorrect ? 'text-green-600' : 'text-yellow-600'}`}>
            <Check size={16} />
            已回复: "{email.replyChoice === 'option_a' ? email.option_a : email.option_b}"
            {email.replyCorrect ? ' ✓' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MessagesCard({ isExpanded }) {
  const messageBubbles = useGameStore((s) => s.messageBubbles)
  const replyToBubble = useGameStore((s) => s.replyToBubble)
  const expireMessage = useGameStore((s) => s.expireMessage)
  const selectEmail = useGameStore((s) => s.selectEmail)
  const selectedEmailId = useGameStore((s) => s.selectedEmailId)
  const unreadCount = useGameStore((s) => s.unreadCount)

  const activeCount = messageBubbles.filter(b => !b.replied && !b.expired).length
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
        <h3 className="text-base font-black tracking-wider text-slate-700">收件箱</h3>
        {messageBubbles.length > 0 && (
          <p className="text-[11px] text-slate-400">
            {messageBubbles.length} 封邮件{activeCount > 0 ? ` · ${activeCount} 待回复` : ''}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-white/80">
        <Mail size={22} className="text-slate-600" />
        <h2 className="text-lg font-black tracking-wider text-slate-700">收件箱</h2>
        {unreadCount > 0 && (
          <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {unreadCount} 新
          </span>
        )}
      </div>

      {messageBubbles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Mail size={40} className="opacity-30" />
          <p className="text-sm">暂无邮件</p>
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
                onExpire={expireMessage}
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
                <EmailDetail email={selectedEmail} onReply={replyToBubble} onExpire={expireMessage} />
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                选择一封邮件阅读
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
