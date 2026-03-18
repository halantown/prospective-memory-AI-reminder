import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import useWebSocket from '../hooks/useWebSocket'
import { useAudio } from '../hooks/useAudio'
import RobotSpeechToast from './game/RobotSpeechToast'
import HomeScene from './scene/HomeScene'
import MainPanel from './game/MainPanel'
import TransitionScreen from './game/TransitionScreen'
import HomeMapSidebar from './game/HomeMapSidebar'
import MCQOverlay from './pm/MCQOverlay'
import EncodingScreen from './screens/EncodingScreen'
import QuestionnaireScreen from './screens/QuestionnaireScreen'
import WelcomeScreen from './screens/WelcomeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import BlockEndScreen from './screens/BlockEndScreen'
import CompleteScreen from './screens/CompleteScreen'

export default function GameShell() {
  const phase = useGameStore(s => s.phase)
  const gameActive = useGameStore(s => s.gameActive)
  const mcqVisible = useGameStore(s => s.mcqVisible)
  const wsReconnecting = useGameStore(s => s.wsReconnecting)
  const triggerBannerVisible = useGameStore(s => s.triggerBannerVisible)
  const activeExecutionWindow = useGameStore(s => s.activeExecutionWindow)
  const clickActiveTrigger = useGameStore(s => s.clickActiveTrigger)

  useWebSocket()
  useAudio()

  // Global "T" key → respond to fired trigger
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === 't' && !useGameStore.getState().mcqVisible) {
        e.preventDefault()
        useGameStore.getState().clickActiveTrigger()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Full-screen phases (no sidebar)
  if (phase === 'welcome') return <WelcomeScreen />
  if (phase === 'onboarding') return <OnboardingScreen />
  if (phase === 'block_end') return <BlockEndScreen />
  if (phase === 'complete') return <CompleteScreen />

  const showGamePanel = phase === 'playing' && gameActive
  const showTransition = phase === 'playing' && !gameActive
  const showOverlay = showGamePanel || phase === 'encoding' || phase === 'questionnaire'

  return (
    <div className="w-full h-screen flex overflow-hidden bg-slate-100 font-sans text-slate-800">
      {wsReconnecting && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-center text-sm py-1 animate-pulse">
          Connection lost — reconnecting…
        </div>
      )}

      {/* Main panel area (~75%) */}
      <div className="flex-1 relative min-w-0">
        {/* z:0 — Home scene floor plan (always visible) */}
        <HomeScene />

        {/* z:5 — Dim overlay when panels are open */}
        <AnimatePresence>
          {showOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-[5] bg-black/10 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* z:10 — Floating game panel */}
        <AnimatePresence mode="wait">
          {showGamePanel && (
            <motion.div
              key="game-panel"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-10 flex items-center justify-center p-6 pointer-events-none"
            >
              <div
                className="w-[58%] h-[70%] rounded-2xl shadow-xl overflow-hidden flex flex-col pointer-events-auto"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.92)' }}
              >
                <MainPanel />
              </div>
            </motion.div>
          )}

          {/* z:10 — Transition narrative */}
          {showTransition && (
            <motion.div
              key="transition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
            >
              <TransitionScreen />
            </motion.div>
          )}
        </AnimatePresence>

        {/* z:20 — Robot speech toast */}
        <RobotSpeechToast />

        {/* z:15 — Encoding overlay on top of home scene */}
        <AnimatePresence>
          {phase === 'encoding' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[15] flex items-center justify-center bg-black/20"
            >
              <div
                className="w-[62%] max-h-[85%] rounded-2xl shadow-xl overflow-auto p-6"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
              >
                <EncodingScreen embedded />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* z:15 — Questionnaire overlay */}
        <AnimatePresence>
          {phase === 'questionnaire' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[15] flex items-center justify-center bg-black/20"
            >
              <div
                className="w-[62%] max-h-[85%] rounded-2xl shadow-xl overflow-auto p-6"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
              >
                <QuestionnaireScreen embedded />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* z:50 — MCQ overlay */}
        {mcqVisible && (
          <div className="absolute inset-0 z-50">
            <MCQOverlay />
          </div>
        )}

        {/* z:40 — Trigger banner notification */}
        <AnimatePresence>
          {triggerBannerVisible && activeExecutionWindow && !mcqVisible && (
            <motion.div
              initial={{ opacity: 0, y: -40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-40"
            >
              <button
                onClick={clickActiveTrigger}
                className="flex items-center gap-3 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-2xl border-2 border-amber-300 animate-pulse cursor-pointer transition-colors"
              >
                <span className="text-2xl">{activeExecutionWindow.triggerEmoji}</span>
                <div className="text-left">
                  <div className="font-bold text-sm">{activeExecutionWindow.triggerLabel}</div>
                  <div className="text-xs text-amber-100">Press <kbd className="bg-amber-700 px-1.5 py-0.5 rounded font-mono">T</kbd> or click to respond</div>
                </div>
                <span className="text-xl">⚡</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar (~25%, fixed width) */}
      <HomeMapSidebar />
    </div>
  )
}
