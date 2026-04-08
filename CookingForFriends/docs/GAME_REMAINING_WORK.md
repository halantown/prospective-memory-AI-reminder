# Game Remaining Work — Dev Guide & Prompts

> **Date**: 2026-03-25
> **Status**: Post visual-asset integration. All P0 items completed.
> **Scope**: 6 remaining game-side modules to reach pilot-ready state.

---

## Module Overview

| # | Module | Effort | Dependencies | Files Touched |
|---|--------|--------|--------------|---------------|
| 1 | Room Naming Alignment | 1h | None | 7 backend + 6 frontend files |
| 2 | Messages Day 2 & Day 3 | 2h | Module 1 (room labels) | 2 new JSON files + timeline_generator.py |
| 3 | Appliance State Indicators | 1.5h | None | 4 frontend + 1 backend files |
| 4 | Robot Pepper SVG + Movement | 2h | None | 2 frontend files |
| 5 | Practice Block | 1.5h | Module 4 (robot) | 3 frontend + 2 backend files |
| 6 | Onboarding Tutorial | 1.5h | Module 5 (practice) | 1 new frontend page |

**Recommended order**: 1 → 2 → 3 → 4 → 5 → 6 (each builds on the previous).

---

## Module 1: Room Naming Alignment

### Problem

The backend uses internal room IDs (`bedroom`, `bathroom`) that don't match the user-facing room semantics. The room called `bedroom` in code actually renders the Dining Room. The room called `bathroom` renders the Balcony/Laundry area. This causes confusion in encoding card text ("go to the bedroom" when the user sees "Dining Room").

### Current Mapping

| Backend ID | Frontend Label (WorldView.tsx) | Screenshot Label | Actual Content | PM Tasks Located Here |
|------------|-------------------------------|-----------------|----------------|----------------------|
| `kitchen` | Kitchen | Kitchen | Steak pans, oven, shelf | — (action destination only) |
| `bedroom` | Dining Room | Dining Room | Table setting (4 seats) | b1_giftbag, b2_napkinrings, b3_vase |
| `living_room` | Living Room | Living Room | Sofa, bookshelf, entrance | b1_dish, b2_pot, b3_speaker |
| `study` | Study | Study | Desk, monitor, shelf | b1_book, b2_vinyl, b3_hanger |
| `bathroom` | Balcony | Balcony | Washer, dryer, plants, supplies | b1_soap, b2_softener, b3_handcream |

### Solution

**Do NOT change backend IDs** — they're in the database, timeline engine, scorer, and PM task definitions. Instead:

1. Create a **display name mapping** used everywhere the user sees room names.
2. Update **encoding text** in `pm_tasks.py` to use display names instead of internal IDs.
3. Update the `target_room` that appears in encoding cards (user-facing) while keeping the backend `target_room` for scoring.

### Dev Prompt 1

```
## Context

In my experiment game "Cooking for Friends", room IDs in the backend don't match
user-facing labels. The backend uses `bedroom` for what's displayed as "Dining Room"
and `bathroom` for what's displayed as "Balcony". I need to add a display-name
mapping layer without changing any backend room IDs.

## Files to modify

### 1. Create `frontend/src/utils/roomLabels.ts`

```typescript
/** Room display names — maps internal IDs to user-facing labels. */

export const ROOM_LABELS: Record<string, string> = {
  kitchen: 'Kitchen',
  bedroom: 'Dining Room',
  living_room: 'Living Room',
  study: 'Study',
  bathroom: 'Balcony',
}

export const ROOM_DESCRIPTIONS: Record<string, string> = {
  kitchen: 'the kitchen counter',
  bedroom: 'the dining room sideboard',
  living_room: 'the living room display cabinet',
  study: 'the study bookcase',
  bathroom: 'the balcony shelf',
}

export function getRoomLabel(roomId: string): string {
  return ROOM_LABELS[roomId] || roomId
}
```

### 2. Update `frontend/src/components/game/WorldView.tsx`

Import `ROOM_LABELS` and use it for the `label` field in the `ROOMS` array:

```typescript
import { ROOM_LABELS } from '../../utils/roomLabels'

const ROOMS: RoomDef[] = [
  { id: 'kitchen',     label: ROOM_LABELS.kitchen,     emoji: '🍳', ... },
  { id: 'bedroom',     label: ROOM_LABELS.bedroom,     emoji: '🍽️', ... },
  { id: 'living_room', label: ROOM_LABELS.living_room,  emoji: '🛋️', ... },
  { id: 'study',       label: ROOM_LABELS.study,        emoji: '📚', ... },
  { id: 'bathroom',    label: ROOM_LABELS.bathroom,     emoji: '🌿', ... },
]
```

Note: Change bathroom emoji from 🚿 to 🌿 (it's a balcony with plants).

### 3. Update `frontend/src/components/game/PMTargetItems.tsx`

The `ROOM_LABELS` constant inside PMTargetItems.tsx (used for destination messages)
should import from the shared util instead of having its own copy:

```typescript
import { ROOM_LABELS } from '../../utils/roomLabels'
// Remove the local ROOM_LABELS object
```

### 4. Update `frontend/src/pages/game/EncodingPage.tsx`

Import `getRoomLabel` and use it when displaying the target room:

```typescript
import { getRoomLabel } from '../../utils/roomLabels'

