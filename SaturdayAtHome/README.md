# Saturday At Home (PRD v2.0 State-Driven)

A browser-based experimental platform for a 2×2 within-subjects Prospective Memory study.

The v2.0 build uses a **state-driven day simulation**:

- System-controlled room transitions (participant cannot freely switch rooms)
- Moderate-engagement ongoing activities (no urgency penalties)
- Robot co-presence with neutral comments + PM reminders
- PM scoring remains backend-only (0/1/2), never shown to participants

## Project Structure

```text
SaturdayAtHome/
├── game_config.yaml
├── backend/
│   ├── main.py
│   ├── core/            # config loader, DB init, ws hub, timeline scheduler/runtime
│   ├── routes/          # session, experiment, admin, config APIs
│   ├── services/        # reminder generation/cache, scoring, window management
│   └── tests/
├── frontend/
│   └── src/
│       ├── store/       # Zustand state machine for block flow
│       ├── hooks/       # websocket timeline client
│       ├── components/  # screens, room view, PM panel, dashboard
│       └── utils/       # API wrappers
└── docs/
```

## Run

Backend:

```bash
conda activate thesis_server
cd SaturdayAtHome/backend
pip install -r requirements.txt
python main.py
```

Frontend:

```bash
cd SaturdayAtHome/frontend
npm install
npm run dev
```

Production bundle:

```bash
cd SaturdayAtHome/frontend
npm run build
```

## Core Runtime Flow

1. Participant enters token (`POST /api/session/start`)
2. Frontend fetches block config (`GET /api/session/{id}/block/{n}`)
3. After encoding confirmation, frontend opens block stream (`WS /api/session/{id}/block/{n}/stream`)
4. Backend timeline pushes events by schedule
5. Frontend reacts to room transitions, robot speech, reminders, trigger windows
6. PM actions logged and scored on backend only

## WebSocket Events

State-driven main events:

- `room_transition`
- `robot_speak`
- `reminder_fire`
- `trigger_appear`
- `window_close`
- `block_end`

## API Highlights

- `POST /api/session/start`
- `GET /api/session/{id}/block/{n}`
- `POST /api/session/{id}/block/{n}/encoding`
- `POST /api/session/{id}/block/{n}/action`
- `POST /api/session/{id}/questionnaire`
- `POST /api/session/{id}/heartbeat`

Admin:

- `POST /api/admin/participant/create`
- `POST /api/admin/force-block/{id}/{n}`
- `POST /api/admin/generate-reminder`
- `GET /api/admin/session/{id}/state`
- `GET /api/admin/export/{id}`

## Configuration

`game_config.yaml` is the single source of truth. Key sections:

- `timeline` (event times + room schedules)
- `experiment` (Latin square, block task slots, AF/CB condition rules)
- `rooms` (ongoing activity prompt templates)
- `pm_tasks` (8 isomorphic PM tasks)
- `audio` (TTS settings)

`GET /api/config/game` returns a participant-safe config snapshot.

## Validation

Backend tests:

```bash
cd SaturdayAtHome/backend
PYTHONPATH=. pytest -q
```

Frontend build:

```bash
cd SaturdayAtHome/frontend
npm run build
```
