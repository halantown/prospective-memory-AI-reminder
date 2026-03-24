// Room definitions: position, size, colors, furniture, and trigger mappings
// Scene container: 1400×800 fixed aspect ratio

export const SCENE_WIDTH = 1400
export const SCENE_HEIGHT = 800

// Room layout positions (pixels within 1400×800 container)
// Layout fills the scene with hallway gaps between rooms
export const ROOMS = {
  study: {
    label: 'Study',
    x: 20, y: 20, w: 340, h: 340,
    color: '#e0f2fe',  // light blue
    borderColor: '#93c5fd',
    workSpot: { x: 170, y: 190 },
    furniture: [
      { emoji: '💻', x: 120, y: 90, label: 'Computer' },
      { emoji: '📚', x: 260, y: 60, label: 'Bookshelf' },
      { emoji: '🪑', x: 160, y: 220, label: 'Chair' },
    ],
  },
  kitchen: {
    label: 'Kitchen',
    x: 390, y: 20, w: 340, h: 340,
    color: '#fef3c7',  // warm cream
    borderColor: '#fcd34d',
    workSpot: { x: 170, y: 190 },
    furniture: [
      { emoji: '🍳', x: 70, y: 80, label: 'Stove' },
      { emoji: '🍽️', x: 180, y: 150, label: 'Dinner table', triggerId: 'dinner_table' },
      { emoji: '⏲️', x: 270, y: 80, label: 'Pressure cooker', triggerId: 'kitchen_timer' },
    ],
  },
  living: {
    label: 'Living Room',
    x: 760, y: 20, w: 620, h: 370,
    color: '#fef9ef',  // soft beige
    borderColor: '#d4a574',
    workSpot: { x: 310, y: 200 },
    furniture: [
      { emoji: '🛋️', x: 140, y: 180, label: 'Sofa' },
      { emoji: '📺', x: 420, y: 70, label: 'TV', triggerId: 'tv_weather' },
      { emoji: '☕', x: 280, y: 260, label: 'Coffee table' },
      { emoji: '💬', x: 520, y: 220, label: 'Friend spot', triggerId: 'friend_leaving' },
      { emoji: '🕐', x: 50, y: 50, label: 'Wall clock', triggerId: 'clock_3pm' },
    ],
  },
  laundry: {
    label: 'Laundry',
    x: 20, y: 390, w: 340, h: 290,
    color: '#f3f4f6',  // light grey
    borderColor: '#9ca3af',
    workSpot: { x: 170, y: 150 },
    furniture: [
      { emoji: '🫧', x: 120, y: 100, label: 'Washing machine', triggerId: 'washing_machine' },
      { emoji: '🧺', x: 250, y: 180, label: 'Laundry basket' },
    ],
  },
  entrance: {
    label: 'Entrance',
    x: 390, y: 390, w: 340, h: 290,
    color: '#ecfdf5',  // light green
    borderColor: '#6ee7b7',
    workSpot: { x: 170, y: 150 },
    furniture: [
      { emoji: '🚪', x: 170, y: 70, label: 'Door', triggerId: 'doorbell' },
      { emoji: '📱', x: 70, y: 180, label: 'Phone', triggerId: 'phone_notification' },
      { emoji: '👟', x: 270, y: 200, label: 'Shoe rack' },
    ],
  },
  balcony: {
    label: 'Balcony',
    x: 760, y: 420, w: 620, h: 260,
    color: '#fefce8',  // light yellow
    borderColor: '#fde047',
    workSpot: { x: 310, y: 140 },
    furniture: [
      { emoji: '🪑', x: 140, y: 90, label: 'Chair' },
      { emoji: '🌱', x: 420, y: 70, label: 'Plants' },
      { emoji: '🌤️', x: 280, y: 180, label: 'Railing' },
    ],
  },
}

// HUD clock trigger (special — not in a room)
export const CLOCK_TRIGGER_ID = 'clock_3pm'

// Map trigger IDs to their room for edge notification positioning
export const TRIGGER_ROOM_MAP = {}
Object.entries(ROOMS).forEach(([roomId, room]) => {
  room.furniture.forEach(f => {
    if (f.triggerId) {
      TRIGGER_ROOM_MAP[f.triggerId] = roomId
    }
  })
})
