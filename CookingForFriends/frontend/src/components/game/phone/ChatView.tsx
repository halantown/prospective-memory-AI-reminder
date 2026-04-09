/** Chat view — WhatsApp-style message thread for a single contact. */

import { useEffect, useRef, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { PhoneMessage } from '../../../types'
import ChatBubble from './ChatBubble'
import ChoiceButtons from './ChoiceButtons'

const FEEDBACK_DELAY_MS = 2500

export default function ChatView() {
  const activeContactId = useGameStore((s) => s.activeContactId)
  const contacts = useGameStore((s) => s.contacts)
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const answerPhoneMessage = useGameStore((s) => s.answerPhoneMessage)
  const showMessageFeedback = useGameStore((s) => s.showMessageFeedback)
  const markContactMessagesRead = useGameStore((s) => s.markContactMessagesRead)
  const wsSend = useGameStore((s) => s.wsSend)

  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeContactId),
    [contacts, activeContactId],
  )

  // Messages for the active contact, sorted by timestamp
  const contactMessages = useMemo(() => {
    if (!activeContactId) return []
    return phoneMessages
      .filter((m) => m.channel === 'chat' && m.contactId === activeContactId)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [phoneMessages, activeContactId])

  // Mark all messages as read when viewing a contact
  useEffect(() => {
    if (!activeContactId) return
    const hasUnread = contactMessages.some((m) => !m.read)
    if (hasUnread) {
      markContactMessagesRead(activeContactId)
      if (wsSend) {
        wsSend({
          type: 'phone_read',
          data: { contact_id: activeContactId, timestamp: Date.now() / 1000 },
        })
      }
    }
  }, [contactMessages, activeContactId, markContactMessagesRead, wsSend])

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && !userScrolledRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [contactMessages, scrollToBottom])

  // Reset scroll tracking on contact switch
  useEffect(() => {
    userScrolledRef.current = false
    scrollToBottom()
  }, [activeContactId, scrollToBottom])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 40
  }, [])

  const handleAnswer = useCallback((msg: PhoneMessage, chosenText: string, isCorrect: boolean, correctPositionShown: number) => {
    if (msg.answered || msg.channel !== 'chat') return
    answerPhoneMessage(msg.id, chosenText, isCorrect)

    if (wsSend) {
      wsSend({
        type: 'phone_reply',
        data: {
          message_id: msg.id,
          contact_id: msg.contactId,
          chosen_text: chosenText,
          is_correct: isCorrect,
          correct_position_shown: correctPositionShown,
          timestamp: Date.now() / 1000,
        },
      })
    }

    // Persist feedback visibility in store — survives remounts
    setTimeout(() => {
      showMessageFeedback(msg.id)
    }, FEEDBACK_DELAY_MS)
  }, [answerPhoneMessage, showMessageFeedback, wsSend])

  if (!activeContactId || !activeContact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 px-4">
        <span className="text-2xl mb-2">💬</span>
        <p className="text-xs text-center">Select a contact to view messages</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Chat header */}
      <div className="px-3 py-1.5 border-b border-slate-700/40 flex items-center gap-2 shrink-0">
        <span className="text-sm">{activeContact.avatar}</span>
        <span className="text-xs font-semibold text-white truncate">{activeContact.name}</span>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2.5 py-2 flex flex-col gap-2"
      >
        {contactMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            No messages yet
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {contactMessages.map((msg) => (
              <MessageGroup
                key={msg.id}
                msg={msg}
                onAnswer={(chosenText, isCorrect, correctPositionShown) =>
                  handleAnswer(msg, chosenText, isCorrect, correctPositionShown)
                }
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}


/** A single message group: bubble + optional choice buttons + participant reply + optional feedback. */
function MessageGroup({
  msg,
  onAnswer,
}: {
  msg: PhoneMessage
  onAnswer: (chosenText: string, isCorrect: boolean, correctPositionShown: number) => void
}) {
  const isAnswered = msg.answered === true
  const feedbackVisible = msg.feedbackVisible === true

  // Determine feedback text
  const feedbackText = isAnswered
    ? (msg.answeredCorrect ? msg.feedbackCorrect : msg.feedbackIncorrect)
    : undefined

  return (
    <div className="flex flex-col gap-1">
      <ChatBubble text={msg.text} variant="friend" />

      {/* Choice buttons — only shown before answering */}
      {msg.correctChoice && msg.wrongChoice && !isAnswered && (
        <ChoiceButtons
          correctChoice={msg.correctChoice}
          wrongChoice={msg.wrongChoice}
          correctPosition={msg.correctPosition}
          onChoose={onAnswer}
        />
      )}

      {/* Participant's reply bubble (right-aligned) */}
      {isAnswered && msg.userChoice && (
        <ChatBubble
          text={msg.userChoice}
          variant="participant"
        />
      )}

      {/* Feedback bubble from friend (appears after delay) */}
      {isAnswered && feedbackVisible && feedbackText && (
        <ChatBubble text={feedbackText} variant="feedback" />
      )}
    </div>
  )
}