// In the room display box, replace:
//   <p className="...">{ec.target_room}</p>
// With:
<p className="text-green-900 font-semibold">{getRoomLabel(ec.target_room)}</p>
```

### 5. Update `backend/engine/pm_tasks.py` — encoding text

Update ALL 12 task `encoding_text` fields to use user-facing room names.
Also update `target_room` display in `_task_def_to_encoding_card()`.

Specific changes (encoding_text only — do NOT change `target_room` field value):

- b1_giftbag: "go to the bedroom" → "go to the dining room sideboard"
  Full: "You ordered a birthday gift for Mei online. When the delivery notification arrives on your phone, go to the dining room and get a gift bag from the sideboard — the small blue bag with the bow. Bring it to the entrance to bag the gift."

- b1_soap: "go to the bathroom" → "go to the balcony"
  Full: "After you finish plating all three steaks, go to the balcony and get the hand soap from the shelf — the pump bottle with the lemon label. Put it by the kitchen sink so your guests can wash their hands before dinner."

- b2_napkinrings: "go to the bedroom" → "go to the dining room"
  Full: "After you finish setting the table for the first time, go to the dining room and get the napkin rings from the sideboard drawer — the set with wooden rings. Place them on the napkins at each seat."

- b2_softener: "go to the bathroom" → "go to the balcony"
  Full: "The dinner napkins are in the washing machine. When it finishes, go to the balcony and get the fabric softener from the shelf above the machine — the purple bottle with the lavender label. Add it to the dryer cycle."

- b3_vase: "go to the bedroom" → "go to the dining room"
  Full: "Sophie mentioned she would bring flowers. When she arrives with them, go to the dining room and get the vase from the sideboard — the small ceramic vase with blue glaze. Fill it with water in the kitchen and arrange the flowers."

- b3_handcream: "go to the bathroom" → "go to the balcony"
  Full: "Sophie might ask about the hand cream she liked at your place. If she messages about it, go to the balcony and find the tube on the shelf — the one with the lavender label. Bring it to Sophie."

Leave these UNCHANGED (already correct):
- b1_book: "go to the study" ✓
- b1_dish: "go to the living room" ✓
- b2_vinyl: "go to the study" ✓
- b2_pot: "go to the living room" ✓
- b3_hanger: "go to the study" ✓
- b3_speaker: "go to the living room" ✓

### 6. Update `backend/routers/admin.py` — `_task_def_to_encoding_card()`

Add a room label mapping to the encoding card JSON so the frontend has the
display name available:

```python
# At top of file
ROOM_DISPLAY_NAMES = {
    "kitchen": "Kitchen",
    "bedroom": "Dining Room",
    "living_room": "Living Room",
    "study": "Study",
    "bathroom": "Balcony",
}

def _task_def_to_encoding_card(task_def) -> dict:
    return {
        "trigger_description": task_def.trigger_event,
        "target_room": task_def.target_room,  # Keep internal ID for scoring
        "target_room_label": ROOM_DISPLAY_NAMES.get(task_def.target_room, task_def.target_room),
        # ... rest unchanged
    }
```

Then in EncodingPage.tsx, prefer `ec.target_room_label` over `ec.target_room` if available:

```tsx
<p className="text-green-900 font-semibold">
  {ec.target_room_label || getRoomLabel(ec.target_room)}
</p>
```
```

---

## Module 2: Messages Day 2 & Day 3

### Problem

Only `messages_day1.json` exists. Blocks 2 and 3 fall back to the same messages, with sender names (Alice, Emma, Tom, Jake) that don't match Block 2 (Lucas) and Block 3 (Sophie) guest themes.

### Design Rules

Each message file needs:
- **~20 Q&A messages** with 3-choice replies: arithmetic (~8), commonsense (~6), social (~6)
- **~5 ads** (no replies, `type: "ad"`)
- **~3 chat messages** (no replies, `type: "chat"`, friendly status updates)
- **2 PM trigger messages** for communication-type triggers (if any in that block)
- **Senders** should include the block's guest name + 3-4 recurring friends
- **Timing** (`t` field): messages spaced ~20-30s apart from t=30 to t=592
- **Difficulty**: arithmetic should mix easy (single-step) and medium (two-step). Only 1 correct answer per question.

### Dev Prompt 2

