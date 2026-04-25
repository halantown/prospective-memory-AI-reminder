# Cooking for Friends — Session Platform

A browser-based 2D prospective memory (PM) experiment where participants cook steak dinners for friends while responding to PM tasks triggered by a doorbell or phone call. A robot avatar delivers encoding-context reminders via a speech bubble during the PM pipeline.

## Experiment Design

- **Between-subjects IV**: Encoding Context (EC+ vs EC−) — assigned once per participant for all 4 PM tasks
- **4 PM Tasks** (T1–T4): Mei/baking book (doorbell), Lina/chocolate (doorbell), Tom/apple juice (phone), Delivery/trash bags (phone)
- **4 Latin Square orders** (A–D): T1→T2→T3→T4, T2→T4→T1→T3, T3→T1→T4→T2, T4→T3→T2→T1
- **8 (condition × order) combinations**, assigned round-robin to real participants

### Trigger Schedule (event-driven, in game time)
```
Entry 1: real  trigger (T at position 1) — 180 s after game start
Entry 2: fake  doorbell                  — 120 s after entry 1 pipeline ends
Entry 3: real  trigger (T at position 2) —  60 s after entry 2 pipeline ends
Entry 4: real  trigger (T at position 3) — 120 s after entry 3 pipeline ends
Entry 5: fake  phone call                —  60 s after entry 4 pipeline ends
Entry 6: real  trigger (T at position 4) —  60 s after entry 5 pipeline ends
Session ends                             —  60 s after entry 6 pipeline ends
```
Game time is **frozen** during each pipeline (ongoing tasks pause). Pipeline duration does not count toward the next delay.

### PM Pipeline (real trigger — 6 steps)
`trigger_affordance → greeting → reminder (robot avatar) → decoy selection → confidence rating → avatar auto-action`

### PM Pipeline (fake trigger — 4 steps)
`trigger_affordance → greeting → fake_reminder (robot avatar, neutral) → completed`

## Architecture

```
CookingForFriends/
├── docker-compose.yml        # PostgreSQL service (Docker)
├── .env.example              # Environment variable template
├── backend/                  # FastAPI + SQLAlchemy + PostgreSQL
│   ├── main.py               # App entry point (port 5000)
│   ├── config.py             # All configuration constants (TRIGGER_SCHEDULE, TASK_ORDERS, etc.)
│   ├── database.py           # Async SQLAlchemy engine; seed_dev_participant()
│   ├── models/
│   │   ├── experiment.py     # Experiment, Participant (condition, task_order, game_time fields)
│   │   ├── block.py          # Block (schema shim — do not drop)
│   │   ├── pm_module.py      # CutsceneEvent, PMTaskEvent, FakeTriggerEvent, IntentionCheckEvent, PhaseEvent
│   │   ├── logging.py        # InteractionLog, MouseTrack, OngoingTaskScore, GameStateSnapshot
│   │   └── schemas.py        # Pydantic request/response schemas
│   ├── routers/
│   │   ├── session.py        # Token login, phase transitions, cutscene/intention-check logging, state endpoint
│   │   └── admin.py          # Participant CRUD, test-session, assignment counts, live monitor, CSV export
│   ├── websocket/
│   │   ├── connection_manager.py  # WS pub/sub manager
│   │   └── game_handler.py        # Game WS handler (PM pipeline: 6 real + fake message types)
│   └── engine/
│       ├── pm_session.py     # Event-driven PM trigger scheduler (fires triggers, sends session_end)
│       ├── pm_tasks.py       # T1–T4 task definitions + decoy structures
│       ├── game_time.py      # freeze_game_time / unfreeze_game_time / get_current_game_time
│       ├── condition_assigner.py  # 8-combo round-robin assignment
│       └── cooking_engine.py      # Cooking task engine (pause/resume for game-time freeze)
├── frontend/                 # React 18 + TypeScript + Vite + Tailwind + Zustand
│   └── src/
│       ├── pages/game/       # WelcomePage, ConsentPage, IntroductionPage, CutsceneEncodingPage,
│       │                       GamePage, PostQuestionnairePage, DebriefPage
│       ├── pages/admin/      # DashboardPage (6 tabs)
│       ├── components/game/  # PMTriggerModal (full pipeline), CutscenePlayer, DetailCheckModal,
│       │                       IntentionCheckQuestion, WorldView, RobotAvatar, PhoneSidebar, HUD
│       ├── constants/
│       │   ├── placeholders.ts  # All PLACEHOLDER_* constants (researcher fills later)
│       │   └── pmTasks.ts       # TASK_ORDERS, TRIGGER_SCHEDULE, PM_TASKS, DECOY_OPTIONS (Chinese labels)
│       ├── stores/           # Zustand gameStore (condition, taskOrder, pmPipelineState, gameTimeFrozen)
│       ├── hooks/            # useWebSocket (pm_trigger, avatar_action, session_end, heartbeat)
│       └── services/         # API client (logCutsceneEvent, logIntentionCheck, getSessionState, updatePhase)
└── docs/                     # Architecture, incident log, game design docs
```

