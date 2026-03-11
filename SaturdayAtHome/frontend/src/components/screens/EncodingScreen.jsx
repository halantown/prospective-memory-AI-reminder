import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { CheckCircle, XCircle } from 'lucide-react'

const TASK_PAIRS = {
  1: {
    name: 'Medicine',
    taskA: {
      title: 'Task 1: Take Doxycycline',
      description:
        'After dinner tonight, take 1 Doxycycline tablet. It\'s in the round red bottle — your cardiologist prescribed it.',
      icon: '💊',
      highlight: 'Round red bottle · 1 tablet',
    },
    taskB: {
      title: 'Task 2: Take Vitamin C',
      description:
        'After dinner tonight, take 1 Vitamin C tablet. It\'s in the orange round bottle.',
      icon: '🍊',
      highlight: 'Orange round bottle · 1 tablet',
    },
    quiz: {
      question: 'What shape is the Doxycycline bottle?',
      options: ['Round', 'Square', 'Triangular'],
      correctIndex: 0,
    },
  },
  2: {
    name: 'Laundry',
    taskA: {
      title: 'Task 1: Sort Laundry',
      description:
        'When the washing machine finishes, hang the shirt on the drying rack and put jeans in the dryer.',
      icon: '👕',
      highlight: 'Shirt → rack · Jeans → dryer',
    },
    taskB: {
      title: 'Task 2: Bring Clothes Inside',
      description: 'Before dusk, bring only the shirt in from the balcony.',
      icon: '🌅',
      highlight: 'Only the shirt',
    },
    quiz: {
      question: 'Where should the shirt go after washing?',
      options: ['Drying rack', 'Dryer', 'Balcony'],
      correctIndex: 0,
    },
  },
  3: {
    name: 'Communication',
    taskA: {
      title: 'Task 1: Message Li Wei',
      description:
        'When Li Wei comes online, send him a message about the restaurant reservation (Option B).',
      icon: '📱',
      highlight: 'Li Wei · restaurant · Option B',
    },
    taskB: {
      title: 'Task 2: Answer the Door',
      description:
        'When the doorbell rings, tell the visitor "3pm" when asked about the meeting time.',
      icon: '🚪',
      highlight: 'Meeting at 3pm',
    },
    quiz: {
      question: 'Who should you message about the restaurant?',
      options: ['Li Wei', 'Zhang Fang', 'Wang Ming'],
      correctIndex: 0,
    },
  },
  4: {
    name: 'Chores',
    taskA: {
      title: 'Task 1: Slow Cooker',
      description:
        'When the slow cooker timer ends, turn off the heat and add black pepper seasoning.',
      icon: '🍲',
      highlight: 'Turn off · black pepper',
    },
    taskB: {
      title: 'Task 2: Take Out Rubbish',
      description: 'When the rubbish truck arrives, take the blue bag to the entrance.',
      icon: '🗑️',
      highlight: 'Blue bag',
    },
    quiz: {
      question: 'What seasoning goes in the slow cooker?',
      options: ['Black pepper', 'Salt', 'Cumin'],
      correctIndex: 0,
    },
  },
}

export default function EncodingScreen() {
  const taskPairId = useGameStore((s) => s.taskPairId)
  const confirmEncoding = useGameStore((s) => s.confirmEncoding)

  const [readAloud, setReadAloud] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizCorrect, setQuizCorrect] = useState(false)
  const [attempts, setAttempts] = useState(0)

  const pair = TASK_PAIRS[taskPairId] || TASK_PAIRS[1]

  const handleQuizSubmit = () => {
    if (selectedAnswer === null) return
    setQuizSubmitted(true)
    const correct = selectedAnswer === pair.quiz.correctIndex
    setQuizCorrect(correct)
    setAttempts((a) => a + 1)

    if (!correct) {
      setTimeout(() => {
        setQuizSubmitted(false)
        setSelectedAnswer(null)
        setReadAloud(false)
      }, 2000)
    }
  }

  const handleConfirm = () => {
    confirmEncoding(attempts)
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-3xl w-full mx-4"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-slate-800 mb-2">
            Before you start this round…
          </h1>
          <p className="text-slate-500">
            Read both tasks carefully. You will need to remember them during the game.
          </p>
        </div>

        {/* Task cards (removed from DOM after quiz correct + confirm) */}
        {!quizCorrect && (
          <div className="grid grid-cols-2 gap-6 mb-8">
            {[pair.taskA, pair.taskB].map((task, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.15 }}
                className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200"
              >
                <div className="text-4xl mb-3">{task.icon}</div>
                <h3 className="font-bold text-lg text-slate-800 mb-2">{task.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-3">
                  {task.description}
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-amber-800 text-xs font-bold">
                    Key detail: {task.highlight}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Step 1: Read aloud confirmation (experimenter button) */}
        {!readAloud && !quizCorrect && (
          <div className="text-center">
            <p className="text-slate-500 mb-4 text-sm">
              Experimenter: confirm the participant has read both tasks aloud.
            </p>
            <button
              onClick={() => setReadAloud(true)}
              className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg transition-colors"
            >
              ✓ Participant has read aloud
            </button>
          </div>
        )}

        {/* Step 2: Quiz */}
        {readAloud && !quizCorrect && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-slate-200 pt-6"
          >
            <h3 className="font-bold text-slate-800 mb-4">{pair.quiz.question}</h3>
            <div className="space-y-2 mb-4">
              {pair.quiz.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (!quizSubmitted) setSelectedAnswer(i)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    selectedAnswer === i
                      ? quizSubmitted
                        ? i === pair.quiz.correctIndex
                          ? 'border-green-500 bg-green-50 text-green-800'
                          : 'border-red-500 bg-red-50 text-red-800'
                        : 'border-indigo-500 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {opt}
                  {quizSubmitted && selectedAnswer === i && i !== pair.quiz.correctIndex && (
                    <XCircle size={18} className="inline ml-2 text-red-500" />
                  )}
                  {quizSubmitted && selectedAnswer === i && i === pair.quiz.correctIndex && (
                    <CheckCircle size={18} className="inline ml-2 text-green-500" />
                  )}
                </button>
              ))}
            </div>

            {quizSubmitted && !quizCorrect && (
              <p className="text-red-500 text-sm font-medium mb-2">
                Incorrect — please re-read the tasks and try again.
              </p>
            )}

            {!quizSubmitted && (
              <button
                onClick={handleQuizSubmit}
                disabled={selectedAnswer === null}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-lg transition-colors"
              >
                Check Answer
              </button>
            )}
          </motion.div>
        )}

        {/* Step 3: Correct → proceed (task cards already removed from DOM above) */}
        {quizCorrect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-green-700 font-bold mb-6">Correct! You're ready to start.</p>
            <button
              onClick={handleConfirm}
              className="px-12 py-4 bg-green-500 hover:bg-green-600 text-white font-black text-lg rounded-2xl shadow-lg transition-colors"
            >
              Start Round →
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
