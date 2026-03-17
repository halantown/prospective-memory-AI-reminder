// Room definitions: position, size, colors, furniture, and trigger mappings
// Scene container: 1400×800 fixed aspect ratio

export const SCENE_WIDTH = 1400
export const SCENE_HEIGHT = 800

// Room layout positions (% based for responsive scaling within container)
export const ROOMS = {
  study: {
    label: 'Study',
    x: 20, y: 20, w: 280, h: 260,   // pixels within 1400x800
    color: '#e0f2fe',  // light blue
    borderColor: '#93c5fd',
    workSpot: { x: 140, y: 150 },
    furniture: [
      { emoji: '💻', x: 100, y: 80, label: 'Computer' },
      { emoji: '📚', x: 200, y: 60, label: 'Bookshelf' },
      { emoji: '🪑', x: 140, y: 180, label: 'Chair' },
    ],
  },
  kitchen: {
    label: 'Kitchen',
    x: 330, y: 20, w: 280, h: 260,
    color: '#fef3c7',  // warm cream
    borderColor: '#fcd34d',
    workSpot: { x: 140, y: 150 },
    furniture: [
      { emoji: '🍳', x: 60, y: 60, label: 'Stove' },
      { emoji: '🍽️', x: 160, y: 120, label: 'Dinner table', triggerId: 'dinner_table' },
      { emoji: '⏲️', x: 220, y: 60, label: 'Pressure cooker', triggerId: 'kitchen_timer' },
    ],
  },
  living: {
    label: 'Living Room',
    x: 640, y: 20, w: 440, h: 360,
    color: '#fef9ef',  // soft beige
    borderColor: '#d4a574',
    workSpot: { x: 220, y: 200 },
    furniture: [
      { emoji: '🛋️', x: 100, y: 160, label: 'Sofa' },
      { emoji: '📺', x: 300, y: 60, label: 'TV', triggerId: 'tv_weather' },
      { emoji: '☕', x: 200, y: 240, label: 'Coffee table' },
      { emoji: '💬', x: 360, y: 200, label: 'Friend spot', triggerId: 'friend_leaving' },
    ],
  },
  laundry: {
    label: 'Laundry',
    x: 20, y: 310, w: 280, h: 240,
    color: '#f3f4f6',  // light grey
    borderColor: '#9ca3af',
    workSpot: { x: 140, y: 130 },
    furniture: [
      { emoji: '🫧', x: 100, y: 80, label: 'Washing machine', triggerId: 'washing_machine' },
      { emoji: '🧺', x: 200, y: 160, label: 'Laundry basket' },
    ],
  },
  entrance: {
    label: 'Entrance',
    x: 330, y: 310, w: 280, h: 240,
    color: '#ecfdf5',  // light green
    borderColor: '#6ee7b7',
    workSpot: { x: 140, y: 130 },
    furniture: [
      { emoji: '🚪', x: 140, y: 60, label: 'Door', triggerId: 'doorbell' },
      { emoji: '📱', x: 60, y: 150, label: 'Phone', triggerId: 'phone_notification' },
      { emoji: '👟', x: 220, y: 170, label: 'Shoe rack' },
    ],
  },
  balcony: {
    label: 'Balcony',
    x: 640, y: 410, w: 440, h: 240,
    color: '#fefce8',  // light yellow
    borderColor: '#fde047',
    workSpot: { x: 220, y: 130 },
    furniture: [
      { emoji: '🪑', x: 100, y: 80, label: 'Chair' },
      { emoji: '🌱', x: 300, y: 60, label: 'Plants' },
      { emoji: '🌤️', x: 200, y: 160, label: 'Railing' },
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