## Quick Start

### 1. Start PostgreSQL (Docker)

```bash
cd CookingForFriends
cp .env.example .env          # adjust credentials if needed
docker compose up -d          # starts PostgreSQL on port 5432
```

### 2. Backend

```bash
conda activate thesis_server
cd CookingForFriends/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000
```

Backend runs on **port 5000**. API docs at `http://localhost:5000/docs`.
Tables are auto-created on first startup via SQLAlchemy `create_all()`.

> ⚠️ **Fresh dev setup**: On a new database, drop all tables and recreate with `create_all()`.
> For production migration, use Alembic ALTER TABLE migrations (not `create_all()`).

### 3. Frontend (Development)

```bash
cd CookingForFriends/frontend
npm install
npm run dev
```

Dev server runs on **port 3000**, proxies `/api` → `:5000` and `/ws` → `ws://5000`.

### 4. Frontend (Production build)

```bash
cd CookingForFriends/frontend
npm run build
# Built files in dist/ are served by FastAPI at /
```

## Admin Page

Access at: **`http://localhost:5000/admin`** (or `?key=<ADMIN_KEY>` if key-locked)

Set the admin key in `.env`:
```
ADMIN_API_KEY=your_secret_key_here
```

All admin HTTP endpoints require the header `X-Admin-Key: <key>`.

### Admin sections

| Tab | Description |
|-----|-------------|
| **Participants** | Create participant tokens (auto round-robin EC+/EC− × A/B/C/D). Shows token, entry URL, status. |
| **Latin Square** | Read-only view of 4 orders + current participant counts per (condition, order) cell. |
| **Live Sessions** | Real-time monitor of in-progress sessions (token, phase, game time). |
| **Data Export** | Download CSV exports (see below). |
| **Test Mode** | Create one-off test sessions (see below). |
| **Config** | Current trigger schedule, conditions, task definitions. |

## Test Mode

Use Test Mode to run a full or partial session without affecting round-robin assignment counts.

**Via Admin UI** (Test Mode tab):
1. Select condition (EC+ / EC−) and order (A / B / C / D)
2. Select start phase (welcome / consent / introduction / encoding / playing / post_questionnaire)
3. Click "Start test session" → opens entry URL in new tab
4. Test sessions are flagged `is_test=True` and excluded from analysis exports by default

**Via API**:
```bash
curl -X POST http://localhost:5000/api/admin/test-session \
  -H "X-Admin-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"condition": "EC+", "task_order": "A", "start_phase": "welcome"}'
# → {"token": "ABC123", "entry_url": "/?token=ABC123", "is_test": true, ...}
```

## Data Export

### Per-participant CSV (PM events)
One row per `PMTaskEvent` (one per real trigger, per participant).

```bash
# Exclude test sessions (default)
GET /api/admin/export/per-participant

# Include test sessions
GET /api/admin/export/per-participant?include_test=true
```

Columns: `token, session_id, task_id, position_in_order, condition, task_order, trigger_type,
trigger_scheduled_game_time, trigger_actual_game_time, greeting_complete_time,
reminder_display_time, reminder_acknowledge_time, decoy_options_order, decoy_selected_option,
decoy_correct, decoy_response_time, confidence_rating, confidence_response_time,
action_animation_start_time, action_animation_complete_time, pipeline_was_interrupted`

