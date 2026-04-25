/** CutsceneEncodingPage — replaces old EncodingPage.
 *
 * Phase 1: Cutscenes (4 tasks × 4 segments each)
 *   For each task in participant's taskOrder:
 *     For each segment 0-3:
 *       a. Show CutscenePlayer
 *       b. Log cutscene event
 *       c. Show DetailCheckModal
 *       d. Log detail check result → advance
 *
 * Phase 2: Intention checks (4 tasks)
 *   For each task in taskOrder:
 *     Show IntentionCheckQuestion → log → advance
 *
 * After all: POST phase end → setPhase('playing') → wsSend start_game
 *
 * All content comes from frontend constants — NO server round-trip.
 */

import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { updatePhase, logCutsceneEvent, logIntentionCheck } from '../../services/api'
import { TASK_ORDERS } from '../../constants/pmTasks'
import {
  CUTSCENE_PLACEHOLDERS,
  DETAILCHECK_PLACEHOLDERS,
  INTENTIONCHECK_PLACEHOLDERS,
} from '../../constants/placeholders'
import CutscenePlayer from '../../components/game/CutscenePlayer'
import DetailCheckModal from '../../components/game/DetailCheckModal'
import IntentionCheckQuestion from '../../components/game/IntentionCheckQuestion'

type Stage =
  | { kind: 'cutscene'; taskIdx: number; segIdx: number }
  | { kind: 'detail_check'; taskIdx: number; segIdx: number }
  | { kind: 'intention_check'; taskIdx: number }
  | { kind: 'done' }

function getOrderedTasks(taskOrder: string | null): string[] {
  if (!taskOrder || !TASK_ORDERS[taskOrder]) return TASK_ORDERS['A']
  return TASK_ORDERS[taskOrder]
}

