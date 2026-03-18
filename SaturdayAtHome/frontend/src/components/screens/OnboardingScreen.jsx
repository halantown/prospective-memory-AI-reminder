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
    body: 'Your main activity will be simple cognitive games — sorting emails, quick-reflex tasks, or answering quiz questions. These change as you move between rooms. Try your best, but don\'t worry about being perfect.',
    emoji: '🎮',
  },
  {
    title: 'Keyboard Controls',
    body: null,
    emoji: '⌨️',
    custom: true,
  },
  {
    title: 'Things to Remember',
    body: 'Before each block, you will learn two important tasks to remember. When the right moment comes during gameplay, you need to act on them by pressing the T key (or clicking the notification banner).',
    emoji: '📝',
  },
  {
    title: 'The Sidebar',
    body: 'On the right side of the screen, you will see a clock, a floor plan, and a set of household event icons. When an icon lights up and a banner appears, press T to respond if it\'s related to your remembered task.',
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

            {current.custom ? (
              <div className="text-left text-sm text-slate-600 leading-relaxed mb-6 space-y-2">
                <p className="mb-3">All gameplay uses keyboard controls:</p>
                <table className="w-full text-left border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="py-1.5 font-medium text-slate-700">Email Sorting</td><td><kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">1</kbd> Work · <kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">2</kbd> Personal · <kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">3</kbd> Spam</td></tr>
                    <tr><td className="py-1.5 font-medium text-slate-700">Quick Sort</td><td><kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">SPACE</kbd> for green circle · skip red</td></tr>
                    <tr><td className="py-1.5 font-medium text-slate-700">Trivia</td><td><kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">1</kbd> True · <kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">2</kbd> False</td></tr>
                    <tr><td className="py-1.5 font-medium text-slate-700">Trigger alert</td><td><kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">T</kbd> to respond</td></tr>
                    <tr><td className="py-1.5 font-medium text-slate-700">MCQ</td><td><kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">1</kbd> / <kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">2</kbd> / <kbd className="bg-slate-100 border px-1.5 rounded font-mono text-xs">3</kbd> to pick an answer</td></tr>
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-400">Mouse clicking still works as a fallback.</p>
              </div>
            ) : (
              <p className="text-slate-600 leading-relaxed mb-6">{current.body}</p>
            )}

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
