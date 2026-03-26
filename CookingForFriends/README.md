# Cooking for Friends — Experiment Platform

A browser-based 2D prospective memory (PM) experiment where participants cook steak dinners for friends while performing PM tasks triggered by environmental events.

## Architecture

```
CookingForFriends/
├── docker-compose.yml       # PostgreSQL service (Docker)
├── .env.example             # Environment variable template
├── db/
│   └── init.sql             # PostgreSQL initialization script
├── backend/                 # FastAPI + SQLAlchemy + PostgreSQL
│   ├── main.py             # App entry point (port 5000)
│   ├── config.py           # All configuration constants
│   ├── database.py         # Async SQLAlchemy engine (asyncpg)
│   ├── models/             # SQLAlchemy ORM models
│   │   ├── experiment.py   # Experiment, Participant
│   │   ├── block.py        # Block, PMTrial, PMAttemptRecord, EncodingQuizAttempt
│   │   ├── logging.py      # InteractionLog, MouseTrack, etc.
│   │   └── schemas.py      # Pydantic request/response schemas
│   ├── routers/
│   │   ├── session.py      # Token login, encoding, quiz, NASA-TLX, debrief
│   │   └── admin.py        # Participant CRUD, monitoring
│   ├── websocket/
│   │   ├── connection_manager.py  # WS pub/sub manager
│   │   └── game_handler.py        # Bidirectional game WS handler
│   ├── engine/
│   │   ├── timeline.py     # Block timeline engine (JSON → scheduled WS events)
│   │   ├── pm_scorer.py    # 0-6 PM scoring (score_pm_attempt)
│   │   ├── execution_window.py  # Silent 30/60s execution window manager
│   │   ├── condition_assigner.py  # Latin Square 3-level assignment
│   │   └── snapshot.py     # Game state snapshot helper
│   └── data/timelines/     # JSON timeline templates
├── frontend/                # React 18 + TypeScript + Vite + Tailwind + Zustand
│   ├── src/
│   │   ├── pages/game/     # WelcomePage, EncodingPage, GamePage, MicroBreakPage, DebriefPage
│   │   ├── pages/admin/    # DashboardPage
│   │   ├── components/game/ # WorldView, rooms/*, RobotAvatar, PhoneSidebar, HUD, PMTargetItems, TriggerEffects
│   │   ├── stores/         # Zustand gameStore (central state)
│   │   ├── hooks/          # useWebSocket, useMouseTracker
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript type definitions
│   └── dist/               # Production build output
├── experiment_plan_v3.md    # PRD (experiment design document)
└── development_prompt_v3.md # Technical specification
```

## Quick Start

### 1. Start PostgreSQL (Docker)

```bash
cd CookingForFriends
cp .env.example .env        # adjust credentials if needed
docker compose up -d        # starts PostgreSQL on port 5432
```

### 2. Backend

```bash
conda activate thesis_server
cd CookingForFriends/backend
pip install -r requirements.txt
python main.py
```

Backend runs on **port 5000**. API docs at `http://localhost:5000/docs`.
Tables are auto-created on first startup via SQLAlchemy `create_all()`.

### 3. Frontend (Development)

```bash
cd CookingForFriends/frontend
npm install
npm run dev
```

Dev server runs on **port 3000**, proxies `/api` → `:5000` and `/ws` → `ws://5000`.

### Frontend (Production)

```bash
cd CookingForFriends/frontend
npm run build
```

Built files in `dist/` are served by FastAPI at `/`.

## Experiment Design

- **Single-factor 3-level within-subjects**: Control / AF (Associative Fidelity) / AF+CB (Contextual Bridging)
- **3 blocks per participant**, 4 PM tasks per block
- AF/AFCB blocks: 3 reminded + 1 unreminded (filler trial)
- Control: robot present with neutral utterances but no PM reminders
- **Latin Square**: 6 groups (A–F) for counterbalancing, round-robin assignment

## Ongoing Tasks

### Kitchen — Steak Cooking

