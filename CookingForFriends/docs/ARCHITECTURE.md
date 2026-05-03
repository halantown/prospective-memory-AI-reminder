# CookingForFriends — Technical Architecture

> Prospective Memory (PM) experiment platform with real-time game, phone distractor,
> adaptive reminders, and granular behavioural data capture.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Frontend  (React 18 + Vite + TypeScript + Tailwind + Zustand)         │
│  ├── EncodingPage   — task card study + quiz                           │
│  ├── GamePage       — FloorPlanView (flex-1) + PhoneSidebar (440px)    │
│  │   ├── FloorPlanView: zoomable floorplan.png, room navigation,       │
│  │   │     KitchenFurniture + KitchenRoom overlay, character/robot     │
│  │   ├── PhoneSidebar: iPhone shell with chat, recipes, timers         │
│  │   ├── HUD: game clock overlay                                       │
│  │   ├── PMInteraction: PM task popup (room + item select)             │
│  │   └── TriggerEffects: visual/audio effects for PM triggers          │
│  └── MicroBreak / Debrief / Welcome / Admin pages                     │
│                                                                         │
│            REST (api.ts)        WebSocket (useWebSocket.ts)             │
│              ↕                        ↕                                 │
│         /api/*                  /ws/game/{session}/{block}              │
├─────────────────────────────────────────────────────────────────────────┤
│  Backend  (FastAPI + SQLAlchemy Async + PostgreSQL)                     │
│  ├── routers/session.py    — token login, encoding, quiz, NASA-TLX     │
│  ├── routers/admin.py      — participant CRUD, assignment, monitoring   │
│  ├── websocket/             — game_handler, connection_manager          │
│  ├── engine/                                                            │
│  │   ├── timeline.py        — event scheduler (runs per block)         │
│  │   ├── timeline_generator.py — builds event list from task registry  │
│  │   ├── execution_window.py — silent 30s+60s PM scoring timer         │
│  │   ├── pm_scorer.py       — 0-6 score computation                    │
│  │   ├── pm_tasks.py        — 12 PM task definitions (dataclass)       │
│  │   └── message_loader.py  — phone message pool (JSON)                │
│  └── models/                — SQLAlchemy ORM (experiment, block, logs)  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Game Flow (Per Participant)

```
welcome → [block 1..3]:
  encoding → playing (600s) → microbreak (NASA-TLX)
→ debrief → complete
```

### Encoding Phase
1. Backend returns PM task cards for the block (`GET /api/session/{id}/block/{n}/encoding`)
2. Participant reads each card (10s minimum read time)
3. Multi-question quiz per card (trigger, target, action)
4. Wrong answers → re-show card with highlight → retry (max 2 fails then auto-pass)

### Playing Phase
- **Duration**: 900 gameplay seconds; display clock spans 17:00–18:00 via `clock_end_seconds=600`
- **Time ticks**: emitted every 10 gameplay seconds (= 1 displayed minute)
- **Layout**: `FloorPlanView` (flex-1) + `PhoneSidebar` (440px fixed)
- **Ongoing tasks**: Multi-dish cooking engine (4 dishes, backend-driven steps with distractors at kitchen stations)
- **PM triggers**: 4 per block, at predefined times or activity-based
- **Phone messages**: Chat, ads, social — arrive on schedule from JSON pool
- **Robot**: Moves between rooms, speaks reminders/neutral utterances

### PM Interaction Flow
```
Backend fires pm_trigger → Frontend addPMTrial() → User enters target room
→ Clicks furniture (e.g., bookshelf) → Popup shows 3 items (target + 2 distractors)
→ Selects item → Confirms → pm_attempt sent → Backend scores (0-6)
```

---

## 3. WebSocket Protocol

### Connection
```
ws://host/ws/game/{session_id}/{block_number}?auto_start={bool}
```

### Server → Client Events

| Event | Data | Description |
|-------|------|-------------|
| `block_start` | `{}` | Block timeline started |
| `time_tick` | `{elapsed, game_time_s, game_clock, frozen, clock_end_seconds}` | Pause-aware gameplay clock update (every 10 game seconds; `elapsed` kept for compatibility) |
| `pm_trigger` | `{trigger_id, trigger_event, task_config, server_trigger_ts}` | PM task activated |
| `fake_trigger` | `{trigger_type, duration}` | Decoy trigger (no PM task) |
| `phone_message` | `{id, channel, text, contact_id?, correct_choice?, wrong_choice?, correct_position?, feedback_correct?, feedback_incorrect?, sender?}` | Chat message (`channel:"chat"`) or system notification (`channel:"notification"`) |
| `kitchen_timer` | `{id, icon, message}` | Kitchen timer modal (blocking) |
| `robot_speak` | `{text}` | Robot speech bubble |
| `robot_move` | `{to_room}` | Robot changes room |
| `ongoing_task_event` | `{task, event, ...}` | Cooking step activate/result/timeout, dining state change |
| `block_end` | `{}` | Block complete |
| `keepalive` | `{}` | Connection keepalive (every 5s) |

### Client → Server Messages

| Type | Data | Description |
|------|------|-------------|
| `start_game` | `{block_number}` | Begin timeline |
| `heartbeat` | `{timestamp}` | Alive signal (every 10s) |
| `room_switch` | `{from, to, timestamp}` | User navigated rooms |
| `pm_attempt` | `{target_selected, action_step, room, timestamp}` | PM response |
| `trigger_ack` | `{trigger_id, received_at}` | Trigger receipt confirmation |
| `task_action` | `{task, event, timestamp}` | Ongoing task interaction |
| `phone_unlock` | `{timestamp}` | Phone unlocked |
| `phone_reply` | `{message_id, contact_id, chosen_text, is_correct, correct_position_shown, timestamp}` | Chat message answered |
| `phone_read` | `{contact_id, timestamp}` | Contact chat viewed (all messages marked read) |
| `phone_contact_switch` | `{fromContactId, toContactId, timestamp}` | User switched to different contact |
| `phone_tab_switch` | `{tab, timestamp}` | User switched between Chats/Recipe tabs |
| `kitchen_timer_acknowledged` | `{timerId, timestamp, reactionTime}` | Kitchen timer modal dismissed |
| `mouse_position` | `{positions: [{x, y, t}]}` | Mouse trajectory batch |

---

## 4. PM Scoring System (0–6 Scale)

| Score | Criteria |
|-------|----------|
| **6** | Correct room + target + action within 15s |
| **5** | Correct room + target + action within 30s |
| **4** | Correct room + target, wrong action |
| **3** | Correct room, wrong target |
| **2** | Wrong room but showed PM intent |
| **1** | Response in late window (30–60s) |
| **0** | No response within 60s (auto-scored) |

### Execution Window
- **Primary**: 0–30s — full scoring available (2–6)
- **Late**: 30–60s — score capped at 1
- **Expired**: ≥60s — auto-score 0
- Frontend is **never informed** about the window — it's a silent backend timer.

---

## 5. State Management (Frontend)

**Stores**: Zustand.
- `gameStore.ts` — main flat store (see below)
- `characterStore.ts` — avatar movement state (separate to avoid coupling cooking logic with movement)

`gameStore.ts` key state sections:
- **Session**: sessionId, participantId, group, conditionOrder, blockNumber, phase
- **Room**: currentRoom, previousRoom, avatarMoving
- **Character** (in `characterStore`): position {x,y}, currentWaypointId, isMoving, facing, animation, idleBubble
- **Kitchen**: activeCookingSteps, cookingWaitSteps, completedDishes (cooking engine state)
- **Dining**: diningPhase, seats (6), utensils, round, score
- **Phone**:
  - `phoneMessages: PhoneMessage[]` — chat messages (channel `"chat"`) only; notifications are banner-only
  - `contacts: Contact[]` — loaded from backend on block start; contacts with no messages are hidden in ContactStrip until first message arrives
  - `activeContactId: string | null` — currently viewed contact
  - `activePhoneTab: 'chats' | 'recipe'`
  - `phoneLocked: boolean`, `phoneLastActivity: number`
  - `phoneBanner: PhoneMessage | null` — auto-dismissed notification or cross-contact chat alert
  - Cooking timer UI is derived from `activeCookingSteps`; there is no separate timer queue
  - `lockSystemNotifications[]` — system notifications accumulated on lock screen (persist until session reset)
- **PM**: activePMTrials, completedPMTrialIds
- **Robot**: room, speaking, speechText
- **Clock**: gameClock, elapsedSeconds

### PhoneMessage fields
```typescript
{
  id, text, channel: 'chat' | 'notification',
  contactId?,            // chat messages only
  correctChoice?,        // question text (correct answer)
  wrongChoice?,          // question text (wrong answer)
  correctPosition?,      // null = frontend randomizes; 0|1 = forced
  feedbackCorrect?,      // friend's reply if answered correctly
  feedbackIncorrect?,    // friend's reply if answered incorrectly
  sender?,               // notification messages only
  timestamp, read, answered, answeredCorrect?,
  feedbackVisible?,      // true after 2.5s delay post-answer (persisted in store)
  userChoice?,           // the text the participant actually chose
}
```

---

## 6. Frontend Architecture

### Page Layout (`GamePage`)

```
┌────────────────────────────────────────────┬──────────────┐
│  FloorPlanView  (flex-1, relative)          │ PhoneSidebar │
│  ┌──────────────────────────────────────┐  │   (440px)    │
│  │  zoomable div (transform: scale/translate) │         │
│  │  ├── <img floorplan.png>             │  │  iPhone shell│
│  │  ├── Kitchen overlay div (0%,0%,49.5%,41%)│         │
│  │  │   ├── KitchenFurniture (sprites)  │  │  LockScreen  │
│  │  │   └── KitchenRoom (hotspots)      │  │  ContactStrip│
│  │  ├── Room click targets (overview)   │  │  ChatView    │
│  │  ├── Virtual character sprite        │  │  RecipeTab   │
│  │  └── Pepper robot sprite             │  │  TimerModal  │
│  └──────────────────────────────────────┘  │  NofifBanner │
│  ├── HUD (clock overlay)                   └──────────────┘
│  ├── PMInteraction (PM popup)
│  └── TriggerEffects (visual effects)
└────────────────────────────────────────────────────────────
```

### FloorPlanView — Two Modes

**Overview mode** (initial state):
- Full 1536×1024 floorplan visible at 1:1 scale
- 5 transparent room click targets overlaid at correct positions
- Hover shows room label + amber highlight
- Click enters room (zoom in)

**Zoomed mode** (after room click):
- `ZOOM_SCALE = 1.6×`, `transform-origin: 0 0`
- Room center is brought to viewport center; translation is clamped so image never shows black borders
- Room click targets are hidden
- Edge navigation buttons appear (direction-aware, based on `ADJACENCY` map)
- If `currentRoom === 'kitchen'`: `KitchenRoom` hotspots become active

### Room Definitions (`ROOM_DEFS`)

| Room | Bounding box (% of 1536×1024) | Center |
|------|-------------------------------|--------|
| kitchen | x=0, y=0, w=44%, h=41% | cx=21%, cy=20% |
| dining_hall | x=56%, y=0, w=44%, h=33% | cx=78%, cy=16% |
| bedroom | x=0, y=52%, w=33%, h=48% | cx=16%, cy=76% |
| bathroom | x=33%, y=56%, w=25%, h=44% | cx=45%, cy=78% |
| living_room | x=56%, y=34%, w=44%, h=66% | cx=77%, cy=65% |

### Kitchen Overlay Layer

Rendered at `position:absolute, left:0%, top:0%, width:49.5%, height:41%` (kitchen bounding box).

```
Kitchen overlay div
├── KitchenFurniture    — always visible (sprite images or dashed outlines)
│     Station assets: public/assets/kitchen/<station_id>.png (256×256 PNG)
│     Fallback: transparent dashed outline placeholder
└── KitchenRoom         — only rendered when currentRoom === 'kitchen'
      ├── Station hotspot buttons (positioned by STATION_POSITIONS %)
      │     Glow ring when a step is active at that station
      │     Click → opens StationPopup
      ├── StationPopup  — option picker (2–4 choices)
      │     Sends task_action {event:"step_attempt"} on click
      └── CountdownBar + DishProgressStrip (top of kitchen area)
```

**Station positions** (% of kitchen bounding box):

| Station | left | top | width | height |
|---------|------|-----|-------|--------|
| burner1 | 29.1% | 12.25% | 12% | 16.5% |
| burner2 | hidden | hidden | 0% | 0% |
| burner3 | hidden | hidden | 0% | 0% |
| oven | 13.1% | 24% | 12% | 12% |
| fridge | 84.4% | 5% | 9% | 28% |
| cutting_board | 54.2% | 15.5% | 15.1% | 9% |
| spice_rack | 77.3% | 13% | 8% | 12% |
| plating_area | 51.5% | 51% | 14.2% | 19% |

### Character Waypoint Movement

Avatar movement is driven by `frontend/src/stores/characterStore.ts` and
`frontend/src/data/waypoints.json`.

- Kitchen top-row stations (`oven`, `burner1`, `cutting_board`, `spice_rack`,
  `fridge`) share the same waypoint y-coordinate and are connected horizontally,
  so moving between them does not detour through the lower kitchen center.
- `kitchen_center` is the vertical transfer point for `plating_area`; it shares
  the same x-coordinate as `plating_area`.
- Routes to `plating_area` go through `kitchen_center`, then vertically down to
  the plating waypoint.

### PhoneSidebar Components

```
PhoneSidebar
├── LockScreen          — per-contact notification summaries, unlock on interact
├── ContactStrip        — avatar list (hidden until first message from contact)
├── ChatView            — WhatsApp-style thread with question cards
├── RecipeTab           — long-press recipe viewer (4 dishes, 2×2 grid)
├── PhoneTabBar         — Chats / Recipe toggle
├── KitchenTimerModal   — blocking overlay, must be manually dismissed
└── NotificationBanner  — top-of-screen toast (auto-dismiss)
```

Lock timeout: **15 seconds** of inactivity.

### Character Movement System

Avatar is a sprite-animated character that walks between kitchen stations and navigates cross-room via camera cuts.

#### Component hierarchy

```
FloorPlanView → zoom div (absolute)
  ├── <img floorplan.png>
  ├── PlayerAvatar         — absolute, coordinates = % of full floorplan
  │     └── AvatarSprite   — CSS spritesheet animation (48×96px frames)
  └── WaypointEditor       — dev-only SVG overlay (DEV mode toggle)
```

#### Files

| File | Purpose |
|------|---------|
| `src/stores/characterStore.ts` | Zustand store: rAF movement loop, BFS pathfinding, station callback, idle bubble |
| `src/utils/waypointGraph.ts` | BFS (`bfsPath`), types (`WaypointData`, `RoomPointSpec`), `resolveRoomPoint()` |
| `src/data/waypoints.json` | Waypoint coordinates, edges, `room_meta` exit/entry per room |
| `src/components/game/AvatarSprite.tsx` | CSS spritesheet animation (8 fps, direction-aware frame selection) |
| `src/components/game/PlayerAvatar.tsx` | Absolute-positioned avatar + "Nothing to do here" idle bubble |
| `src/components/game/debug/WaypointEditor.tsx` | Dev annotation overlay — click to add node, drag to connect, JSON export |

#### Sprite sheet spec

- **Three sheets**: `idle.png`, `walk.png`, `sit.png` in `public/assets/characters/avatar1/`
- **Frame size**: 48×96 px (width × height)
- **Render size**: 48×96 px (1× scale)
- **Frame rate**: 8 fps
- **idle / walk** — 24 frames: right 0–5 | up 6–11 | left 12–17 | down 18–23
- **sit** — 12 frames: right 0–5 | left 6–10 (no up/down; falls back to right)

#### Waypoint coordinate system

All coordinates are **% of the full 1536×1024 floorplan image**.
Avatar foot anchors to `(x%, y%)` via `transform: translate(-50%, -100%)`.

```jsonc
// waypoints.json shape
{
  "waypoints": {
    "kitchen_center": { "x": 26.0, "y": 19.8, "room": "kitchen" },
    "fridge": { "x": 44.0, "y": 15.8, "room": "kitchen", "station": true, "facing": "up" }
    // ...
  },
  "edges": [["fridge", "kitchen_center"], /* ... */],
  "room_meta": {
    "kitchen":  { "exit": "kitchen_view_out_camera_switch", "entry": "kitchen_center" },
    "dining_hall": {
      // per-destination exits (RoomPointSpec = string | Record<targetRoom, waypointId>)
      "exit":  { "kitchen": "dining_in_from_kitchen", "living_room": "dining_out_down", "bedroom": "dining_out_down" },
      "entry": { "kitchen": "dining_in_from_kitchen", "living_room": "dining_out_down", "bedroom": "dining_out_down" }
    }
  }
}
```

**Important**: there are **no cross-room edges** in the `edges` list. Rooms are disconnected graphs. Cross-room transition is handled by `navigateToRoom`, not BFS.

#### Movement flow

**Station interaction (same room)**
1. Player clicks hotspot → `setActiveStation(null)` closes current popup
2. `characterStore.moveToStation(stationId, onArrival)` — BFS from `currentWaypointId` to station
3. `rAF` loop advances position each frame at `WALK_SPEED = 12 %/s`
4. On arrival: `onArrival()` → `setActiveStation(station)` opens popup; or idle bubble if no active step
5. Hotspot `pointer-events: none` while `isCharMoving` (prevents mid-walk clicks)

**Cross-room navigation**
1. Player clicks room nav button → `navigateToRoom(target)`
2. Resolve `exitId = resolveRoomPoint(currentMeta.exit, target)` (per-destination)
3. Walk to exit waypoint (BFS within current room)
4. On arrival: set `currentRoom = target`, after `TRANSIT_DELAY_MS = 1500 ms` teleport to `entryId`
5. Gracefully degrades — if exit/entry not annotated, camera cuts immediately

**Doorbell PM trigger**
- Living Room nav button pulses amber + 🔔 when `gameStore.activePMTrials` contains a trial with `triggerEvent ∈ ['doorbell','knock','doorbell_ring']`

#### WaypointEditor (dev only)

Mounted inside zoom div; visible only when `showWaypointEditor = true` (toggle button outside zoom div, hidden in production via `import.meta.env.DEV`).

- Click empty space → create numbered node (prompt for name)
- Click node A then node B → add undirected edge
- Double-click node → rename
- Right-click → delete node/edge
- JSON panel (portal to `document.body`) → one-click copy of current graph
- Works in both overview and zoomed-room modes; coordinates are % of container = % of floorplan

### WorldView (Not Used)

`WorldView.tsx` still exists in the codebase (CSS grid room layout) but is **not imported anywhere**. It is kept for reference and may be removed in a future cleanup. All active development is on `FloorPlanView`.

---

## 7. Timeline Engine

### Event Generation (`timeline_generator.py`)
Builds a sorted event list per block:
1. `block_start` at t=0
2. `ongoing_task_event` (steaks every 20s, table ready at t=5)
3. PM triggers at predefined times (or activity watchers)
4. Reminders ~120s before triggers (condition-dependent)
5. Robot neutral utterances
6. Phone messages from JSON pool
7. Fake triggers (decoys)
8. Visitor arrivals (robot events)

### Event Dispatch (`timeline.py`)
```
_run() loop:
  for event in sorted_events:
    while waiting for event time:
      emit time_tick every 10 real seconds
    fire event via send_fn (WS)
  after all events: continue ticking until 600s
  fire block_end
