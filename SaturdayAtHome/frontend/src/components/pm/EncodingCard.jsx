import { motion } from 'framer-motion'

export default function EncodingCard({ task, onNext }) {
  if (!task) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg w-full bg-white rounded-xl shadow-lg p-6 mx-auto"
    >
      <div className="text-xs text-blue-600 uppercase tracking-wider font-medium mb-3">
        Remember this task
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-3">{task.task_id?.replace('_', ' ') || 'Task'}</h3>

      <p className="text-base text-slate-600 leading-relaxed mb-4">
        {task.encoding?.text || task.instruction || ''}
      </p>

      {task.trigger?.description && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="text-xs text-amber-600 font-medium mb-1">When to act:</div>
          <p className="text-sm text-amber-800">{task.trigger.description}</p>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        I understand — Continue
      </button>
    </motion.div>
  )
}
