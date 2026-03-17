import { motion } from 'framer-motion'

export default function CompleteScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center"
      >
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">
          Thank you for participating!
        </h2>
        <p className="text-slate-500 leading-relaxed mb-4">
          You have completed all blocks of the experiment. Your responses have been saved.
        </p>
        <p className="text-slate-400 text-sm">
          Please let the experimenter know you have finished.
        </p>
      </motion.div>
    </div>
  )
}
