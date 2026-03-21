/** Shared color constants and floor styles for room furniture layers. */

export const C = {
  // Structural
  cabinet: '#5A6A7A',
  counter: '#6B7B8B',
  wood: '#7A5C3A',
  darkWood: '#5A3E2A',
  shelf: '#6B5030',
  shelfEdge: '#7A6040',

  // Appliances
  fridge: '#7A8A9A',
  oven: '#4A5565',
  ovenDoor: '#3A4555',
  stovetop: '#3A4555',
  burnerActive: '#D87A25',
  burnerIdle: '#5A6A7A',
  burnerGlow: '#4A2A15',
  washer: '#7A8A9A',
  washerDoor: '#5A6A7A',
  washerInner: '#4A5A6A',
  controlPanel: '#6A7A8A',

  // Sink
  sinkOuter: '#4A5A6A',
  sinkInner: '#3A5060',
  sinkRim: '#6A8A9A',

  // Soft furnishing
  sofa: '#5A6A80',
  cushion: '#4E5E70',
  chair: '#6A5A4A',

  // Tables
  table: '#7A5C3A',
  tableEdge: '#8A6C4A',
  coffeeTable: '#6A5030',

  // Electronics
  tv: '#2A3040',
  tvStand: '#4A4A4A',
  monitor: '#1A2535',
  monitorFrame: '#3A4555',
  keyboard: '#5A6A7A',

  // Bookshelf
  bookshelf: '#5A4530',
  bookshelfDiv: '#6A5540',
  bookRed: '#9A4040',
  bookBlue: '#406090',
  bookGreen: '#408060',
  bookYellow: '#908040',
  bookPurple: '#704080',

  // Bottles
  bottleRed: '#8A3030',
  bottleBlue: '#305080',
  bottleGreen: '#308050',
  bottleNeutral: '#605040',

  // Plants
  plant: '#4A8A5A',
  plantDark: '#3A7A4A',
  plantPink: '#C08090',
  potRed: '#8A5040',
  potCream: '#9A9890',
  potGreen: '#508050',

  // Misc
  dryingRack: '#6A7A8A',
  fileCabinet: '#5A6575',
  lamp: '#B8A060',
  lampGlow: '#B8A060',
  entrance: '#6A7A8A',
  label: '#7A8A9A',
  plateRim: '#7A8A8A',
  calendarWhite: '#E0E0D8',
  waterCan: '#4070A0',
  fertilizer: '#50A060',
}

export const FLOOR_STYLES: Record<string, { backgroundColor: string; backgroundImage?: string }> = {
  kitchen: {
    backgroundColor: '#262D38',
    backgroundImage: [
      'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(100,120,140,0.07) 19px, rgba(100,120,140,0.07) 20px)',
      'repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(100,120,140,0.07) 19px, rgba(100,120,140,0.07) 20px)',
    ].join(', '),
  },
  dining: {
    backgroundColor: '#2D2822',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(120,100,80,0.06) 39px, rgba(120,100,80,0.06) 40px)',
  },
  living_room: {
    backgroundColor: '#282A32',
  },
  study: {
    backgroundColor: '#2A2520',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(100,90,70,0.06) 29px, rgba(100,90,70,0.06) 30px)',
  },
  balcony: {
    backgroundColor: '#283028',
  },
}