```

### Activity Watchers
Some PM triggers fire on game-state conditions (e.g., "all steaks plated"):
- `_register_activity_watcher()` sets condition + fallback timer
- `game_handler` checks watchers on each `task_action` message
- If condition met → fire trigger; if deadline passes → fallback fires trigger

---

## 8. Condition Counterbalancing

**Latin Square** (6 groups × 3 blocks):

| Group | Block 1 | Block 2 | Block 3 |
|-------|---------|---------|---------|
| A | CONTROL | AF | AFCB |
| B | AF | AFCB | CONTROL |
| C | AFCB | CONTROL | AF |
| D | CONTROL | AFCB | AF |
| E | AF | CONTROL | AFCB |
| F | AFCB | AF | CONTROL |

- **CONTROL**: No reminders
- **AF**: Adaptive Feedback reminders for 3/4 tasks (one unreminded)
- **AFCB**: Adaptive Feedback + Context-Based reminders

---

## 9. Database Schema

### Core Tables
- `experiment` — experiment metadata
- `participant` — identity, group, token, status, demographics
- `block` — per-block state (condition, day_story, timeline, NASA-TLX)
- `pm_trial` — per-task state (config, trigger timing, score, resumption lag)

### Detail Tables
- `pm_attempt_record` — granular timing (trigger → action → selection → complete)
- `encoding_quiz_attempt` — quiz correctness per question per attempt
- `reminder_message` — agent-generated reminder content

### Logging Tables
- `interaction_log` — all user interactions (room switch, task action, phone)
- `mouse_track` — batch mouse trajectory data
- `ongoing_task_score` — steak/dining scores per block
- `game_state_snapshot` — periodic JSON state snapshots
- `phone_message_log` — message delivery + reply tracking

---

## 10. Deployment

### Development
```bash
# Database (Docker)
cd CookingForFriends && cp .env.example .env && docker compose up -d