```
## Context

I need to create 2 new phone message pool JSON files for my experiment game.
The game simulates preparing dinner — during gameplay, the phone shows messages
from friends. Players must answer Q&A messages while managing cooking tasks.

Each block has a different dinner guest:
- Block 1 (existing): Mei — file is messages_day1.json
- Block 2 (new): Lucas — senders: Lucas, Nora, Ryan, Priya
- Block 3 (new): Sophie — senders: Sophie, Daniel, Mia, Kai

## File: backend/data/messages/messages_day2.json

Create this file following the EXACT same JSON structure as messages_day1.json.

Structure:
```json
{
  "block": 2,
  "messages": [
    {
      "id": "msg_001",
      "t": 30,
      "sender": "Nora",
      "avatar": "N",
      "text": "Question text here?",
      "type": "arithmetic",
      "replies": [
        {"id": "r1", "text": "Wrong answer", "correct": false},
        {"id": "r2", "text": "Correct answer", "correct": true},
        {"id": "r3", "text": "Wrong answer", "correct": false}
      ]
    }
  ]
}
```

Requirements for messages_day2.json (Block 2 — Lucas):
- 35-37 total messages
- Senders: Lucas, Nora, Ryan, Priya (rotate fairly evenly)
- ~8 arithmetic (mix of: addition, multiplication, time calculations, unit conversions, fractions)
- ~6 commonsense (dinner/cooking/hosting themed: wine pairing, food storage, table etiquette)
- ~6 social (dinner party themed: what to bring, music preferences, dietary needs)
- ~5 ads with fun fake brands (sender uses emoji + brand name, `"type": "ad"`, replies: null)
- ~3 chat (friendly updates: "on my way!", "running late", "can't wait!", replies: null)
- 2 PM trigger messages:
  - pm_trigger_001 at t=180: From Lucas, "Hey, do you have that vinyl I liked? The one we listened to last time? Would love to play it tonight!", type "pm_trigger", trigger_id "pm_b2_t1", replies null
  - pm_trigger_002 at t=540: From Ryan, "I can hear the washing machine beeping from outside!", type "pm_trigger", trigger_id "pm_b2_t3", replies null
- Timing: first message at t=30, last at t=592, spaced ~20-30s apart
- IDs: msg_001 through msg_023, ad_001 through ad_007, chat_001 through chat_004, pm_trigger_001, pm_trigger_002
- EXACTLY ONE correct answer per question (correct: true)
- Correct answer position should vary randomly across questions (not always r2)

## File: backend/data/messages/messages_day3.json

Same structure but for Block 3 — Sophie.
- Senders: Sophie, Daniel, Mia, Kai
- PM trigger messages:
  - pm_trigger_001 at t=330: From Sophie (visitor arrival context), "I'm at the door! I brought flowers for you 💐", type "pm_trigger", trigger_id "pm_b3_t2", replies null
  - pm_trigger_002 at t=410: From Sophie, "Hey by the way, do you still have that hand cream I loved last time? The one that smelled really nice?", type "pm_trigger", trigger_id "pm_b3_t4", replies null
- Same mix of arithmetic/commonsense/social/ads/chat
- Same ID pattern and timing spread
- Different questions from day1 and day2 (no repeats)

## Verification

After creating both files, verify:
1. Valid JSON (python -m json.tool < file.json)
2. All IDs are unique within each file
3. Exactly one correct answer per Q&A message
4. All pm_trigger messages have type "pm_trigger" and trigger_id field
5. t values are monotonically increasing
6. Total message count is 35-37 per file
```

---

## Module 3: Appliance State Indicators

### Problem

Three PM tasks use appliance triggers (oven preheat, washer done, dryer done) but the frontend appliance icons are static SVGs with no state changes when triggers fire.

### Current State

| Trigger | Task | Current Visual | Needed |
|---------|------|---------------|--------|
| `oven_indicator_green` | b1_dish | Static gray oven in KitchenFurniture.tsx | Green glow when preheated |
| `washer_indicator_done` | b2_softener | Static gray washer in BathroomFurniture.tsx | Blue→Green transition when done |
| `dryer_indicator_done` | b3_hanger | No dryer rendered | Add dryer + green indicator |

### Dev Prompt 3

```
## Context

My game has appliance-based PM triggers. When the timeline fires a pm_trigger
with trigger_event "oven_indicator_green", "washer_indicator_done", or
"dryer_indicator_done", the corresponding kitchen/balcony appliance should
show a visual state change (LED color, subtle glow animation). Currently
the appliances are static SVG furniture with no reactive state.

## Approach

Use Zustand store to track appliance states. The WebSocket handler already
receives pm_trigger events — we just need to extract trigger_event and
update store state. The furniture SVG components read from store and
conditionally apply CSS classes for glow/color.

## Files to modify

### 1. Add appliance state to `frontend/src/stores/gameStore.ts`

Add to state interface:
```typescript
// ── Appliance Indicators ──
applianceStates: Record<string, 'idle' | 'active' | 'done'>
```

Add to initial state:
```typescript
applianceStates: {
  oven: 'idle',
  washer: 'idle',
  dryer: 'idle',
},
```

Add action:
```typescript
setApplianceState: (appliance: string, state: 'idle' | 'active' | 'done') => void
```

Implementation:
```typescript
setApplianceState: (appliance, state) => set((s) => ({
  applianceStates: { ...s.applianceStates, [appliance]: state },
})),
```

Add to resetBlock:
```typescript
applianceStates: { oven: 'idle', washer: 'idle', dryer: 'idle' },
```

### 2. Update `frontend/src/hooks/useWebSocket.ts`

In the `pm_trigger` case handler, after `store.addTriggerEffect(triggerEvent)`,
add appliance state detection:

```typescript
// Update appliance state based on trigger visual
const applianceMap: Record<string, string> = {
  'oven_indicator_green': 'oven',
  'washer_indicator_done': 'washer',
  'dryer_indicator_done': 'dryer',
}
const appliance = applianceMap[triggerEvent]
if (appliance) {
  store.setApplianceState(appliance, 'done')
}
```

### 3. Update `frontend/src/components/game/rooms/KitchenFurniture.tsx`

Import store and read oven state:
```typescript
import { useGameStore } from '../../../stores/gameStore'

