import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGameStore, HOB_STATUS } from '../store/gameStore'
import TopBar from './ui/TopBar'
import Sidebar from './ui/Sidebar'
import RoomOverview from './rooms/RoomOverview'
import RoomExpanded from './rooms/RoomExpanded'
import RobotAvatar from './ui/RobotAvatar'
import MessageLog from './ui/MessageLog'
import ReportTaskButton from './ui/ReportTaskButton'
import PmExecuteOverlay from './ui/PmExecuteOverlay'
import EncodingScreen from './screens/EncodingScreen'

const TICK_RATE = 1000
const HOB_CHECK_RATE = 500

export default function GameShell() {
  const phase = useGameStore((s) => s.phase)
  const blockRunning = useGameStore((s) => s.blockRunning)
  const tickMachine = useGameStore((s) => s.tickMachine)
  const tickBlockTimer = useGameStore((s) => s.tickBlockTimer)
  const startBlockEncoding = useGameStore((s) => s.startBlockEncoding)
  const spawnSteak = useGameStore((s) => s.spawnSteak)
  const activeRoom = useGameStore((s) => s.activeRoom)

  // ── 1s game loop (machine, block timer, PM countdown) ──
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

      // PM execution timeout (T13)
      const { pmExecution, pmTimeout } = state
      if (pmExecution.active && pmExecution.windowOpenAt) {
        if (now - pmExecution.windowOpenAt >= pmExecution.timeLimit) {
          pmTimeout()
        }
      }
    }, HOB_CHECK_RATE)
    return () => clearInterval(timer)
  }, [blockRunning])

  // ── Auto-start demo block with encoding phase ──────────
  useEffect(() => {
    if (phase === 'welcome') {
      startBlockEncoding({
        blockNumber: 1,
        condition: 'HighAF_HighCB',
        taskPairId: 1,
      })
    }
  }, [])

  // ── Demo steak spawning (replaces SSE in demo mode) ────
  useEffect(() => {
    if (!blockRunning) return
    const timeouts = [
      setTimeout(() => spawnSteak(0), 2000),
      setTimeout(() => spawnSteak(1), 8000),
      setTimeout(() => spawnSteak(2), 30000),
    ]
    return () => timeouts.forEach(clearTimeout)
  }, [blockRunning, spawnSteak])

  // ── Encoding screen (blocks game UI until confirmed) ───
  if (phase === 'block_encoding') {
    return <EncodingScreen />
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

          <ReportTaskButton />
          <PmExecuteOverlay />
          <RobotAvatar />
          <MessageLog />
        </div>
      </div>
    </div>
  )
}
