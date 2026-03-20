# Cooking for Friends — Experiment Platform

A browser-based 2D prospective memory (PM) experiment where participants cook steak dinners for friends while performing PM tasks triggered by environmental events.

## Architecture

```
CookingForFriends/
├── backend/                 # FastAPI + SQLAlchemy + SQLite
│   ├── main.py             # App entry point (port 5000)
│   ├── config.py           # All configuration constants
│   ├── database.py         # Async SQLAlchemy engine
│   ├── models/             # SQLAlchemy ORM models
│   │   ├── experiment.py   # Experiment, Participant
│   │   ├── block.py        # Block, PMTrial, ReminderMessage
│   │   ├── logging.py      # InteractionLog, MouseTrack, etc.
│   │   └── schemas.py      # Pydantic request/response schemas
│   ├── routers/
│   │   ├── session.py      # Token login, encoding, NASA-TLX, debrief
│   │   └── admin.py        # Participant CRUD, monitoring
│   ├── websocket/
│   │   ├── connection_manager.py  # WS pub/sub manager
│   │   └── game_handler.py        # Bidirectional game WS handler
│   ├── engine/
│   │   ├── timeline.py     # Block timeline engine (JSON → scheduled WS events)
│   │   ├── pm_scorer.py    # 0-6 PM scoring
│   │   ├── condition_assigner.py  # Latin Square 3-level assignment
│   │   └── snapshot.py     # Game state snapshot helper
│   └── data/timelines/     # JSON timeline templates
├── frontend/                # React 18 + TypeScript + Vite + Tailwind + Zustand
│   ├── src/
│   │   ├── pages/game/     # WelcomePage, EncodingPage, GamePage, MicroBreakPage, DebriefPage
│   │   ├── pages/admin/    # DashboardPage
│   │   ├── components/game/ # WorldView, KitchenRoom, DiningRoom, RobotAvatar, PhoneSidebar, HUD, PMInteraction
│   │   ├── stores/         # Zustand gameStore (central state)
│   │   ├── hooks/          # useWebSocket, useMouseTracker
│   │   ├── services/       # API client
│   │   └── types/          # TypeScript type definitions
│   └── dist/               # Production build output
├── experiment_plan_v3.md    # PRD (experiment design document)
└── development_prompt_v3.md # Technical specification
```

## Quick Start

### Backend

```bash
conda activate thesis_server
cd CookingForFriends/backend
pip install -r requirements.txt
python main.py
```

Backend runs on **port 5000**. API docs at `http://localhost:5000/docs`.

### Frontend (Development)

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
- AF/AFCB blocks: 3 reminded + 1 unreminded (confusion trial)
- Control: robot present with neutral utterances but no PM reminders
- **Latin Square**: 6 groups (A–F) for counterbalancing, round-robin assignment

## Key Design Decisions

### Robot Communication
- `robot_speak` messages intentionally have **no** `is_reminder` field
- Frontend treats all robot speech identically — participants cannot distinguish reminders from neutral utterances
- `log_tag` field (only in backend) marks messages as `reminder` vs `neutral` for analysis

### PM Scoring (0–6, hidden from participant)
| Score | Meaning |
|-------|---------|
| 6 | Perfect: correct room + target + action within 30s |
| 5 | Correct but delayed (>15s within window) |
| 4 | Right target, wrong action |
| 3 | Right room, wrong target |
| 2 | PM intent shown, wrong direction |
| 1 | Very late response (30–60s) |
| 0 | No response within window |

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
- Events: `block_start`, `time_tick`, `robot_speak`, `robot_move`, `pm_trigger`, `phone_notification`, `phone_lock`, `block_end`, `ongoing_task_event`, `keepalive`
- Client messages: `heartbeat`, `room_switch`, `task_action`, `pm_attempt`, `phone_unlock`, `phone_action`, `mouse_position`, `encoding_complete`

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
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), aiosqlite |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion |
| Communication | WebSocket (bidirectional) |
| Database | SQLite (prototype; migration-ready for MySQL) |
| State Management | Zustand (frontend), SQLAlchemy models (backend) |

## Data Models

### Core Tables
- **Experiment** — experiment metadata and status
- **Participant** — token, Latin Square group, condition order, session state
- **Block** — one of 3 blocks per participant, with condition assignment
- **PMTrial** — individual PM task trial with scoring
- **ReminderMessage** — pre-generated reminder texts (placeholder for agent system)

### Logging Tables
- **InteractionLog** — all clicks, room switches, task actions
- **MouseTrack** — mouse position data (200ms sample, 5s batch upload)
- **OngoingTaskScore** — cooking/setting task performance
- **GameStateSnapshot** — periodic game state snapshots

## Environment

- **Conda environment**: `thesis_server` (Python 3.12)
- **Node.js**: v18+ required for Vite
- **Database**: SQLite at `backend/experiment.db` (auto-created on first run)