export default function KitchenFurniture() {
  const ovenState = useGameStore((s) => s.applianceStates.oven)
```

Replace the static oven indicator dot:
```xml
<!-- Current: -->
<circle cx="355" cy="285" r="3.5" fill={C.burnerActive} opacity="0.5" />

<!-- Replace with reactive indicator: -->
<circle
  cx="355" cy="285" r="3.5"
  fill={ovenState === 'done' ? '#27AE60' : '#95A5A6'}
  opacity={ovenState === 'done' ? 1 : 0.5}
>
  {ovenState === 'done' && (
    <animate attributeName="r" values="3.5;5;3.5" dur="1.5s" repeatCount="indefinite" />
  )}
</circle>
```

Also update the "OVEN" text to change color:
```xml
<text x="326" y="256" textAnchor="middle"
  fill={ovenState === 'done' ? '#27AE60' : C.label}
  fontSize="11" fontFamily="sans-serif"
  fontWeight={ovenState === 'done' ? 'bold' : 'normal'}>
  OVEN {ovenState === 'done' ? '✓' : ''}
</text>
```

### 4. Update `frontend/src/components/game/rooms/BathroomFurniture.tsx`

Import store and read washer/dryer states:
```typescript
import { useGameStore } from '../../../stores/gameStore'

export default function BathroomFurniture() {
  const washerState = useGameStore((s) => s.applianceStates.washer)
  const dryerState = useGameStore((s) => s.applianceStates.dryer)
```

Add a washer LED indicator on the control panel:
```xml
{/* Washer LED */}
<circle cx="120" cy="140" r="3"
  fill={washerState === 'done' ? '#27AE60' : '#95A5A6'}
>
  {washerState === 'done' && (
    <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
  )}
</circle>
```

Add a dryer (currently not rendered). Below the washing machine, add:
```xml
{/* ── Dryer (below washer) ── */}
<rect x="25" y="230" width="115" height="55" rx="5" fill={C.washer} />
<rect x="35" y="235" width="95" height="15" rx="2" fill={C.controlPanel} />
<circle cx="82" cy="265" r="18" fill={C.washerDoor} stroke="#8A9AAA" strokeWidth="1.5" />
<circle cx="82" cy="265" r="12" fill={C.washerInner} />
<text x="82" y="243" textAnchor="middle" fill={C.label} fontSize="7" fontFamily="sans-serif">
  DRYER
</text>
{/* Dryer LED */}
<circle cx="120" cy="242" r="3"
  fill={dryerState === 'done' ? '#27AE60' : '#95A5A6'}
>
  {dryerState === 'done' && (
    <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
  )}
</circle>
```

NOTE: You'll need to adjust the Y coordinates of the "Garden supplies" section
and the "Supplies" text to make room for the dryer. Push them down by ~60px.

### 5. Add to `frontend/src/index.css`

```css
/* Appliance done indicator pulse */
@keyframes appliance-pulse {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(39, 174, 96, 0.3)); }
  50% { filter: drop-shadow(0 0 8px rgba(39, 174, 96, 0.7)); }
}
.appliance-done {
  animation: appliance-pulse 1.5s ease-in-out infinite;
}
```
```

---

## Module 4: Robot Pepper SVG + Movement

### Problem

The robot is currently a 🤖 emoji pinned to bottom-left. The experiment design requires a Pepper robot character that moves between rooms, has idle animations, and delivers speech bubbles indistinguishable from neutral utterances.

### Dev Prompt 4

```
## Context

I need to replace the 🤖 emoji robot with a minimal 2D Pepper robot character.
The robot should:
- Appear as a simple but recognizable humanoid shape (white body, round head, tablet chest)
- Follow the participant to whatever room they're in (with a small delay)
- Have an idle bobbing animation
- Show speech bubbles (both neutral talk and PM reminders — visually identical)
- Move between rooms with a brief walking animation

## Files to create/modify

### 1. Create `frontend/src/components/game/PepperSprite.tsx`

A minimal SVG Pepper robot. Keep it simple — we need a recognizable silhouette
at ~50px height, not a detailed illustration.

```tsx
/** PepperSprite — minimal 2D Pepper robot SVG. */

