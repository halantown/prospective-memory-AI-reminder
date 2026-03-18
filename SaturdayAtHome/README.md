# Saturday At Home

A browser-based experimental platform for a **2×2 within-subjects Prospective Memory (PM)** study. Participants perform literature-validated cognitive tasks (Semantic Categorization, Go/No-Go, Trivia) with daily-life visual skins while remembering to self-initiate PM actions via trigger objects embedded in a minimap sidebar.

**Design document**: `docs/PRD_v2_1_MCQ_CogTask.md`

## Architecture

```
SaturdayAtHome/
├── game_config.yaml            # Single source of truth for ALL game parameters
├── docker-compose.yml          # MySQL 8.0 Docker service
├── .env                        # MySQL credentials (local dev)
├── backend/                    # Python FastAPI + MySQL (port 5000)
│   ├── main.py                 # Entry point (uvicorn, lifespan init)
│   ├── core/
│   │   ├── config_loader.py    # Loads YAML, pm_tasks.json, game_items
│   │   ├── database.py         # PyMySQL wrapper (sqlite3-compatible API)
│   │   ├── block_scheduler.py  # Generates 22-event block schedule
│   │   ├── timeline.py         # Async timeline runner, pm_trial pre-creation
│   │   ├── ws.py               # Bidirectional WebSocket hub (6 client msg types)
│   │   ├── session_lifecycle.py # Session phase machine + heartbeat monitor
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
│   │   │   ├── GameShell.jsx         # Phase router + MainPanel+Sidebar layout
│   │   │   ├── scene/
│   │   │   │   └── sceneConstants.js # Room data (colors, furniture, triggers)
│   │   │   ├── game/
│   │   │   │   ├── MainPanel.jsx        # Game type router (active/transition)
│   │   │   │   ├── RoomBackground.jsx   # Faded room illustration (z:0, opacity 0.07)
│   │   │   │   ├── RobotSpeechToast.jsx # Robot speech toast (z:2, bottom)
│   │   │   │   ├── HomeMapSidebar.jsx   # Sidebar: clock, minimap, robot, activity
│   │   │   │   ├── SemanticCatGame.jsx  # Email sorting (3-4s/item)
│   │   │   │   ├── GoNoGoGame.jsx       # Grocery shopping (2-3s/item)
│   │   │   │   ├── TriviaGame.jsx       # Podcast quiz (5-8s/item)
│   │   │   │   └── TransitionScreen.jsx # Between-game transition display
│   │   │   ├── sidebar/              # Reusable sidebar sub-components
│   │   │   │   └── Clock.jsx         # Sky-gradient time display
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
│   │   ├── store/gameStore.js   # Zustand state (session/game/scene/robot/MCQ)
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js  # Bidirectional WS + reconnect + heartbeat
│   │   │   └── useAudio.js      # Web Audio beep + Web Speech TTS
│   │   └── utils/api.js         # GET-only + session start POST
│   └── dist/                    # Production build (served by FastAPI at /)
└── docs/
    ├── PRD_v2_1_MCQ_CogTask.md  # Design specification (source of truth)
    └── PRD_ADDENDUM_visual_overhaul.md  # Visual overhaul specification
```

## Quick Start

### Prerequisites

- Python 3.10+ with conda environment `thesis_server`
- Node.js 18+
- Docker (for MySQL)

### Database (MySQL via Docker)

```bash
cd SaturdayAtHome
docker compose up -d
# → MySQL 8.0 on localhost:3306 (user: saturday, db: experiment)
```

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
┌─────────────────────────────────────────────┬─────────────┐
│  MAIN PANEL (~75%)                          │ SIDEBAR     │
│                                             │ (~25%)      │
│  ┌─ Room background layer (z:0) ──────────┐ │             │
│  │  Faded illustration of current room     │ │  10:30 AM  │
│  │  (emoji silhouettes, opacity ~0.07)     │ │  Saturday   │
│  │                                         │ │             │
│  │  ┌─ Game layer (z:1) ────────────────┐  │ │ ┌─────────┐│
│  │  │  Semi-transparent white panel      │  │ │ │ MINIMAP ││
│  │  │  (~92% of main area)               │  │ │ │         ││
│  │  │   📧 Sorting emails                │  │ │ │ Study•  ││
│  │  │   [email card]                     │  │ │ │ Kitchen ││
│  │  │   [Work] [Personal] [Spam]         │  │ │ │ Living  ││
│  │  └───────────────────────────────────┘  │ │ │ Laundry ││
│  └─────────────────────────────────────────┘ │ │ Entry   ││
│                                             │ │ Balcony ││
│  ┌─ Robot toast (z:2) ─────────────────┐    │ │         ││
│  │ 🤖 "Lot of emails this week!"      │    │ └─────────┘│
│  └─────────────────────────────────────┘    │  🤖 Pepper  │
│                                             │    idle     │
└─────────────────────────────────────────────┴─────────────┘
```

**Layout**: `flex` with `flex-1` main panel + `280px` fixed-width sidebar.

**Room background**: CSS-only emoji at 0.07 opacity, grayscale 60%, crossfades on room change (500ms).

**Game panel**: `rgba(255,255,255,0.88)` background, 92% of main area, rounded corners. Game components render inside unchanged.

**Minimap**: SVG-based top-down floor plan in sidebar. Rooms as colored rectangles with furniture emoji. Avatar (blue dot) and Pepper (🤖) animate between rooms. Trigger emoji have 3 states: inactive, ambient (pulse), fired (glow + red dot, clickable).

**Trigger states**: inactive (static) → ambient (subtle pulse) → fired (glow + bounce + red dot). "Ding" sound only on transitions to fired state. Ambient pulses occur without PM association (anti-meta-strategy).

**Robot speech**: Toast at bottom of main panel with 🤖 icon. Identical style for neutral comments and PM reminders. Sidebar shows Pepper status (idle/speaking) simultaneously.

**Encoding & questionnaire**: Render inside the main panel area with sidebar still visible (participant can see the minimap while learning PM tasks).

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

All experiment data stored in MySQL (`experiment` database, Docker container `saturday_mysql`):

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

Connection: `MYSQL_HOST=127.0.0.1`, `MYSQL_PORT=3306`, `MYSQL_USER=saturday`, `MYSQL_DATABASE=experiment` (configured in `.env`).
