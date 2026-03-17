# Saturday At Home

A browser-based experimental platform for a **2×2 within-subjects Prospective Memory (PM)** study. Participants perform literature-validated cognitive tasks (Semantic Categorization, Go/No-Go, Trivia) with daily-life visual skins while remembering to self-initiate PM actions via a sidebar trigger system.

**Design document**: `docs/PRD_v2_1_MCQ_CogTask.md`

## Architecture

```
SaturdayAtHome/
├── game_config.yaml            # Single source of truth for ALL game parameters
├── backend/                    # Python FastAPI + SQLite (port 5000)
│   ├── main.py                 # Entry point (uvicorn, lifespan init)
│   ├── core/
│   │   ├── config_loader.py    # Loads YAML, pm_tasks.json, game_items
│   │   ├── database.py         # SQLite schema (10 tables), auto-init
│   │   ├── block_scheduler.py  # Generates 22-event block schedule
│   │   ├── timeline.py         # Async timeline runner, pm_trial pre-creation
│   │   ├── ws.py               # Bidirectional WebSocket hub (6 client msg types)
│   │   └── event_schedule.py   # EventType enum + WS_EVENT_MAP
│   ├── data/
│   │   ├── pm_tasks.json       # 8 PM tasks (encoding, quiz, trigger, MCQ, reminders)
│   │   ├── neutral_comments.json
│   │   └── game_items/         # Stimulus sets per skin (email_v1, grocery_v1, podcast_v1)
│   ├── models/schemas.py       # Pydantic request/response models
│   ├── routes/
│   │   ├── session.py          # Token-based start, block config, WS stream
│   │   ├── admin.py            # Participant create, admin WS, CSV export
│   │   ├── experiment.py       # GET endpoints (game items, config)
│   │   └── config_routes.py    # YAML editor endpoints
│   ├── services/scoring.py     # MCQ scoring (0/1/2)
│   └── utils/                  # Action logging helpers
├── frontend/                   # React 18 + Vite + Tailwind + Zustand (port 3000)
│   ├── src/
│   │   ├── components/
│   │   │   ├── GameShell.jsx         # Phase router + 75/25 layout
│   │   │   ├── game/
│   │   │   │   ├── MainPanel.jsx     # Game type router, dim-on-MCQ
│   │   │   │   ├── SemanticCatGame.jsx  # Email sorting (3-4s/item)
│   │   │   │   ├── GoNoGoGame.jsx       # Grocery shopping (2-3s/item)
│   │   │   │   ├── TriviaGame.jsx       # Podcast quiz (5-8s/item)
│   │   │   │   └── TransitionScreen.jsx # Room transition display
│   │   │   ├── sidebar/
│   │   │   │   ├── Sidebar.jsx       # Container (dark theme)
│   │   │   │   ├── Clock.jsx         # Day/night gradient status bar
│   │   │   │   ├── MiniMap.jsx       # 5-room floor plan
│   │   │   │   ├── ActivityLabel.jsx  # Current activity text
│   │   │   │   ├── RobotStatus.jsx   # Pepper status + speech bubble
│   │   │   │   └── TriggerZone.jsx   # 8 trigger icons (3 states)
│   │   │   ├── pm/
│   │   │   │   ├── EncodingCard.jsx  # PM task instruction display
│   │   │   │   ├── EncodingQuiz.jsx  # Verification question
│   │   │   │   └── MCQOverlay.jsx    # 3-option modal + 30s timer
│   │   │   ├── screens/
│   │   │   │   ├── WelcomeScreen.jsx
│   │   │   │   ├── OnboardingScreen.jsx
│   │   │   │   ├── EncodingScreen.jsx
│   │   │   │   ├── QuestionnaireScreen.jsx
│   │   │   │   ├── BlockEndScreen.jsx
│   │   │   │   └── CompleteScreen.jsx
│   │   │   └── Dashboard.jsx    # Experimenter live monitoring
│   │   ├── store/gameStore.js   # Zustand state (session/game/sidebar/robot/MCQ)
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js  # Bidirectional WS + reconnect + heartbeat
│   │   │   └── useAudio.js      # Web Audio beep + Web Speech TTS
│   │   └── utils/api.js         # GET-only + session start POST
│   └── dist/                    # Production build (served by FastAPI at /)
└── docs/
    └── PRD_v2_1_MCQ_CogTask.md  # Design specification (source of truth)
```

## Quick Start

### Prerequisites

- Python 3.10+ with conda environment `thesis_server`
- Node.js 18+

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

## Communication: WebSocket Only

**All runtime communication uses WebSocket** — both server push and client submissions. No REST endpoints for data submission.

### Connection Flow

1. Frontend connects to `WS /api/session/{id}/block/{n}/stream?client=participant&auto_start={bool}`
2. Backend `BlockTimeline` runs 22 scheduled events per block
3. Events pushed via async Queue to WS connection
4. Client sends messages (trigger_click, mcq_answer, encoding_result, ongoing_batch, questionnaire, heartbeat)
5. Both directions run concurrently on the same WS connection

### Server → Client Events

| Event               | When               | Payload                                        |
| ------------------- | ------------------ | ---------------------------------------------- |
| `game_start`      | Game A/B/C begins  | game_type, skin, items[], room, time, activity |
| `game_end`        | Game segment ends  | —                                             |
| `room_transition` | Between games      | next_room, next_time, next_activity            |
| `reminder_fire`   | 60s into game A/B  | text (condition-specific reminder)             |
| `trigger_fire`    | 150s into game A/B | sidebar_icon, task_id                          |
| `window_close`    | 30s after trigger  | task_id                                        |
| `robot_speak`     | Neutral comment    | text, type="neutral"                           |
| `ambient_pulse`   | Decoy icon pulse   | sidebar_icon                                   |
| `block_end`       | Block complete     | —                                             |