Three pans, each running an independent steak timer controlled by the frontend:

| Phase | Duration | Visual | Action |
|-------|----------|--------|--------|
| Cooking side 1 | 30 s | Gradually browning 🥩 | None (idle window) |
| Ready to flip | 10 s window | Orange border flash 🔥 | Click to flip |
| Cooking side 2 | 25 s | Continues browning 🥩 | None (idle window) |
| Ready to plate | 10 s window | Green border flash ✅ | Click to plate |
| Burnt | — | Black 💨 | Click to discard |

- Total steak life cycle: ~75 s
- Steaks are placed by the backend timeline engine (`place_steak` events), staggered 20 s apart across the 3 pans
- **Scoring**: plate = +10, burnt = −5
- Missing either the flip or plate window burns the steak

### Dining — Cycling Table Setting

Four seats, each requiring 4 utensils (plate, knife, fork, glass):

1. Select a utensil from the bottom bar
2. Click a seat to place it
3. Repeat until all 16 slots are filled → +20 pts → auto-reset → next round
4. Infinite cycling; participants fill in between kitchen operations

### Room Visibility

All rooms are **always visible**. Inactive rooms are dimmed (opacity 0.45) with `pointer-events: none` on their content, but the room wrapper itself remains clickable for navigation. Urgent steak states (ready_to_flip, ready_to_plate) pierce through the dimming with full opacity and a pulsing glow animation so participants can monitor the kitchen from any room.

## Key Design Decisions

### Robot Communication
- `robot_speak` messages intentionally have **no** `is_reminder` field
- Frontend treats all robot speech identically — participants cannot distinguish reminders from neutral utterances
- `log_tag` field (only in backend) marks messages as `reminder` vs `neutral` for analysis

### PM Execution Flow
```
Trigger Event (doorbell/email/washing/clock)
  → Participant perceives trigger (audio + visual cue)
  → Navigate to target room
  → Find correct item among 2 visually similar items
  → Select item → Confirm action
  → Backend scores silently (0-6)
```

- **No PM UI buttons.** Target items are embedded naturally in room scenes
- **Execution window is silent** — frontend has no knowledge of the timer
- **Ongoing tasks continue** during PM execution (steaks keep cooking)

### PM Scoring (0–6, hidden from participant)
| Score | Meaning |
|-------|---------|
| 6 | Perfect: correct room + target + action ≤15s |
| 5 | All correct but delayed (15-30s) |
| 4 | Right target, wrong action (within 30s) |
| 3 | Right room, wrong target (within 30s) |
| 2 | PM intent shown, wrong room (within 30s) |
| 1 | Very late response (30–60s) |
| 0 | No response within 60s window |

### Execution Window
- **Primary window**: 0–30s after trigger → score 2-6 based on accuracy
- **Extended window**: 30–60s → score = 1 (late response)
- **Expiry**: >60s → auto-score 0 via backend timer
- Frontend receives **zero** information about windows

### Encoding Quiz
- 3 multiple-choice questions per PM task (trigger/target/action)
- Wrong answer → re-show encoding card → re-test
- 2 failures → forced re-display with emphasis
- Attempts recorded in `encoding_quiz_attempts` table

### Filler Trials
- AF/AFCB blocks: 4th trial has no robot reminder
- Identical frontend code path — no `has_reminder`/`is_filler` sent to client
- Scored identically (0-6)

### Response Time Recording
All PM-related timestamps are recorded:
1. `trigger_fired_at` — server push time
2. `trigger_received_at` — client receipt time
3. `first_room_switch_at` — first room change after trigger
4. `first_pm_room_entered_at` — first entry to target room
5. `target_selected_at` — target item selection
6. `action_completed_at` — action confirmation
7. `resumption_lag_ms` — time from PM completion to resuming ongoing task

### Token System
- 6-char alphanumeric (excludes ambiguous chars: 0/O/1/I)
- Admin creates participant → gets token
- Participant enters token on WelcomePage to start

