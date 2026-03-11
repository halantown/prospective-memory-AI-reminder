import { useRef, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { ClipboardList } from 'lucide-react'

export default function MessageLog() {
  const messages = useGameStore((s) => s.messages)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="absolute bottom-4 right-24 w-72 h-40 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex flex-col p-4 border border-white z-30 pointer-events-none">
      <div className="absolute top-3 right-4 text-slate-400">
        <ClipboardList size={16} />
      </div>
      <h3 className="text-slate-500 text-xs mb-2 border-b border-slate-200 pb-1.5 font-bold tracking-wider">
        Activity Log
      </h3>
      <div className="flex-1 overflow-y-auto text-[10px] font-normal text-slate-600 font-mono space-y-1.5 pr-1 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className="leading-relaxed">
            <span className="text-slate-400">[{msg.time}]</span> {msg.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