### Client → Server Messages

| Type                | When                                    |
| ------------------- | --------------------------------------- |
| `trigger_click`   | Participant clicks a fired trigger icon |
| `mcq_answer`      | MCQ selection submitted                 |
| `encoding_result` | Encoding quiz pass/fail                 |
| `ongoing_batch`   | Buffered game responses (every 5s)      |
| `questionnaire`   | Block or final questionnaire            |
| `heartbeat`       | Every 15s keep-alive                    |

## REST Endpoints (read-only + session setup)

| Method   | Path                              | Description                               |
| -------- | --------------------------------- | ----------------------------------------- |
| `POST` | `/api/admin/participant/create` | Create participant (returns token)        |
| `POST` | `/api/session/start`            | Start session with token                  |
| `GET`  | `/api/session/{id}/block/{n}`   | Block config (strips MCQ correct answers) |
| `GET`  | `/api/game-items/{skin}`        | Stimulus items for a game skin            |
| `GET`  | `/api/admin/dashboard`          | All sessions summary                      |
| `GET`  | `/api/admin/export/all`         | CSV export of all data                    |
| `GET`  | `/api/config`                   | Full config (admin)                       |
| `GET`  | `/api/config/game`              | Config stripped of correct answers        |

## Web Routes (Frontend)

| Route          | Purpose                      |
| -------------- | ---------------------------- |
| `/`          | Game (participant-facing)    |
| `/dashboard` | Experimenter live monitoring |
| `/config`    | YAML config editor           |

## Visual Layout

```
┌──────────────────────────────┬──────────────┐
│                              │ ☀️  11:15 AM  │  ← Day/night gradient clock
│                              │   Saturday   │
│   Main Panel (75%)           ├──────────────┤
│                              │   Kitchen    │  ← Activity label
│   Cognitive task game:       │   Checking   │
│   - Semantic Categorization  │   groceries  │
│   - Go/No-Go                 ├──────────────┤
│   - Trivia                   │ ┌────┬────┐  │
│                              │ │Study│Kitch│ │  ← Mini-map
│   Items presented at fixed   │ ├────┴────┤  │
│   intervals (2-8s by type)   │ │Liv │Entr│  │
│                              │ └────┴────┘  │
│                              ├──────────────┤
│                              │ 🤖 Pepper    │  ← Robot status
│                              │  Idle        │
│                              ├──────────────┤
│                              │ 🍽️ 📱 🧺 🔔  │
│                              │ ⏲️ 📺 🕐 🧥  │  ← 8 trigger icons
│                              │ Household    │     (always visible)
│                              │ Events       │
└──────────────────────────────┴──────────────┘
```

**Sidebar theme**: Dark (slate-900) for visual separation from the light game area.

**Trigger icon states**: inactive (grey) → ambient (subtle pulse) → fired (highlight + red dot). Same "ding" for all state changes. Some icons pulse ambiently without PM association (anti-meta-strategy).

## Experiment Design

- **2×2 within-subjects**: Associative Fidelity (Low/High) × Contextual Bridging (Low/High)
- **4 blocks** per participant, one condition each (Latin Square counterbalancing: groups A/B/C/D)
- **3 games per block**: Game A (3 min) → Game B (3 min) → Game C buffer (1 min)
- **2 PM tasks per block**: one in Game A slot, one in Game B slot
- **PM execution**: self-initiated MCQ — trigger fires in sidebar, participant must notice and click within 30s
- **PM scoring**: 0 (no click) / 1 (click + wrong MCQ) / 2 (click + correct MCQ) — **never shown to participant**
- **Reminders**: pre-generated text from `pm_tasks.json`, condition-specific. Robot delivers during retention interval, NOT at trigger time

### Block Timeline (8.5 minutes total)

| Phase      | Time (s) | Events                                                  |
| ---------- | -------- | ------------------------------------------------------- |
| Game A     | 0–180   | Reminder at 60s, trigger at 150s, window close at 180s  |
| Transition | 180–210 | Room change animation                                   |
| Game B     | 210–390 | Reminder at 270s, trigger at 360s, window close at 390s |
| Transition | 390–420 | Room change animation                                   |
| Game C     | 420–480 | Buffer game (no PM tasks)                               |
| Block end  | 510      | Questionnaire                                           |

### Session Flow

`Onboarding → Encoding (2 cards + 2 quizzes) → Block play → Questionnaire → (repeat ×4) → Final questionnaire → Thank you`

## Data

All experiment data stored in `backend/core/experiment.db` (SQLite, auto-created on startup):

| Table                      | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| `sessions`               | Session metadata, phase, Latin Square group       |
| `pm_trials`              | PM scoring (18 columns per PRD §5)               |
| `ongoing_responses`      | Cognitive task responses (accuracy, RT)           |
| `encoding_logs`          | Encoding quiz attempts                            |
| `questionnaire_logs`     | Block questionnaires (intrusiveness, helpfulness) |
| `session_questionnaires` | Final questionnaire (MSE, strategy, feedback)     |
| `block_events`           | Timeline event log with actual timestamps         |
| `action_logs`            | General action audit trail                        |
| `session_events`         | WS connection events                              |

Export via `/api/admin/export/all` (CSV) or `/dashboard` page.
