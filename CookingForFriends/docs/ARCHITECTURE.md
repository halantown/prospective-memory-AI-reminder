# CookingForFriends — Technical Architecture

> Prospective Memory (PM) experiment platform with real-time game, phone distractor,
> adaptive reminders, and granular behavioural data capture.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Frontend  (React 18 + Vite + TypeScript + Tailwind + Zustand)         │
│  ├── EncodingPage   — task card study + quiz                           │
│  ├── GamePage       — WorldView (75%) + PhoneSidebar (25%)             │
│  │   ├── 5 rooms: kitchen, bedroom, living_room, study, bathroom       │
│  │   ├── Ongoing tasks: steaks (kitchen), table setting (bedroom)      │
│  │   └── PM interaction: furniture popup → item select → confirm       │
│  └── MicroBreak / Debrief pages                                        │
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
- **Duration**: 600 real seconds = 60 game minutes (17:00–18:00)
- **Time ticks**: emitted every 10 real seconds (= 1 game minute)
- **Layout**: 75/25 split — WorldView (room panorama) + PhoneSidebar
- **Ongoing tasks**: Steak cooking (every 20s), table setting (t=5)
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
| `time_tick` | `{elapsed, game_clock}` | Clock update (every 10s) |
| `pm_trigger` | `{trigger_id, trigger_event, task_config, server_trigger_ts}` | PM task activated |
| `fake_trigger` | `{trigger_type, duration}` | Decoy trigger (no PM task) |
| `phone_message` | `{id, channel, text, contact_id?, correct_choice?, wrong_choice?, correct_position?, feedback_correct?, feedback_incorrect?, sender?}` | Chat message (`channel:"chat"`) or system notification (`channel:"notification"`) |
| `kitchen_timer` | `{id, icon, message}` | Kitchen timer modal (blocking) |
| `robot_speak` | `{text}` | Robot speech bubble |
| `robot_move` | `{to_room}` | Robot changes room |
| `ongoing_task_event` | `{task, event, ...}` | Steak/dining state change |
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

**Store**: Zustand (`gameStore.ts`) — single flat store, no nested slices.

Key state sections:
- **Session**: sessionId, participantId, group, conditionOrder, blockNumber, phase
- **Room**: currentRoom, previousRoom, avatarMoving
- **Kitchen**: pans (3 pan states), kitchenScore
- **Dining**: diningPhase, seats (6), utensils, round, score
- **Phone**:
  - `phoneMessages: PhoneMessage[]` — chat messages (channel `"chat"`) only; notifications are banner-only
  - `contacts: Contact[]` — loaded from backend on block start; contacts with no messages are hidden in ContactStrip until first message arrives
  - `activeContactId: string | null` — currently viewed contact
  - `activePhoneTab: 'chats' | 'recipe'`
  - `phoneLocked: boolean`, `phoneLastActivity: number`
  - `phoneBanner: PhoneMessage | null` — auto-dismissed notification or cross-contact chat alert
  - `kitchenTimerQueue: KitchenTimerModal[]` — queued blocking modals
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

## 6. Timeline Engine

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

## 7. Condition Counterbalancing

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

## 8. Database Schema

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

## 9. Deployment

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
