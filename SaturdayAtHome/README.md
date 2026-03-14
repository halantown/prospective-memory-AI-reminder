# Saturday At Home

A browser-based experimental game for a 2×2 within-subjects **Prospective Memory (PM)** psychology study. Participants manage household tasks (cooking steaks, replying to messages, watering plants) while remembering to perform prospective memory tasks embedded in the game world.

## Architecture

```
SaturdayAtHome/
├── game_config.yaml          # ← Single source of truth for ALL game parameters
├── backend/                  # Python FastAPI + SQLite (port 5000)
│   ├── main.py               # Entry point
│   ├── core/                 # Config loader, database, WebSocket hub, timeline engine
│   ├── models/               # Pydantic schemas, dataclass entities
│   ├── routes/               # HTTP endpoints (session, experiment, admin, config)
│   ├── services/             # Business logic (scoring, hob state, PM windows)
│   └── utils/                # Helpers, action logging
├── frontend/                 # React + Vite + Tailwind + Zustand (port 3000)
│   ├── src/components/       # Game UI, rooms, screens, dashboard, config page
│   ├── src/store/            # Zustand global state
│   ├── src/hooks/            # WebSocket client, audio engine, animation hooks
│   ├── src/config/           # Task configs (populated from backend)
│   └── src/utils/            # API helpers
└── docs/                     # GDD, addendum, design documents
```

## Quick Start

### Prerequisites
- Python 3.10+ with `pyyaml` and `fastapi`
- Node.js 18+
- Conda environment `thesis_server` (or any venv)

### Backend
```bash
conda activate thesis_server
cd SaturdayAtHome/backend
pip install -r requirements.txt
python main.py
# → http://localhost:5000
```

### Frontend (Dev)
```bash
cd SaturdayAtHome/frontend
npm install
npm run dev
# → http://localhost:3000 (proxies /api → :5000)
```

### Frontend (Production)
```bash
cd SaturdayAtHome/frontend
npm run build
# Output in dist/ — served by FastAPI at /
```

## Web Routes

| Route | Purpose |
|-------|---------|
| `/` | Game (participant-facing) |
| `/dashboard` | Experimenter monitoring (live WebSocket events, scores) |
| `/manage` | Database management (sessions, raw data) |
| `/config` | Game configuration editor (reads/writes `game_config.yaml`) |

## Configuration System

All tunable parameters are in `game_config.yaml` at the project root. **No hardcoded values in code.** The file is loaded by the backend at startup and served to the frontend via API.

### Editing Config

**Option A: Web UI** — visit `http://localhost:3000/config` (or `:5000/config` in production). Edit values in the tabbed editor and click Save. Changes are written back to the YAML file.

**Option B: Edit YAML directly** — edit `game_config.yaml` and restart the backend.

### Config Sections

| Section | What it controls |
|---------|-----------------|
| `difficulty` | Steak cooking/ready timings per preset (slow/medium/fast) |
| `scoring` | Points for each action (flip, serve, burn, message reply, plant water) |
| `timers` | Block duration, message timeout, PM window, respawn delays |
| `timeline` | All block events with timestamps (steak spawns, messages, triggers, reminders) |
| `experiment` | Latin Square groups, task pair assignments, reminder texts per condition |
| `pm_tasks` | Medicine task definitions (bottles, amounts, **correct answers**) |
| `trigger_icons` | Icon/label mapping for each PM trigger type |
| `audio` | BGM volume, ducking parameters, TTS settings |

### Security Note
Correct PM answers are stored in the YAML (under `pm_tasks.*.correct`) but are **never** sent to the game frontend. The `GET /config/game` endpoint strips them. Only the `/config` admin page sees correct answers.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/config` | Full config (including correct answers — admin only) |
| `GET` | `/config/game` | Config stripped of correct answers (safe for game frontend) |
| `PUT` | `/config` | Save updated config to YAML and reload |

### Admin API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/sessions` | List all sessions |
| `GET` | `/admin/active-session` | Find currently connected session (used by dashboard) |
| `GET` | `/admin/session/{id}/state` | Live hob state, WS clients, active timelines |
| `GET` | `/admin/logs/{id}` | Action log for a session (most recent first) |
| `POST` | `/admin/fire-event` | Manually push an event to a session |
| `POST` | `/admin/force-block/{id}/{n}` | Force-start block N's full timeline (admin override) |
| `DELETE` | `/admin/session/{id}` | Delete a session and all its data |
| `GET` | `/admin/export/{id}` | Export session data as JSON |

