# CookingForFriends Architecture

Current high-level architecture for the active experiment platform.

## Product Shape

CookingForFriends is a browser-based prospective-memory experiment. A
participant prepares dinner in a 2D home, handles cooking and phone distractors,
and responds to four PM tasks triggered by doorbell or phone-call encounters.

The current experiment design is:

- Between-subjects condition: `EE1` or `EE0`
- Four PM tasks per participant: `T1` to `T4`
- Four Latin-square orders: `A` to `D`
- Event-driven PM schedule measured in gameplay seconds
- One main experiment runtime rather than the older 3-block / 12-task design

## Runtime Flow

```text
Welcome
  -> Consent
  -> Story / introduction
  -> Encoding videos and intention checks
  -> Tutorial / training
  -> Main experiment
  -> Post-test questionnaires
  -> Debrief
  -> Completed
```

Canonical backend phase names are defined in `backend/engine/phase_state.py`.
Frontend route/render mapping is handled in `frontend/src/utils/phase.ts`.

## Backend

The backend is a FastAPI application using async SQLAlchemy and PostgreSQL.

Key areas:

| Area | Files |
|------|-------|
| App entry point | `backend/main.py` |
| Environment and experiment config | `backend/config.py` |
| Database setup | `backend/database.py`, `backend/models/` |
| Participant/session APIs | `backend/routers/session.py` |
| Admin APIs | `backend/routers/admin.py`, `backend/routers/timeline_editor.py` |
| WebSocket runtime | `backend/websocket/game_handler.py`, `backend/websocket/connection_manager.py` |
| Main runtime orchestration | `backend/engine/block_runtime.py` |
| PM trigger scheduler | `backend/engine/pm_session.py` |
| Pause-aware game clock | `backend/engine/game_clock.py` |
| Cooking runtime | `backend/engine/cooking_engine.py` |
| Runtime plan loading | `backend/engine/runtime_plan_loader.py` |

Experiment-facing materials are backend-authoritative and live under
`backend/data/experiment_materials/`. The material loader is
`backend/data/materials.py`.

## Frontend

The frontend is a Vite + React + TypeScript app with Zustand state.

Key areas:

| Area | Files |
|------|-------|
| App phase shell | `frontend/src/App.tsx` |
| Game page | `frontend/src/pages/game/GamePage.tsx` |
| Floor plan | `frontend/src/components/game/FloorPlanView.tsx` |
| Phone UI | `frontend/src/components/game/PhoneSidebar.tsx`, `frontend/src/components/game/phone/` |
| PM trigger modal | `frontend/src/components/game/PMTriggerModal.tsx` |
| WebSocket client | `frontend/src/hooks/useWebSocket.ts` |
| Global runtime state | `frontend/src/stores/gameStore.ts`, `frontend/src/stores/slices/` |
| Admin dashboard | `frontend/src/pages/admin/` |

## WebSocket Runtime

The main game uses `/ws/game/{session_id}/{block_id}` for runtime events.
The active runtime emits:

- PM trigger and fake-trigger events
- PM pipeline state updates
- Cooking step activation, wait, timeout, completion, and dish-complete events
- Phone messages
- Time ticks and heartbeat/keepalive events
- Session-end transition events

PM trigger encounters are in-world interaction flows. Do not call them
cutscenes. In this codebase, cutscene means the fixed encoding/tutorial video
sequence before gameplay.

## Time Ownership

Gameplay time is owned by `GameClock` and coordinated by `BlockRuntime`.
Gameplay sleeps and deadlines should use gameplay seconds, not direct wall-clock
elapsed time. This matters because PM encounters can pause or otherwise control
the runtime while preserving experimental timing semantics.

The historical GameClock migration report is archived at
[archive/migrations/GAME_CLOCK_MIGRATION_REPORT_2026-05-03.md](archive/migrations/GAME_CLOCK_MIGRATION_REPORT_2026-05-03.md).

## Runtime Plan

Gameplay schedule data is stored in one editable runtime plan:

```text
backend/data/runtime_plans/main_experiment.json
```

The plan owns four schedule lanes:

| Lane | Purpose | Runtime owner |
|------|---------|---------------|
| `pm_schedule` | Real/fake PM trigger delays after the previous PM pipeline | `engine/pm_session.py` |
| `cooking_schedule` | Absolute game-time cooking step activations | `engine/cooking_engine.py` |
| `robot_idle_comments` | Absolute game-time non-interactive robot comments | `engine/cooking_engine.py` |
| `phone_messages` | Absolute game-time phone message deliveries by message id | `engine/timeline.py` |

`BlockRuntime` loads the runtime plan once when gameplay starts, then passes each
lane to the owning subsystem. The admin route `/timeline-editor` edits this
plan through:

- `GET /api/admin/timelines/runtime-plan`
- `PUT /api/admin/timelines/runtime-plan`
- `POST /api/admin/timelines/preview`
- `GET /api/admin/timelines/schema`

The old generated/static timeline system is archived. Do not reintroduce legacy
`CONTROL` / `AF` / `AFCB` timeline generation or per-block static timeline JSONs.

## Data and Export

Participant state, PM events, cooking logs, interaction logs, and phase history
are persisted in PostgreSQL through SQLAlchemy models under `backend/models/`.
Admin CSV exports are served by `backend/routers/admin.py`.

Schema migrations are not yet managed by Alembic; startup still relies on
SQLAlchemy table creation for local development. Treat production schema changes
as manual migrations unless a migration framework is added.
