import { useState, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'

const ROOM_THEMES = {
  study: {
    tint: 'rgba(148, 163, 184, 0.06)',
    elements: [
      { emoji: '💻', top: '20%', left: '30%', size: '3rem' },
      { emoji: '💡', top: '15%', left: '70%', size: '2.5rem' },
      { emoji: '📚', top: '55%', left: '75%', size: '3.5rem' },
      { emoji: '📚', top: '60%', left: '82%', size: '2.5rem' },
      { emoji: '🪑', top: '50%', left: '35%', size: '2.5rem' },
      { emoji: '📝', top: '70%', left: '25%', size: '2rem' },
    ],
  },
  kitchen: {
    tint: 'rgba(253, 224, 71, 0.05)',
    elements: [
      { emoji: '🍳', top: '20%', left: '25%', size: '3rem' },
      { emoji: '🥘', top: '25%', left: '50%', size: '2.5rem' },
      { emoji: '🗄️', top: '15%', left: '75%', size: '3rem' },
      { emoji: '🍽️', top: '55%', left: '45%', size: '3.5rem' },
      { emoji: '☕', top: '65%', left: '70%', size: '2rem' },
      { emoji: '🧊', top: '40%', left: '20%', size: '2.5rem' },
    ],
  },
  living: {
    tint: 'rgba(168, 85, 247, 0.04)',
    elements: [
      { emoji: '🛋️', top: '50%', left: '30%', size: '4rem' },
      { emoji: '📺', top: '20%', left: '60%', size: '3.5rem' },
      { emoji: '🪟', top: '15%', left: '25%', size: '3rem' },
      { emoji: '🖼️', top: '18%', left: '80%', size: '2.5rem' },
      { emoji: '☕', top: '60%', left: '55%', size: '2rem' },
      { emoji: '🌿', top: '70%', left: '80%', size: '2rem' },
    ],
  },
  laundry: {
    tint: 'rgba(148, 163, 184, 0.05)',
    elements: [
      { emoji: '🫧', top: '30%', left: '30%', size: '3.5rem' },
      { emoji: '🧺', top: '55%', left: '60%', size: '3rem' },
      { emoji: '👕', top: '20%', left: '70%', size: '2.5rem' },
      { emoji: '🧴', top: '65%', left: '25%', size: '2rem' },
    ],
  },
  entrance: {
    tint: 'rgba(110, 231, 183, 0.04)',
    elements: [
      { emoji: '🚪', top: '30%', left: '45%', size: '4rem' },
      { emoji: '🧥', top: '25%', left: '75%', size: '2.5rem' },
      { emoji: '👟', top: '65%', left: '30%', size: '2.5rem' },
      { emoji: '🔑', top: '60%', left: '70%', size: '2rem' },
      { emoji: '📬', top: '20%', left: '20%', size: '2.5rem' },
    ],
  },
  balcony: {
    tint: 'rgba(163, 230, 53, 0.04)',
    elements: [
      { emoji: '🌱', top: '25%', left: '25%', size: '3rem' },
      { emoji: '🌱', top: '30%', left: '70%', size: '2.5rem' },
      { emoji: '🌸', top: '50%', left: '50%', size: '2.5rem' },
      { emoji: '🪑', top: '55%', left: '25%', size: '3rem' },
      { emoji: '☀️', top: '15%', left: '50%', size: '3.5rem' },
      { emoji: '🌤️', top: '65%', left: '75%', size: '2rem' },
    ],
  },
}

export default function RoomBackground() {
  const currentRoom = useGameStore(s => s.currentRoom)
  const [displayRoom, setDisplayRoom] = useState(currentRoom)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (currentRoom !== displayRoom) {
      setFading(true)
      const timer = setTimeout(() => {
        setDisplayRoom(currentRoom)
        setFading(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [currentRoom, displayRoom])

  const theme = ROOM_THEMES[displayRoom] || ROOM_THEMES.study

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-opacity duration-500"
      style={{
        backgroundColor: theme.tint,
        opacity: fading ? 0 : 1,
      }}
    >
      {theme.elements.map((el, i) => (
        <span
          key={`${displayRoom}-${i}`}
          className="absolute select-none"
          style={{
            top: el.top,
            left: el.left,
            fontSize: el.size,
            opacity: 0.07,
            filter: 'grayscale(60%)',
            transform: 'rotate(-5deg)',
          }}
        >
          {el.emoji}
        </span>
      ))}
    </div>
  )
}