## API Routes

### Session (Participant)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/session/start` | Start session with token |
| GET | `/api/session/{id}/block/{n}/encoding` | Get PM task encoding data |
| POST | `/api/session/{id}/block/{n}/quiz` | Submit encoding quiz answers |
| POST | `/api/session/{id}/block/{n}/nasa-tlx` | Submit NASA-TLX responses |
| POST | `/api/session/{id}/debrief` | Submit debrief questionnaire |
| GET | `/api/session/{id}/status` | Get current session status |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/participant/create` | Create participant |
| GET | `/api/admin/participants` | List all participants |
| GET | `/api/admin/experiment/overview` | Experiment statistics |
| GET | `/api/admin/participant/{id}/logs` | Interaction logs |
| POST | `/api/admin/reminders/import` | Import reminder messages |
| GET | `/api/admin/reminders` | List reminders |

### WebSocket
| Path | Description |
|------|-------------|
| `/ws/game/{session_id}/{block_num}` | Bidirectional game communication |
| `/ws/monitor` | Admin real-time monitoring |

### WS Protocol
- **Server → Client**: `{"event": "<type>", "data": {...}, "server_ts": <float>}`
- **Client → Server**: `{"type": "<type>", "data": {...}}`
- Server events: `block_start`, `time_tick`, `robot_speak`, `robot_move`, `pm_trigger`, `phone_notification`, `phone_lock`, `block_end`, `ongoing_task_event`, `keepalive`
- Client messages: `heartbeat`, `room_switch`, `task_action`, `pm_attempt`, `trigger_ack`, `phone_unlock`, `phone_action`, `mouse_position`, `encoding_complete`

## PM Trigger Types

| Trigger | Audio | Visual |
|---------|-------|--------|
| doorbell | Double ding (880Hz) | Living room glow |
| email_dentist | Ding (1200Hz) | Phone notification |
| washing_done | Triple beep (660Hz) | Balcony glow |
| clock_6pm | Chime (523Hz) | HUD clock highlight |
| knock | Triple knock (220Hz) | Living room glow |
| phone_message | Double ding (1000Hz) | Phone notification |
| plant_reminder | Tone (440Hz) | Balcony glow |
| tv_on | Tone (350Hz) | Living room glow |

## Web Routes (Frontend)

| Route | Description |
|-------|-------------|
| `/` | Welcome/login page (participant-facing) |
| `/encoding` | PM task encoding phase |
| `/game` | Main game view |
| `/microbreak` | Micro-break + NASA-TLX |
| `/debrief` | Post-experiment questionnaire |
| `/admin` | Experimenter dashboard |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), asyncpg |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion |
| Communication | WebSocket (bidirectional) |
| Database | PostgreSQL 16 (Docker) |
| State Management | Zustand (frontend), SQLAlchemy models (backend) |
| Audio | Web Audio API (placeholder tones for trigger effects) |

## Data Models

### Core Tables
- **Experiment** — experiment metadata and status
- **Participant** — token, Latin Square group, condition order, session state
- **Block** — one of 3 blocks per participant, with condition assignment
- **PMTrial** — individual PM task trial with scoring + resumption_lag_ms
- **PMAttemptRecord** — granular PM attempt data (6 timestamps, room sequence, scoring)
- **EncodingQuizAttempt** — per-question quiz attempt tracking
- **ReminderMessage** — pre-generated reminder texts (placeholder for agent system)

### Logging Tables
- **InteractionLog** — all clicks, room switches, task actions
- **MouseTrack** — mouse position data (200ms sample, 5s batch upload)
- **OngoingTaskScore** — cooking/setting task performance
- **GameStateSnapshot** — periodic game state snapshots

## Environment

- **Conda environment**: `thesis_server` (Python 3.12)
- **Node.js**: v18+ required for Vite
- **Database**: PostgreSQL 16 via Docker (`docker compose up -d`)
- **Config**: Copy `.env.example` → `.env` and adjust as needed
