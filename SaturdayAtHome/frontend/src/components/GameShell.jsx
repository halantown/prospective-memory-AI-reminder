import { useGameStore } from '../store/gameStore'
import useWebSocket from '../hooks/useWebSocket'
import { useAudio } from '../hooks/useAudio'
import MainPanel from './game/MainPanel'
import RoomBackground from './game/RoomBackground'
import RobotSpeechToast from './game/RobotSpeechToast'
import HomeMapSidebar from './game/HomeMapSidebar'
import MCQOverlay from './pm/MCQOverlay'
import WelcomeScreen from './screens/WelcomeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import EncodingScreen from './screens/EncodingScreen'
import QuestionnaireScreen from './screens/QuestionnaireScreen'
import BlockEndScreen from './screens/BlockEndScreen'
import CompleteScreen from './screens/CompleteScreen'

export default function GameShell() {
  const phase = useGameStore(s => s.phase)
  const mcqVisible = useGameStore(s => s.mcqVisible)
  const wsReconnecting = useGameStore(s => s.wsReconnecting)

  useWebSocket()
  useAudio()

  // Full-screen phases (no sidebar)
  if (phase === 'welcome') return <WelcomeScreen />
  if (phase === 'onboarding') return <OnboardingScreen />
  if (phase === 'block_end') return <BlockEndScreen />
  if (phase === 'complete') return <CompleteScreen />

  // Sidebar-visible phases: encoding, playing, questionnaire
  return (
    <div className="w-full h-screen flex overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* WS reconnection indicator */}
      {wsReconnecting && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-center text-sm py-1 animate-pulse">
          Connection lost — reconnecting…
        </div>
      )}

      {/* Main panel area (~75%) */}
      <div className="flex-1 relative min-w-0">
        {/* z:0 — Faded room background illustration */}
        <RoomBackground />

        {/* z:1 — Game panel or screen overlay */}
        <div className="relative z-10 h-full flex items-center justify-center p-4">
          <div
            className="w-[92%] h-[92%] rounded-2xl shadow-lg overflow-hidden flex flex-col"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.88)' }}
          >
            {phase === 'encoding' && <EncodingScreen embedded />}
            {phase === 'questionnaire' && <QuestionnaireScreen embedded />}
            {phase === 'playing' && <MainPanel />}
          </div>
        </div>

        {/* z:2 — Robot speech toast (bottom of main panel) */}
        {phase === 'playing' && <RobotSpeechToast />}

        {/* MCQ overlay over main panel */}
        {mcqVisible && (
          <div className="absolute inset-0 z-50">
            <MCQOverlay />
          </div>
        )}
      </div>

      {/* Sidebar (~25%, fixed width) */}
      <HomeMapSidebar />
    </div>
  )
}