export default function PepperSprite({ size = 50 }: { size?: number }) {
  const s = size / 50  // scale factor from base 50px
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 50 65" fill="none">
      {/* Head — round with eyes */}
      <circle cx="25" cy="12" r="10" fill="#F0F0F0" stroke="#D0D0D0" strokeWidth="0.8" />
      {/* Eyes */}
      <circle cx="21" cy="11" r="2" fill="#3498DB" />
      <circle cx="29" cy="11" r="2" fill="#3498DB" />
      {/* Eye shine */}
      <circle cx="22" cy="10" r="0.6" fill="white" />
      <circle cx="30" cy="10" r="0.6" fill="white" />
      {/* Mouth — small smile */}
      <path d="M22,15 Q25,17 28,15" fill="none" stroke="#BDC3C7" strokeWidth="0.8" strokeLinecap="round" />

      {/* Neck */}
      <rect x="23" y="22" width="4" height="4" rx="1" fill="#E0E0E0" />

      {/* Body — rounded torso */}
      <rect x="14" y="26" width="22" height="20" rx="6" fill="#F5F5F5" stroke="#D5D5D5" strokeWidth="0.8" />
      {/* Chest tablet */}
      <rect x="18" y="30" width="14" height="10" rx="2" fill="#2C3E50" />
      <rect x="20" y="32" width="10" height="6" rx="1" fill="#3498DB" opacity="0.6" />

      {/* Arms */}
      <ellipse cx="10" cy="34" rx="4" ry="7" fill="#F0F0F0" stroke="#D0D0D0" strokeWidth="0.5" />
      <ellipse cx="40" cy="34" rx="4" ry="7" fill="#F0F0F0" stroke="#D0D0D0" strokeWidth="0.5" />

      {/* Legs / base */}
      <ellipse cx="25" cy="50" rx="12" ry="4" fill="#E8E8E8" stroke="#D0D0D0" strokeWidth="0.5" />
      {/* Wheels hint */}
      <circle cx="19" cy="52" r="2" fill="#BDC3C7" />
      <circle cx="31" cy="52" r="2" fill="#BDC3C7" />

      {/* Name tag */}
      <text x="25" y="62" textAnchor="middle" fontSize="5" fill="#95A5A6"
        fontFamily="Helvetica,Arial,sans-serif">Pepper</text>
    </svg>
  )
}
```

### 2. Rewrite `frontend/src/components/game/RobotAvatar.tsx`

```tsx
/** Robot avatar — Pepper sprite + speech bubble + room following behavior. */

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import PepperSprite from './PepperSprite'

const FOLLOW_DELAY_MS = 2000  // Robot follows 2s after participant moves

