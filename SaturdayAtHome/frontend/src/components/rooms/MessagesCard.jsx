import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { MessageSquare } from 'lucide-react'

export default function MessagesCard({ isExpanded }) {
  const messageBubbles = useGameStore((s) => s.messageBubbles)
  const replyToBubble = useGameStore((s) => s.replyToBubble)
  const unreadCount = useGameStore((s) => s.unreadCount)

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 relative">
      <div className={`flex items-center gap-3 text-slate-700 ${isExpanded ? 'absolute top-6 left-6' : 'mb-4'}`}>
        <MessageSquare size={isExpanded ? 28 : 20} />
        <h2 className={`${isExpanded ? 'text-2xl' : 'text-lg'} font-black tracking-wider`}>Messages</h2>
        {unreadCount > 0 && (
          <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {unreadCount}
          </span>
        )}
      </div>

      {isExpanded ? (
        <div className="mt-12 w-full max-w-md space-y-4">
          {messageBubbles.length === 0 && (
            <p className="text-slate-400 text-center">No messages yet.</p>
          )}
          {messageBubbles.map((bubble) => (
            <motion.div
              key={bubble.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200"
            >
              <p className="text-sm text-slate-700 mb-3">{bubble.text}</p>
              {!bubble.replied ? (
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); replyToBubble(bubble.id, 'A') }}
                    className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    {bubble.optionA}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); replyToBubble(bubble.id, 'B') }}
                    className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold rounded-lg transition-colors"
                  >
                    {bubble.optionB}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-green-600 font-medium">✓ Replied</p>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <MessageSquare size={32} className="text-slate-300 mx-auto" />
          {unreadCount > 0 && (
            <p className="text-xs text-blue-500 font-bold mt-2">{unreadCount} new</p>
          )}
        </div>
      )}
    </div>
  )
}