# Backend (Python 3.11+)
conda activate thesis_server
cd CookingForFriends/backend && uvicorn main:app --reload --port 5000

# Frontend (Node 18+)
cd CookingForFriends/frontend && npm run dev  # Vite on :3000, proxies to :5000
```

### Production
```bash
cd CookingForFriends/frontend && npm run build   # Builds to dist/
cd CookingForFriends/backend && uvicorn main:app  # Serves API + static dist/
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `backend/data` | Path to data directory |
| `DATABASE_URL` | `postgresql+asyncpg://cff:cff_dev_pass@localhost:5432/cooking_for_friends` | PostgreSQL connection URL |
| `DEV_TOKEN` | `ABC123` | Dev participant token (set empty for production) |

---

## 10. Key Design Decisions

1. **PostgreSQL via Docker** — Robust, production-grade database with connection pooling. Auto-initialized via `db/init.sql`.
2. **Silent execution windows** — Frontend never knows about PM scoring deadlines, preserving ecological validity.
3. **Furniture popup for PM items** — Items hidden behind room furniture (bookshelf, cabinet) to require intentional search.
4. **Phone as continuous distractor** — Lock screen, messages, replies create ongoing task competition.
5. **Activity-based triggers** — Some PM triggers fire on game-state conditions (not fixed time), adding naturalism.
6. **Zustand over Redux** — Simpler API, no boilerplate, good performance for flat state.
7. **Framer Motion** — Smooth animations for room transitions, popups, and phone interactions.
8. **WebSocket + REST hybrid** — REST for CRUD (session, encoding, quiz), WS for real-time game events.