export default function RobotAvatar() {
  const robot = useGameStore((s) => s.robot)
  const currentRoom = useGameStore((s) => s.currentRoom)
  const setRobotRoom = useGameStore((s) => s.setRobotRoom)
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Robot follows participant with a delay
  useEffect(() => {
    if (robot.room === currentRoom) return

    if (followTimerRef.current) clearTimeout(followTimerRef.current)
    followTimerRef.current = setTimeout(() => {
      setRobotRoom(currentRoom)
    }, FOLLOW_DELAY_MS)

    return () => {
      if (followTimerRef.current) clearTimeout(followTimerRef.current)
    }
  }, [currentRoom, robot.room, setRobotRoom])

  const inCurrentRoom = robot.room === currentRoom

  return (
    <div className={`absolute bottom-2 left-3 z-20 flex items-end gap-2
                     transition-opacity duration-500
                     ${inCurrentRoom ? 'opacity-100' : 'opacity-20'}`}>
      {/* Pepper sprite with idle animation */}
      <motion.div
        className="flex flex-col items-center"
        animate={
          robot.speaking
            ? { y: [0, -3, 0] }          // Speaking bounce
            : { y: [0, -2, 0, -1, 0] }   // Idle sway
        }
        transition={
          robot.speaking
            ? { repeat: Infinity, duration: 0.8 }
            : { repeat: Infinity, duration: 3, ease: 'easeInOut' }
        }
      >
        <PepperSprite size={48} />
      </motion.div>

      {/* Speech bubble — identical for neutral talk and PM reminders */}
      <AnimatePresence>
        {robot.speaking && robot.text && inCurrentRoom && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            className="bg-white text-slate-800 text-[11px] leading-relaxed
                       rounded-xl px-3 py-2 max-w-[220px] shadow-lg relative
                       border border-slate-200"
          >
            {robot.text}
            {/* Tail pointing to robot */}
            <div className="absolute bottom-1 left-[-6px] w-3 h-3 bg-white border-l border-b
                            border-slate-200 transform rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

### 3. Adjust speech bubble timing

Currently in `useWebSocket.ts`, robot_speak clears after 5000ms.
Increase to 6000ms for longer AF/AFCB reminders:
```typescript
case 'robot_speak':
  store.setRobotSpeaking(data.text as string)
  setTimeout(() => store.clearRobotSpeech(), 6000)
  break
```
```

---

## Module 5: Practice Block

### Problem

The experiment plan (§8) requires a ~2 minute practice block before Block 1. No PM tasks. Purpose: familiarize participants with steak flipping, table setting, phone interaction, room switching.

### Dev Prompt 5

```
## Context

I need a 2-minute practice block that runs BEFORE the first real block. It should
teach the participant how to:
1. Switch rooms (click to navigate)
2. Flip steaks (click pan when ready)
3. Place utensils on the table (drag or click)
4. Answer phone messages
5. Understand the robot (it will say something neutral)

No PM tasks. No scoring that matters. Just familiarization.

## Approach

Add a `practice` phase between `onboarding` and `encoding`. The practice block
uses a short timeline (120 seconds) with simplified events. A coach overlay
shows 4-5 sequential tips that fade in as relevant events occur.

## Files to modify

### 1. Create `backend/data/timelines/block_practice.json`

```json
{
  "block_number": 0,
  "condition": "PRACTICE",
  "day_story": "Practice: Getting familiar with the kitchen",
  "duration_seconds": 120,
  "events": [
    { "t": 0,   "type": "block_start", "data": {} },
    { "t": 0,   "type": "ongoing_task_event", "data": { "task": "steak", "event": "place_steak", "pan": 1, "room": "kitchen" } },
    { "t": 5,   "type": "ongoing_task_event", "data": { "task": "dining", "event": "table_ready", "room": "bedroom" } },
    { "t": 10,  "type": "ongoing_task_event", "data": { "task": "steak", "event": "place_steak", "pan": 2, "room": "kitchen" } },
    { "t": 15,  "type": "robot_speak", "data": { "text": "Welcome! I'm Pepper, your kitchen assistant. I'll be around if you need anything.", "log_tag": "neutral" } },
    { "t": 30,  "type": "phone_message", "data": { "message_id": "practice_msg_001" } },
    { "t": 40,  "type": "ongoing_task_event", "data": { "task": "steak", "event": "place_steak", "pan": 3, "room": "kitchen" } },
    { "t": 55,  "type": "phone_message", "data": { "message_id": "practice_msg_002" } },
    { "t": 60,  "type": "robot_speak", "data": { "text": "The steaks look like they need flipping soon!", "log_tag": "neutral" } },
    { "t": 70,  "type": "ongoing_task_event", "data": { "task": "steak", "event": "place_steak", "pan": 1, "room": "kitchen" } },
    { "t": 80,  "type": "phone_message", "data": { "message_id": "practice_msg_003" } },
    { "t": 90,  "type": "robot_speak", "data": { "text": "You're doing great! Try switching to other rooms too.", "log_tag": "neutral" } },
    { "t": 100, "type": "ongoing_task_event", "data": { "task": "steak", "event": "place_steak", "pan": 2, "room": "kitchen" } },
    { "t": 110, "type": "phone_message", "data": { "message_id": "practice_msg_004" } },
    { "t": 120, "type": "block_end", "data": {} }
  ]
}
```

### 2. Create `backend/data/messages/messages_practice.json`

```json
{
  "block": 0,
  "messages": [
    {
      "id": "practice_msg_001",
      "t": 30,
      "sender": "Tutorial",
      "avatar": "❓",
      "text": "This is a practice message! If 2 + 3 = ?",
      "type": "arithmetic",
      "replies": [
        {"id": "r1", "text": "4", "correct": false},
        {"id": "r2", "text": "5", "correct": true},
        {"id": "r3", "text": "6", "correct": false}
      ]
    },
    {
      "id": "practice_msg_002",
      "t": 55,
      "sender": "Tutorial",
      "avatar": "❓",
      "text": "Should you wash your hands before cooking?",
      "type": "commonsense",
      "replies": [
        {"id": "r1", "text": "Yes, always!", "correct": true},
        {"id": "r2", "text": "Only sometimes", "correct": false},
        {"id": "r3", "text": "No need", "correct": false}
      ]
    },
    {
      "id": "practice_msg_003",
      "t": 80,
      "sender": "Tutorial",
      "avatar": "❓",
      "text": "Try clicking on different rooms to explore the house!",
      "type": "chat",
      "replies": null
    },
    {
      "id": "practice_msg_004",
      "t": 110,
      "sender": "Tutorial",
      "avatar": "❓",
      "text": "Great job! The practice round is almost over.",
      "type": "chat",
      "replies": null
    }
  ]
}
```

### 3. Create `frontend/src/pages/game/PracticePage.tsx`

This is essentially GamePage but with a coach overlay and no PM tasks.
Reuse GamePage components (WorldView, PhoneSidebar, HUD, RobotAvatar)
but add a floating coach panel.

```tsx
/** Practice block — 2 minute tutorial with coach overlay. */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import WorldView from '../../components/game/WorldView'
import PhoneSidebar from '../../components/game/PhoneSidebar'
import HUD from '../../components/game/HUD'
import RobotAvatar from '../../components/game/RobotAvatar'

const TIPS = [
  { delay: 0,  text: "👋 Welcome! This is a practice round to help you learn the controls.", duration: 8000 },
  { delay: 3000, text: "🍳 The steaks in the kitchen will change color as they cook. Click a pan to flip or plate!", duration: 10000 },
  { delay: 35000, text: "📱 Check your phone on the right — tap to answer messages!", duration: 8000 },
  { delay: 50000, text: "🍽️ Try clicking the Dining Room to set the table. Drag utensils to seats!", duration: 10000 },
  { delay: 75000, text: "🏠 Click any room to move there. Try exploring all the rooms!", duration: 8000 },
  { delay: 100000, text: "✅ Great! You're ready for the real game. The practice will end shortly.", duration: 15000 },
]

export default function PracticePage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const wsSend = useGameStore((s) => s.wsSend)
  const [activeTip, setActiveTip] = useState<string | null>(TIPS[0].text)

  // Connect WebSocket with block 0 (practice)
  useWebSocket(sessionId, 0)

  // Send start_game for practice block
  useEffect(() => {
    if (wsSend && phase === 'practice') {
      wsSend({ type: 'start_game', data: { block_number: 0 } })
    }
  }, [wsSend, phase])

  // Schedule tips
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const tip of TIPS) {
      timers.push(setTimeout(() => setActiveTip(tip.text), tip.delay))
      timers.push(setTimeout(() => setActiveTip(null), tip.delay + tip.duration))
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  // Listen for block_end to transition
  useEffect(() => {
    if (phase === 'encoding') return  // Already transitioned
    // The useWebSocket handler sets phase to 'microbreak' on block_end.
    // For practice, we intercept and go to encoding instead.
  }, [phase])

  // Override microbreak → go to encoding (block 1)
  useEffect(() => {
    if (phase === 'microbreak') {
      // Practice is done, skip microbreak, go to encoding for block 1
      const store = useGameStore.getState()
      store.resetBlock()
      store.setBlockNumber(1)
      setPhase('encoding')
    }
  }, [phase, setPhase])

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-900 select-none">
      <div className="relative flex-1" style={{ width: '75%' }}>
        <WorldView />
        <HUD />
        <RobotAvatar />

        {/* Practice label */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
          <span className="bg-amber-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
            🎓 PRACTICE ROUND
          </span>
        </div>

        {/* Coach tip overlay */}
        <AnimatePresence>
          {activeTip && (
            <motion.div
              key={activeTip}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30
                         bg-white/95 backdrop-blur text-slate-800 text-sm
                         font-medium px-5 py-3 rounded-2xl shadow-xl
                         max-w-[420px] text-center border border-slate-200"
            >
              {activeTip}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-[25%] min-w-[280px] max-w-[360px]">
        <PhoneSidebar />
      </div>
    </div>
  )
}
```

### 4. Update `frontend/src/types/index.ts`

Add `'practice'` to the Phase type:
```typescript
export type Phase =
  | 'welcome'
  | 'onboarding'
  | 'practice'    // ← add this
  | 'encoding'
  | 'playing'
  | 'microbreak'
  | 'block_end'
  | 'debrief'
  | 'complete'
```

### 5. Update `frontend/src/App.tsx`

Add practice case to the GameShell switch:
```typescript
import PracticePage from './pages/game/PracticePage'

// In the switch:
case 'practice':
  return <PracticePage />
```

### 6. Update flow: after onboarding, go to practice instead of encoding

In WelcomePage.tsx (or wherever the session starts), after successful login,
if this is the participant's first time (block 1, status was REGISTERED):
```typescript
// Instead of:  setPhase('encoding')
// Do:          setPhase('practice')
```

For returning participants (re-join), skip practice and go directly to the
appropriate phase based on session status.

### 7. Backend: handle practice block

In `backend/websocket/game_handler.py` `_handle_start_game`, the practice
block (block_number=0) won't have a Block record in the DB. Add a guard:

```python
if block_number == 0:
    # Practice block — run timeline directly without DB block
    logger.info(f"[GAME_HANDLER] Starting practice timeline for {participant_id}")
    task = await run_timeline(
        participant_id=participant_id,
        block_number=0,
        condition="PRACTICE",
        send_fn=send_fn,
        db_factory=db_factory,
    )
    return
```

In `backend/engine/timeline.py` `load_timeline`, add fallback for practice:
```python
if block_number == 0:
    path = DATA_DIR / "timelines" / "block_practice.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {"events": [], "duration_seconds": 120}
```
```

---

## Module 6: Onboarding Tutorial

### Problem

No onboarding page exists. Participants jump from the Welcome page (token login) directly into encoding. They need a brief interactive introduction explaining the game scenario and controls.

### Dev Prompt 6

```
## Context

I need an onboarding page that appears after token login, before the practice
block. It should be a multi-step walkthrough (4-5 slides) explaining:

1. Story: "You're preparing dinner for friends over 3 evenings"
2. Layout: Kitchen (cooking), Dining Room (table setting), Phone (messages)
3. How to: Switch rooms, flip steaks, place utensils, answer messages
4. The robot: "Pepper will be around — sometimes it talks, just listen"
5. Important: "During the game, you'll need to remember some tasks. We'll
   tell you about them before each round."

Simple, clean, full-screen slides with illustrations or screenshots.
No complex animations. A "Next" button advances. Last slide has "Start Practice".

## File: `frontend/src/pages/game/OnboardingPage.tsx`

```tsx
/** Onboarding — 5-step game introduction before practice block. */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'

const SLIDES = [
  {
    title: 'Welcome to Cooking for Friends!',
    emoji: '🍳',
    body: 'Over the next three evenings, you\'ll be preparing dinner for different friends. Each evening lasts about 10 minutes.',
    detail: 'Your goal is to cook, set the table, and manage messages — all at the same time!',
  },
  {
    title: 'Your Kitchen & Home',
    emoji: '🏠',
    body: 'You have 5 rooms: Kitchen, Dining Room, Living Room, Study, and Balcony. Click any room to move there.',
    detail: 'You can see all rooms at once, but you can only interact with the room you\'re in. Other rooms will be slightly dimmed.',
  },
  {
    title: 'Three Tasks at Once',
    emoji: '⚡',
    body: 'In the Kitchen, steaks are cooking — flip them before they burn! In the Dining Room, set the table by dragging utensils. On your Phone, answer messages from friends.',
    detail: 'Steaks keep cooking even when you\'re in another room, so keep an eye on them!',
  },
  {
    title: 'Meet Pepper',
    emoji: '🤖',
    body: 'Pepper is your robot assistant. It moves around the house and sometimes talks to you. Just listen to what it says.',
    detail: 'Pepper\'s comments are a normal part of the experience — no need to do anything special when it speaks.',
  },
  {
    title: 'Remember Your Tasks',
    emoji: '🧠',
    body: 'Before each round, you\'ll see some task cards. Read them carefully — during the game, you\'ll need to remember and complete these tasks when the right moment comes.',
    detail: 'We\'ll quiz you briefly to make sure you remember. Then the cooking begins!',
  },
]

export default function OnboardingPage() {
  const setPhase = useGameStore((s) => s.setPhase)
  const [step, setStep] = useState(0)
  const isLast = step === SLIDES.length - 1
  const slide = SLIDES[step]

  const handleNext = () => {
    if (isLast) {
      setPhase('practice')
    } else {
      setStep(step + 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900
                    flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {SLIDES.map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i <= step ? 'bg-cooking-500' : 'bg-slate-200'
            }`} />
          ))}
        </div>

        {/* Slide content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="px-8 py-8 text-center"
          >
            <div className="text-5xl mb-4">{slide.emoji}</div>
            <h2 className="text-xl font-bold text-slate-800 mb-3">{slide.title}</h2>
            <p className="text-slate-600 leading-relaxed mb-3">{slide.body}</p>
            <p className="text-sm text-slate-400 leading-relaxed">{slide.detail}</p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="text-sm text-slate-400 hover:text-slate-600 disabled:invisible
                       transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-cooking-500 hover:bg-cooking-600 text-white
                       font-bold rounded-xl transition-colors text-sm"
          >
            {isLast ? '🎓 Start Practice' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Update `frontend/src/App.tsx`

```typescript
import OnboardingPage from './pages/game/OnboardingPage'

// In the switch:
case 'onboarding':
  return <OnboardingPage />
```

### Update `frontend/src/pages/game/WelcomePage.tsx`

Change the post-login flow. For first-time participants:
```typescript
// After successful login, if first time:
if (status.status === 'in_progress' && status.phase === 'encoding' && data.current_block === 1) {
  setPhase('onboarding')  // → onboarding → practice → encoding
} else {
  // Returning participant — resume at appropriate phase
}
```

For the DEV_TOKEN quick path, allow skipping: check if URL has `?skip_onboarding=1`
and go directly to encoding.
```

---

## Execution Checklist

After implementing all 6 modules:

- [ ] `npm run build` succeeds
- [ ] Room labels show "Dining Room" and "Balcony" (not "Bedroom"/"Bathroom")
- [ ] Encoding cards say "go to the dining room" / "go to the balcony"
- [ ] Block 2 phone messages come from Lucas/Nora/Ryan/Priya
- [ ] Block 3 phone messages come from Sophie/Daniel/Mia/Kai
- [ ] Oven shows green LED after pm_trigger with oven_indicator_green
- [ ] Washer/dryer show green LED after respective triggers
- [ ] Robot is a Pepper SVG sprite (not 🤖 emoji)
- [ ] Robot follows participant between rooms with ~2s delay
- [ ] Speech bubble appears for both neutral talk and reminders (identical)
- [ ] New participant flow: Welcome → Onboarding (5 slides) → Practice (2 min) → Encoding
- [ ] Returning participant skips onboarding/practice
- [ ] Practice block has steaks, table setting, phone messages, robot speech
- [ ] Practice block ends → transitions to Block 1 encoding
- [ ] Full 3-block run completes without errors
