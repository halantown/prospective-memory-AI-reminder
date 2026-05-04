import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { advancePhase, getExperimentConfig, submitExperimentResponses } from '../../services/api'
import { frontendPhaseForBackend } from '../../utils/phase'
import BubbleDialogue from '../../components/game/dialogue/BubbleDialogue'
import TrainingHomeShell from '../../components/game/TrainingHomeShell'
import SpriteSheet from '../../components/game/_archive/sprites/SpriteSheet'
import { CHAR_ANIMATIONS, CHAR_SHEET } from '../../components/game/_archive/sprites/characterAnimations'
import type { CookingDefinitions, CookingStepOption } from '../../types'

interface Option {
  id: string
  text: string
}

function tutorialKind(phase: string) {
  if (phase === 'TUTORIAL_PHONE') return 'phone'
  if (phase === 'TUTORIAL_COOKING') return 'cooking'
  if (phase === 'TUTORIAL_TRIGGER') return 'trigger'
  return 'unknown'
}

export default function TutorialFlowPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const phase = String(useGameStore((s) => s.phase))
  const setPhase = useGameStore((s) => s.setPhase)
  const setContacts = useGameStore((s) => s.setContacts)
  const addPhoneMessage = useGameStore((s) => s.addPhoneMessage)
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const setPhoneBanner = useGameStore((s) => s.setPhoneBanner)
  const setActiveContactId = useGameStore((s) => s.setActiveContactId)
  const activePhoneTab = useGameStore((s) => s.activePhoneTab)
  const setPhoneTabPrompt = useGameStore((s) => s.setPhoneTabPrompt)
  const setPhoneLocked = useGameStore((s) => s.setPhoneLocked)
  const initializeCookingDefinitions = useGameStore((s) => s.initializeCookingDefinitions)
  const handleCookingStepActivate = useGameStore((s) => s.handleCookingStepActivate)
  const handleCookingStepResult = useGameStore((s) => s.handleCookingStepResult)
  const setWsSend = useGameStore((s) => s.setWsSend)
  const setElapsedSeconds = useGameStore((s) => s.setElapsedSeconds)
  const setGameClock = useGameStore((s) => s.setGameClock)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [timerReady, setTimerReady] = useState(false)
  const [tabPromptTimedOut, setTabPromptTimedOut] = useState(false)
  const startedAtRef = useRef(Date.now())
  const phoneAdvancedRef = useRef(false)
  const cookingSetupRef = useRef(false)
  const kind = tutorialKind(phase)
  const targetPhoneTab = kind === 'phone' ? 'chats' : kind === 'cooking' ? 'recipe' : null

  useEffect(() => {
    if (!sessionId) return
    setConfig(null)
    setStepIndex(0)
    setTimerReady(false)
    setTabPromptTimedOut(false)
    phoneAdvancedRef.current = false
    cookingSetupRef.current = false
    startedAtRef.current = Date.now()
    getExperimentConfig(sessionId, phase)
      .then((next) => setConfig(next as Record<string, unknown>))
      .catch((e) => console.error('[TutorialFlow] config load failed', e))
  }, [sessionId, phase])

  useEffect(() => {
    setPhoneTabPrompt(targetPhoneTab)
    setTabPromptTimedOut(false)
    return () => setPhoneTabPrompt(null)
  }, [setPhoneTabPrompt, targetPhoneTab])

  useEffect(() => {
    if (!targetPhoneTab || activePhoneTab === targetPhoneTab) {
      setTabPromptTimedOut(false)
      return
    }

    const timer = window.setTimeout(() => {
      if (useGameStore.getState().activePhoneTab !== targetPhoneTab) {
        setTabPromptTimedOut(true)
      }
    }, 10_000)
    return () => window.clearTimeout(timer)
  }, [activePhoneTab, targetPhoneTab])

  const advance = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[TutorialFlow] advance failed', e)
    } finally {
      setLoading(false)
    }
  }

  const phoneDemo = config?.phone_demo as {
    contact: { id: string; name: string; avatar: string }
    message: string
    options: Option[]
    correct_option_id?: string
    feedback: string
  } | undefined
  const phonePracticeMessageId = sessionId ? `tutorial_phone_practice_${sessionId}` : 'tutorial_phone_practice'

  useEffect(() => {
    if (kind !== 'phone' || !phoneDemo || !sessionId) return
    const contact = {
      ...phoneDemo.contact,
      id: `${phoneDemo.contact.id}_${sessionId}`,
    }
    const correct = phoneDemo.correct_option_id
      ? phoneDemo.options.find((option) => option.id === phoneDemo.correct_option_id)
      : phoneDemo.options[0]
    const wrong = phoneDemo.options.find((option) => option.id !== correct?.id)
    if (!correct || !wrong) return

    const message = {
      id: phonePracticeMessageId,
      channel: 'chat' as const,
      contactId: contact.id,
      text: phoneDemo.message,
      correctChoice: correct.text,
      wrongChoice: wrong.text,
      correctPosition: 0,
      feedbackCorrect: phoneDemo.feedback,
      feedbackIncorrect: phoneDemo.feedback,
      timestamp: Date.now(),
      read: false,
      answered: false,
    }

    setContacts([contact])
    setActiveContactId(contact.id)
    setPhoneLocked(false)
    addPhoneMessage(message)
    setPhoneBanner(message)
  }, [
    addPhoneMessage,
    kind,
    phoneDemo,
    phonePracticeMessageId,
    sessionId,
    setActiveContactId,
    setContacts,
    setPhoneBanner,
    setPhoneLocked,
  ])

  const phonePracticeMessage = phoneMessages.find((message) => message.id === phonePracticeMessageId)

  useEffect(() => {
    if (kind !== 'phone' || !phonePracticeMessage?.answered || phoneAdvancedRef.current) return
    phoneAdvancedRef.current = true
    recordAndAdvance('tutorial_phone_reply', phonePracticeMessage.userChoice ?? null, {
      answered_correct: phonePracticeMessage.answeredCorrect ?? null,
      response_time_ms: Date.now() - startedAtRef.current,
    })
  }, [kind, phonePracticeMessage])

  const friedEgg = config?.fried_egg as {
    recipe_name: string
    steps: Array<{ id: string; recipe_text: string; options?: Option[]; correct_option_id?: string; timer_s?: number }>
  } | undefined

  const currentCookingStep = friedEgg?.steps[stepIndex]
  const isLastCookingStep = friedEgg ? stepIndex >= friedEgg.steps.length - 1 : false

  useEffect(() => {
    if (kind !== 'cooking' || !friedEgg) return

    setPhoneLocked(false)
    setElapsedSeconds((8 * 60 + 40) * 60)
    setGameClock('08:40')

    if (!cookingSetupRef.current) {
      cookingSetupRef.current = true
      const definitions: CookingDefinitions = {
        recipe_version: 'tutorial-fried-egg',
        dish_order: ['spaghetti'],
        dishes: {
          spaghetti: {
            id: 'spaghetti',
            label: friedEgg.recipe_name,
            emoji: '🍳',
            steps: friedEgg.steps.map((step, index) => ({
              id: step.id,
              label: step.recipe_text,
              station: tutorialStationForStep(step.id),
              description: step.recipe_text,
              step_type: 'active',
              wait_duration_s: step.timer_s ?? 0,
            })),
          },
          steak: { id: 'steak', label: 'Steak', emoji: '🥩', steps: [] },
          tomato_soup: { id: 'tomato_soup', label: 'Soup', emoji: '🍅', steps: [] },
          roasted_vegetables: { id: 'roasted_vegetables', label: 'Roast Veg', emoji: '🥕', steps: [] },
        },
        timeline: [],
      }
      initializeCookingDefinitions(definitions)
    }

    const step = friedEgg.steps[stepIndex]
    const options: CookingStepOption[] = step.options?.map((option) => ({
      id: option.id,
      text: option.text,
    })) ?? [{ id: 'done', text: step.recipe_text }]

    handleCookingStepActivate({
      dish: 'spaghetti',
      step_index: stepIndex,
      label: step.recipe_text,
      description: step.recipe_text,
      station: tutorialStationForStep(step.id),
      options,
      window_s: 120,
      step_type: 'active',
      activated_at: Date.now() / 1000,
    })
  }, [
    friedEgg,
    handleCookingStepActivate,
    initializeCookingDefinitions,
    kind,
    setElapsedSeconds,
    setGameClock,
    setPhoneLocked,
    stepIndex,
  ])

  useEffect(() => {
    if (kind !== 'cooking' || !friedEgg || !currentCookingStep || !sessionId) return
    const previousWsSend = useGameStore.getState().wsSend

    setWsSend((message) => {
      if (message.type !== 'cooking_action') {
        previousWsSend?.(message)
        return
      }

      const data = message.data as { chosen_option_id?: string; chosen_option_text?: string }
      const correctId = currentCookingStep.correct_option_id
      const isCorrect = correctId ? data.chosen_option_id === correctId : true

      submitExperimentResponses(sessionId!, [{
        phase,
        question_id: `tutorial_cooking_${currentCookingStep.id}`,
        response_type: 'choice',
        value: data.chosen_option_id ?? null,
        metadata: {
          chosen_text: data.chosen_option_text ?? null,
          correct_option_id: correctId ?? null,
          answered_correct: isCorrect,
          step_index: stepIndex,
        },
      }]).catch((e) => console.error('[TutorialFlow] cooking response submit failed', e))

      handleCookingStepResult({
        dish: 'spaghetti',
        step_index: stepIndex,
        result: isCorrect ? 'correct' : 'wrong',
        chosen_option_id: data.chosen_option_id,
        response_time_ms: Date.now() - startedAtRef.current,
      })

      if (isLastCookingStep) {
        advance()
      } else {
        setStepIndex((i) => i + 1)
      }
    })

    return () => setWsSend(previousWsSend)
  }, [
    advance,
    currentCookingStep,
    friedEgg,
    handleCookingStepResult,
    isLastCookingStep,
    kind,
    phase,
    sessionId,
    setWsSend,
    stepIndex,
  ])

  const recordAndAdvance = async (questionId: string, value: unknown, metadata?: Record<string, unknown>) => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      await submitExperimentResponses(sessionId, [{
        phase,
        question_id: questionId,
        response_type: typeof value === 'boolean' ? 'boolean' : 'choice',
        value,
        metadata,
      }])
      const advanced = await advancePhase(sessionId)
      setPhase(frontendPhaseForBackend(advanced.current_phase))
    } catch (e) {
      console.error('[TutorialFlow] response submit failed', e)
    } finally {
      setLoading(false)
    }
  }

  if (!config) {
    return (
      <TrainingHomeShell phase={phase}>
        <div className="sr-only">Loading tutorial materials...</div>
      </TrainingHomeShell>
    )
  }

  if (kind === 'phone') {
    return (
      <TrainingHomeShell phase={phase}>
        <PhoneTabPromptOverlay
          visible={tabPromptTimedOut && activePhoneTab !== 'chats'}
          target="Chats"
        />
        <BubbleDialogue
          speaker="ROBOT"
          text="A message has arrived on your phone. Open the chat and choose a reply."
          avatar="R"
          align="right"
        />
      </TrainingHomeShell>
    )
  }

  if (kind === 'cooking') {
    return (
      <TrainingHomeShell phase={phase}>
        <PhoneTabPromptOverlay
          visible={tabPromptTimedOut && activePhoneTab !== 'recipe'}
          target="Recipe"
        />
        <BubbleDialogue
          speaker="ROBOT"
          text={currentCookingStep
            ? `Go to the kitchen. Hold the recipe tab on the phone, then use the highlighted station for: ${currentCookingStep.recipe_text}`
            : 'Go to the kitchen and use the phone recipe to prepare the fried egg.'}
          avatar="R"
          align="right"
        >
          {currentCookingStep?.timer_s && (
            <button
              onClick={() => setTimerReady(true)}
              disabled={timerReady}
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            >
              {timerReady ? 'Timer running...' : 'Start timer practice'}
            </button>
          )}
        </BubbleDialogue>
      </TrainingHomeShell>
    )
  }

  const trigger = config.trigger_demo as {
    visitor: string
    visitor_line: string
    robot_line: string
    action_label: string
  }
  return (
    <TrainingHomeShell phase={phase}>
      <div className="w-full max-w-3xl space-y-3 pb-8">
        <div className="flex justify-start">
          <div className="rounded-lg border border-white/20 bg-slate-950/70 px-4 py-3 shadow-lg">
            <SpriteSheet
              src={CHAR_SHEET.src}
              sheetCols={CHAR_SHEET.sheetCols}
              frameW={CHAR_SHEET.frameW}
              frameH={CHAR_SHEET.frameH}
              animation={CHAR_ANIMATIONS.idle_down}
              scale={2}
              className="drop-shadow-lg"
            />
            <div className="mt-1 text-center text-xs font-semibold text-white/80">{trigger.visitor}</div>
          </div>
        </div>
        <BubbleDialogue speaker={trigger.visitor} text={trigger.visitor_line} avatar="S" />
        <BubbleDialogue speaker="ROBOT" text={trigger.robot_line} avatar="R" align="right" />
        <button
          onClick={() => recordAndAdvance('tutorial_trigger_action', true, { action_label: trigger.action_label })}
          disabled={loading}
          className="w-full rounded-lg bg-white py-3 text-sm font-semibold text-slate-900 shadow-lg disabled:bg-slate-300"
        >
          {loading ? 'Saving...' : trigger.action_label}
        </button>
      </div>
    </TrainingHomeShell>
  )
}

function tutorialStationForStep(stepId: string) {
  if (stepId === 'choose_eggs') return 'fridge'
  if (stepId === 'add_oil') return 'burner1'
  if (stepId === 'crack_eggs') return 'burner1'
  if (stepId === 'season_salt') return 'spice_rack'
  return 'plating_area'
}

function PhoneTabPromptOverlay({ visible, target }: { visible: boolean; target: string }) {
  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[500] flex items-center justify-center bg-black/55">
      <div className="rounded-lg border border-white/20 bg-slate-950/80 px-6 py-4 text-center shadow-2xl">
        <p className="text-base font-semibold text-white">Click the highlighted {target} tab on the phone.</p>
      </div>
    </div>
  )
}
