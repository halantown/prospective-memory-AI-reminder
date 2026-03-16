import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail } from 'lucide-react'
import { useGameStore } from '../../store/gameStore'

const AVATAR_COLORS = {
  S: 'bg-violet-500',
  D: 'bg-sky-500',
  J: 'bg-teal-500',
  '🛵': 'bg-amber-500',
  '📦': 'bg-emerald-500',
  default: 'bg-slate-500',
}

export default function MailToast() {
  const mailToast = useGameStore((s) => s.mailToast)
  const dismissMailToast = useGameStore((s) => s.dismissMailToast)
  const openInboxFromToast = useGameStore((s) => s.openInboxFromToast)

  useEffect(() => {
    if (!mailToast) return
    const timer = setTimeout(() => dismissMailToast(), 3500)
    return () => clearTimeout(timer)
  }, [mailToast, dismissMailToast])

  return (
    <AnimatePresence>
      {mailToast && (
        <motion.button
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          onClick={() => openInboxFromToast()}
          className="absolute top-4 right-4 z-[70] w-80 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-3 shadow-xl text-left"
        >
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center ${AVATAR_COLORS[mailToast.avatar] || AVATAR_COLORS.default}`}>
              {mailToast.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Mail size={14} className="text-slate-500 shrink-0" />
                <span className="text-sm font-bold text-slate-800 truncate">{mailToast.from}</span>
              </div>
              <p className="text-xs text-slate-600 truncate">{mailToast.preview}</p>
            </div>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
