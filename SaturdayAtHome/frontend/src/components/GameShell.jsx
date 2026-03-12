import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGameStore, HOB_STATUS } from '../store/gameStore'
import useSSE from '../hooks/useSSE'
import { useAudio } from '../hooks/useAudio'
import TopBar from './ui/TopBar'
import Sidebar from './ui/Sidebar'
import RoomOverview from './rooms/RoomOverview'
import RoomExpanded from './rooms/RoomExpanded'
import RobotAvatar from './ui/RobotAvatar'
import EncodingScreen from './screens/EncodingScreen'
import WelcomeScreen from './screens/WelcomeScreen'
import BlockEndScreen from './screens/BlockEndScreen'

const TICK_RATE = 1000
const HOB_CHECK_RATE = 500

export default function GameShell() {
  const phase = useGameStore((s) => s.phase)
  const blockRunning = useGameStore((s) => s.blockRunning)
  const tickMachine = useGameStore((s) => s.tickMachine)
  const tickBlockTimer = useGameStore((s) => s.tickBlockTimer)
  const spawnSteak = useGameStore((s) => s.spawnSteak)
  const activeRoom = useGameStore((s) => s.activeRoom)
  const loadRemoteConfig = useGameStore((s) => s.loadRemoteConfig)

  // Load remote config on mount
  useEffect(() => { loadRemoteConfig() }, [loadRemoteConfig])

  // SSE client — connects when sessionId + blockNumber + blockRunning are set
  useSSE()

  // Audio engine — BGM, SFX, TTS tied to game state
  useAudio()

  // ── 1s game loop (machine, block timer) ──
  useEffect(() => {
    if (!blockRunning) return
    const timer = setInterval(() => {
      tickMachine()
      tickBlockTimer()
    }, TICK_RATE)
    return () => clearInterval(timer)
  }, [blockRunning, tickMachine, tickBlockTimer])

  // ── 500ms hob transition + PM timeout checker ──────────
  useEffect(() => {
    if (!blockRunning) return
    const timer = setInterval(() => {
      const state = useGameStore.getState()
      const now = Date.now()

      // Hob transitions
      state.hobs.forEach((hob) => {
        if (!hob.startedAt) return
        if (hob.status === HOB_STATUS.COOKING && now - hob.startedAt >= hob.cookingMs) {
          state.transitionHob(hob.id, HOB_STATUS.READY)
        }
        if (hob.status === HOB_STATUS.READY && now - hob.startedAt >= hob.readyMs) {
          state.transitionHob(hob.id, HOB_STATUS.BURNING)
        }
      })

      // Plant wilt — wilts 30s after needing water
      if (state.plantNeedsWater && !state.plantWilted && state.plantNeedsWaterSince) {
        if (now - state.plantNeedsWaterSince >= 30000) {
          state.wiltPlant()
        }
      }
    }, HOB_CHECK_RATE)
    return () => clearInterval(timer)
  }, [blockRunning])

  // ── Demo steak spawning (only when SSE not connected = no backend) ───
  useEffect(() => {
    if (!blockRunning) return
    if (useGameStore.getState().sseConnected) return
    if (useGameStore.getState().sessionId) return // has session → SSE will connect, wait for backend spawns
    const timeouts = [
      setTimeout(() => spawnSteak(0), 2000),
      setTimeout(() => spawnSteak(1), 8000),
      setTimeout(() => spawnSteak(2), 30000),
    ]
    return () => timeouts.forEach(clearTimeout)
  }, [blockRunning, spawnSteak])

  // ── Welcome screen (session creation) ──────────────────
  if (phase === 'welcome') {
    return <WelcomeScreen />
  }

  // ── Encoding screen (blocks game UI until confirmed) ───
  if (phase === 'block_encoding') {
    return <EncodingScreen />
  }

  // ── Block end screen ───────────────────────────────────
  if (phase === 'block_end') {
    return <BlockEndScreen />
  }

  return (
    <div className="w-full h-screen bg-slate-100 flex font-sans overflow-hidden text-slate-800">
      <Sidebar />

      <div className="flex-1 flex flex-col relative">
        <TopBar />

        <div className="flex-1 relative">
          <RoomOverview />

          <AnimatePresence>
            {activeRoom !== 'overview' && <RoomExpanded />}
          </AnimatePresence>

          <RobotAvatar />
        </div>
      </div>
    </div>
  )
}
