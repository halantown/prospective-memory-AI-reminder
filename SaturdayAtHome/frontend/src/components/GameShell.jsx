import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import useWebSocket from '../hooks/useWebSocket'
import { sendHeartbeat } from '../utils/api'
import TopBar from './ui/TopBar'
import Sidebar from './ui/Sidebar'
import RobotAvatar from './ui/RobotAvatar'
import WelcomeScreen from './screens/WelcomeScreen'
import EncodingScreen from './screens/EncodingScreen'
import BlockEndScreen from './screens/BlockEndScreen'
import StateRoomView from './StateRoomView'
import PmTaskPanel from './PmTaskPanel'

const TICK_RATE = 1000

export default function GameShell() {
  const phase = useGameStore((s) => s.phase)
  const blockRunning = useGameStore((s) => s.blockRunning)
  const sessionId = useGameStore((s) => s.sessionId)
  const tickBlockTimer = useGameStore((s) => s.tickBlockTimer)
  const loadRemoteConfig = useGameStore((s) => s.loadRemoteConfig)
  const transitionNarrative = useGameStore((s) => s.transitionNarrative)

  useEffect(() => {
    loadRemoteConfig()
  }, [loadRemoteConfig])

  useWebSocket()

  useEffect(() => {
    if (!blockRunning) return
    const timer = setInterval(() => {
      tickBlockTimer()
    }, TICK_RATE)
    return () => clearInterval(timer)
  }, [blockRunning, tickBlockTimer])

  useEffect(() => {
    if (!blockRunning || !sessionId) return
    const ping = () => {
      sendHeartbeat(sessionId).catch((err) => {
        console.warn('[Heartbeat] failed:', err.message || err)
      })
    }
    ping()
    const timer = setInterval(ping, 10000)
    return () => clearInterval(timer)
  }, [blockRunning, sessionId])

  if (phase === 'welcome') return <WelcomeScreen />
  if (phase === 'block_encoding') return <EncodingScreen />
  if (phase === 'block_end') return <BlockEndScreen />
  if (phase === 'session_complete') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 max-w-lg text-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Session complete</h1>
          <p className="text-slate-600">Thanks for participating in the day simulation study.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-slate-100 flex font-sans overflow-hidden text-slate-800">
      <div className="flex-1 flex flex-col relative">
        <TopBar />

        {transitionNarrative && (
          <div className="mx-6 mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {transitionNarrative}
          </div>
        )}

        <PmTaskPanel />
        <StateRoomView />
        <RobotAvatar />
      </div>

      <Sidebar />
    </div>
  )
}