### Aggregated CSV (per participant)
One row per participant with summary metrics.

```bash
GET /api/admin/export/aggregated               # real participants only
GET /api/admin/export/aggregated?include_test=true
```

Columns: `participant_id, token, session_id, condition, task_order, status, is_test,
created_at, started_at, completed_at, pm_events_count, pm_actions_completed`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | Async PostgreSQL URL |
| `ADMIN_API_KEY` | `admin_secret` | Key for admin endpoints |
| `DEV_TOKEN` | *(unset)* | If set, `seed_dev_participant()` creates a test participant with this token |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins |

Set `DEV_TOKEN` during local development to get a predictable test token:
```bash
DEV_TOKEN=DEVTEST uvicorn main:app --port 5000
```

## Key API Endpoints

### Session (participant-facing)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/session/start` | Validate token, start session, return condition/task_order |
| POST | `/api/session/{id}/phase` | Log phase transition (body: `{phase_name, event_type}`) |
| POST | `/api/session/{id}/cutscene-event` | Log cutscene view + detail-check answer |
| POST | `/api/session/{id}/intention-check` | Log intention-check answer |
| GET  | `/api/session/{token}/state` | Reconnect endpoint — returns current phase, frozen state, game time |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/participant/create` | Create real participant (increments round-robin) |
| POST | `/api/admin/test-session` | Create test participant (no round-robin) |
| GET  | `/api/admin/participants` | List all participants |
| GET  | `/api/admin/assignment-counts` | Counts per (condition, order) cell — real only |
| GET  | `/api/admin/live-sessions` | In-progress sessions |
| GET  | `/api/admin/export/per-participant` | CSV — PM events |
| GET  | `/api/admin/export/aggregated` | CSV — per-participant summary |
| GET  | `/api/admin/tasks` | PM task definitions |
| GET  | `/api/admin/config` | Experiment config (conditions, trigger schedule, orders) |

### WebSocket
| Path | Description |
|------|-------------|
| `/ws/game/{session_id}` | Bidirectional game communication |
| `/ws/monitor` | Admin real-time monitoring |

#### Key WS message types (server → client)
- `pm_trigger` — fires at scheduled game time: `{is_fake, task_id, trigger_type, position, game_time_fired}`
- `avatar_action` — instructs frontend to animate avatar action: `{task_id, action_type}`
- `session_end` — session over, transition to post_questionnaire
- `heartbeat_ack` — confirms frozen state + current game_time

#### Key WS message types (client → server)
- `heartbeat` — sent every 30 s to maintain connection
- `pm_greeting_complete` — `{game_time}`
- `pm_reminder_ack` — `{game_time}`
- `pm_decoy_selected` — `{decoy_options_order, decoy_selected_option, decoy_correct, decoy_response_time}`
- `pm_confidence_rated` — `{confidence_rating, response_time_ms}`
- `pm_action_complete` — `{action_animation_start_time, action_animation_complete_time}`
- `fake_trigger_ack` — `{game_time}`

## Data Models

### Core tables
- **Participant** — token, condition (EC+/EC−), task_order (A/B/C/D), is_test, current_phase, game_time_elapsed_s, frozen_since, last_unfreeze_at, disconnected_at, incomplete
- **Block** — schema shim only (block_number=1 always). **Do not drop**; logging tables FK here.

### PM module tables (new)
- **PhaseEvent** — start/end timestamps per phase per session
- **CutsceneEvent** — per-segment view times + detail-check answers (segment_number 1-based)
- **IntentionCheckEvent** — post-encoding intention-check answers per task
- **PMTaskEvent** — full PM pipeline log per trigger (greeting, reminder, decoy, confidence, action)
- **FakeTriggerEvent** — fake trigger acknowledgement log

### Logging tables (existing)
- **InteractionLog**, **MouseTrack**, **OngoingTaskScore**, **GameStateSnapshot**, **PhoneMessageLog** — unchanged; FK into Block

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 (async), asyncpg |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion |
| Communication | WebSocket (bidirectional) |
| Database | PostgreSQL 16 (Docker) |
| State Management | Zustand (frontend), SQLAlchemy models (backend) |
| Conda environment | `thesis_server` (Python 3.12) |