## Communication: WebSocket

The backend pushes events to the frontend via **WebSocket**:

1. Frontend connects to `WS /session/{id}/block/{n}/stream`
2. Backend `BlockTimeline` runs scheduled events on a thread
3. Events are pushed to per-session WS queues
4. Frontend `useWebSocket.js` maps event types to Zustand store actions

Key WS events: `steak_spawn`, `message_bubble`, `trigger_appear`, `window_close`, `reminder_fire`, `robot_neutral`, `force_yellow`, `plant_needs_water`, `block_end`

### Troubleshooting: heartbeat-only but no timeline events

If the frontend only sends heartbeat and receives no scheduled events, check `backend/core/timeline.py::_update_actual_t`.

Root cause (fixed): using `UPDATE ... ORDER BY ... LIMIT` can fail on SQLite builds without `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`, causing `BlockTimeline.run()` to terminate at the first event.

Resolution: use a SQLite-compatible subquery update:

```sql
UPDATE block_events
SET actual_t = ?
WHERE id = (
  SELECT id FROM block_events
  WHERE session_id = ? AND block_num = ? AND event_type = ? AND actual_t IS NULL
  ORDER BY id
  LIMIT 1
)
```

## Game Components

### Kitchen
- **3 hobs** with steak state machine: EMPTY → COOKING → READY → BURNING
- **Kitchen table** with **medicine cabinet** always visible
  - Clickable anytime (browse mode when no PM trigger)
  - Two-step selection flow (bottle → amount) when PM trigger is active
- Sidebar status dot: green (ok) → orange (steak ready) → red (steak burning)

### Inbox (Messages)
- Email-style messages from NPCs with two reply options
- 15s timeout with countdown bar (green → yellow → red)
- Scoring: +2 correct, +1 wrong, -2 expired

### Living Room
- Plant watering: random intervals, +3 pts fresh, +1 pts wilted
- TV (idle, no score impact)

### Balcony
- Fixed in-block ambience milestones: `14:00 → 17:00 → 19:00` (sidebar + room light palette)
- Sky/light palette shifts morning → afternoon → evening with non-interruptive transitions
- Washing machine

### Ambient Audio
- BGM keeps playing continuously during block
- Subtle level contour by day phase (morning > afternoon > evening) while preserving robot ducking

### TODO Backlog
- Dedicated window lighting renderer is not yet modeled in current room scene; current build uses balcony/room tint transitions as a proxy.

### Robot Avatar
- Fixed bottom-right, always visible
- Speaks via Web Speech API with BGM ducking
- Delivers reminders and neutral comments on schedule

## Experiment Design

- **2×2 within-subjects**: Aftereffects (Low/High) × Cue Busyness (Low/High)
- **4 blocks** per participant, one condition each
- **Latin Square** counterbalancing (4 groups A/B/C/D): group assigned by `COUNT(sessions) % 4` — restart-safe, DB-backed
- **Per-slot reminder texts**: each condition has distinct text for Slot A (t=120s) and Slot B (t=300s), configured in `game_config.yaml` under `experiment.reminder_texts.<condition>.{A,B}`
- **8 PM task types** in 4 pairs (medicine, laundry, communication, chores)
- PM scoring: 0 (miss) / 1 (partial) / 2 (correct) — **not shown to participant**

## Data

All experiment data stored in `backend/core/experiment.db` (SQLite):
- Sessions, PM trials, action logs, ongoing score snapshots
- Export via `/manage` page or API endpoints
