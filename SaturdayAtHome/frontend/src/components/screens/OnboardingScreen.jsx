import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

const PAGES = [
  {
    title: 'Welcome to Saturday at Home!',
    body: 'In this experiment, you will simulate a typical Saturday at home. You will move through different rooms and complete everyday tasks while keeping track of some important things to remember.',
    emoji: '🏠',
  },
  {
    title: 'Main Tasks',
    body: 'Your main activity will be simple cognitive games — sorting emails, shopping for groceries, or answering quiz questions. These change as you move between rooms. Try your best, but don\'t worry about being perfect.',
    emoji: '🎮',
  },
  {
    title: 'Things to Remember',
    body: 'Before each block, you will learn two important tasks to remember. When the right moment comes during gameplay, you need to act on them by clicking the correct icon in the sidebar.',
    emoji: '📝',
  },
  {
    title: 'The Sidebar',
    body: 'On the right side of the screen, you will see a clock, a floor plan, and a set of household event icons. When an icon lights up, it means that event is happening. If it\'s related to your remembered task, click it!',
    emoji: '📋',
  },
  {
    title: 'The Robot Helper',
    body: 'A robot assistant called Pepper will occasionally say things to you. Sometimes it will make comments about what\'s happening around the house. Just listen and continue your tasks.',
    emoji: '🤖',
  },
  {
    title: 'Ready?',
    body: 'You will now learn the two tasks you need to remember for the first block. Pay close attention — you will be quizzed on them before the block starts.',
    emoji: '✅',
  },
]

export default function OnboardingScreen() {
  const setPhase = useGameStore(s => s.setPhase)
  const [page, setPage] = useState(0)

  const handleNext = () => {
    if (page < PAGES.length - 1) {
      setPage(p => p + 1)
    } else {
      setPhase('encoding')
    }
  }

  const current = PAGES[page]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-8 text-center"
          >
            <div className="text-5xl mb-4">{current.emoji}</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3">{current.title}</h2>
            <p className="text-slate-600 leading-relaxed mb-6">{current.body}</p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {PAGES.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === page ? 'bg-blue-500' : i < page ? 'bg-blue-200' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {page < PAGES.length - 1 ? 'Next' : 'Start Learning Tasks'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