export default function CutsceneEncodingPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const taskOrder = useGameStore((s) => s.taskOrder)
  const setPhase = useGameStore((s) => s.setPhase)
  const resetBlock = useGameStore((s) => s.resetBlock)
  const wsSend = useGameStore((s) => s.wsSend)

  const tasks = getOrderedTasks(taskOrder)

  const [stage, setStage] = useState<Stage>({ kind: 'cutscene', taskIdx: 0, segIdx: 0 })

  // Track when cutscene started for duration logging
  const cutsceneStartRef = useRef<number>(Date.now())

  // Reset on mount
  useEffect(() => {
    resetBlock()
  }, [])

  const advance = (current: Stage): Stage => {
    if (current.kind === 'cutscene') {
      // After cutscene → show detail check for same segment
      return { kind: 'detail_check', taskIdx: current.taskIdx, segIdx: current.segIdx }
    }
    if (current.kind === 'detail_check') {
      const nextSeg = current.segIdx + 1
      if (nextSeg < 4) {
        // Next segment of same task
        return { kind: 'cutscene', taskIdx: current.taskIdx, segIdx: nextSeg }
      }
      const nextTask = current.taskIdx + 1
      if (nextTask < tasks.length) {
        // Next task, first segment
        return { kind: 'cutscene', taskIdx: nextTask, segIdx: 0 }
      }
      // All cutscenes done → start intention checks
      return { kind: 'intention_check', taskIdx: 0 }
    }
    if (current.kind === 'intention_check') {
      const nextTask = current.taskIdx + 1
      if (nextTask < tasks.length) {
        return { kind: 'intention_check', taskIdx: nextTask }
      }
      return { kind: 'done' }
    }
    return { kind: 'done' }
  }

  // ── Cutscene handlers ──

  const handleCutsceneNext = async () => {
    if (stage.kind !== 'cutscene') return
    const taskId = tasks[stage.taskIdx]
    const placeholder = CUTSCENE_PLACEHOLDERS[taskId]?.[stage.segIdx] ?? ''
    const durationMs = Date.now() - cutsceneStartRef.current

    if (sessionId) {
      try {
        await logCutsceneEvent(sessionId, {
          task_id: taskId,
          segment_index: stage.segIdx,
          placeholder,
          viewed_at: cutsceneStartRef.current / 1000,
          duration_ms: durationMs,
        })
      } catch (e) {
        console.error('[Encoding] cutscene log failed', e)
      }
    }
    setStage(advance(stage))
  }

  // ── Detail check handlers ──

  const handleDetailCheckComplete = async (correct: boolean, selectedIndex: number) => {
    if (stage.kind !== 'detail_check') return
    const taskId = tasks[stage.taskIdx]
    const checkData = DETAILCHECK_PLACEHOLDERS[taskId]?.[stage.segIdx]

    if (sessionId && checkData) {
      try {
        await logCutsceneEvent(sessionId, {
          task_id: taskId,
          segment_index: stage.segIdx,
          detail_check_selected: selectedIndex,
          detail_check_correct: correct,
          detail_check_correct_index: checkData.correctIndex,
        } as Parameters<typeof logCutsceneEvent>[1])
      } catch (e) {
        console.error('[Encoding] detail check log failed', e)
      }
    }

    // Set cutscene start time for next segment
    cutsceneStartRef.current = Date.now()
    setStage(advance(stage))
  }

  // ── Intention check handlers ──

  const handleIntentionCheckComplete = async (selectedIndex: number) => {
    if (stage.kind !== 'intention_check') return
    const taskId = tasks[stage.taskIdx]
    const data = INTENTIONCHECK_PLACEHOLDERS[taskId]
    const isCorrect = selectedIndex === data?.correctIndex

    if (sessionId && data) {
      try {
        await logIntentionCheck(sessionId, {
          task_id: taskId,
          selected_index: selectedIndex,
          correct_index: data.correctIndex,
          is_correct: isCorrect,
          response_time_ms: 0,
          task_position: stage.taskIdx + 1,
        })
      } catch (e) {
        console.error('[Encoding] intention check log failed', e)
      }
    }

    const next = advance(stage)
    if (next.kind === 'done') {
      await handleAllDone()
    } else {
      setStage(next)
    }
  }

  // ── Completion ──

  const handleAllDone = async () => {
    if (sessionId) {
      try {
        await updatePhase(sessionId, 'encoding', 'end')
      } catch (e) {
        console.error('[Encoding] phase end failed', e)
      }
    }
    setPhase('playing')
    if (wsSend) {
      wsSend({ type: 'start_game', data: {} })
    }
  }

  // ── Render ──

  if (stage.kind === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-slate-800">Encoding Complete</h2>
          <p className="text-slate-500 mt-2">Starting the game…</p>
        </div>
      </div>
    )
  }

  if (stage.kind === 'cutscene') {
    const taskId = tasks[stage.taskIdx]
    const placeholder = CUTSCENE_PLACEHOLDERS[taskId]?.[stage.segIdx] ?? '[Cutscene - TBD]'
    return (
      <CutscenePlayer
        taskId={taskId}
        segmentIndex={stage.segIdx}
        placeholder={placeholder}
        onNext={handleCutsceneNext}
      />
    )
  }

  if (stage.kind === 'detail_check') {
    const taskId = tasks[stage.taskIdx]
    const checkData = DETAILCHECK_PLACEHOLDERS[taskId]?.[stage.segIdx] ?? {
      question: '[Detail check - TBD]',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <DetailCheckModal
          question={checkData.question}
          options={checkData.options}
          correctIndex={checkData.correctIndex}
          onComplete={handleDetailCheckComplete}
        />
      </div>
    )
  }

  if (stage.kind === 'intention_check') {
    const taskId = tasks[stage.taskIdx]
    const data = INTENTIONCHECK_PLACEHOLDERS[taskId] ?? {
      question: '[Intention check - TBD]',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
    }
    return (
      <IntentionCheckQuestion
        taskId={taskId}
        data={data}
        position={stage.taskIdx + 1}
        onComplete={handleIntentionCheckComplete}
      />
    )
  }

  return null
}
