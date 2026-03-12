# Saturday At Home — Configuration & Setup Guide

## 1. Quick Start

### Prerequisites
- Python 3.10+ (backend)
- Node.js 18+ (frontend)
- `conda` environment named `thesis_server` (or any venv with requirements installed)

### Start the Backend
```bash
conda activate thesis_server
cd SaturdayAtHome/backend
pip install -r requirements.txt
python main.py
# Runs on http://localhost:5000
```

### Start the Frontend (Dev)
```bash
cd SaturdayAtHome/frontend
npm install
npm run dev
# Runs on http://localhost:3000 — proxies /api → http://localhost:5000
```

### Build Frontend for Production
```bash
cd SaturdayAtHome/frontend
npm run build
# Output in dist/ — served automatically by the FastAPI backend at /
```

---

## 2. Game Difficulty Parameters

### Steak Cooking Speed

Configured in `backend/core/config.py`:

```python
DIFFICULTY_CONFIG = {
    "slow":   {"cooking_ms": 20000, "ready_ms": 5000, "max_steaks": 2},
    "medium": {"cooking_ms": 13000, "ready_ms": 4000, "max_steaks": 3},
    "fast":   {"cooking_ms":  9000, "ready_ms": 3000, "max_steaks": 3},
}
```

| Field | Description |
|-------|-------------|
| `cooking_ms` | Time (ms) from steak spawn until it becomes READY (golden) |
| `ready_ms` | Time (ms) in READY state before it turns BURNING (black) |
| `max_steaks` | Max concurrent active hobs (not currently enforced by spawn logic) |

The same values are mirrored in `frontend/src/store/gameStore.js` under `DIFFICULTY` for local hob transition checks:

```js
const DIFFICULTY = {
  slow:   { cookingMs: 20000, readyMs: 5000,  maxSteaks: 2 },
  medium: { cookingMs: 13000, readyMs: 4000,  maxSteaks: 3 },
  fast:   { cookingMs:  9000, readyMs: 3000,  maxSteaks: 3 },
}
```

> **Important:** Both values must be kept in sync. The backend uses its own values for `steak_spawn` SSE event payloads; the frontend uses its values for the 500ms hob-transition checker.

### Setting Difficulty for a Session

Difficulty is set at session creation (`POST /session/start`) in the request body:
```json
{ "participant_id": "P001", "difficulty": "medium" }
```

Defaults to `"medium"` if omitted.

### Steak Spawn Frequency

Configured in `backend/core/timeline.py`, inside `build_timeline()`:

```python
t = 3               # first spawn at t=3s
while t < 490:
    timeline.append(...)
    t += random.randint(8, 15)   # ← spawn interval: 8–15s
```

Change `random.randint(8, 15)` to adjust how often new steaks appear.

---

## 3. Block Timeline Parameters

All event timing is in `backend/core/timeline.py`. The full block lasts **510 seconds (8.5 min)**.

### Key Events & Their Timing

| Time (s) | Event | Config Location |
|----------|-------|-----------------|
| 35 | Fake trigger (delivery) | `build_timeline()` line ~33 |
| 75 | Robot neutral comment #1 | `build_timeline()` — `neutral_1` variable |
| 95 | Force steak READY (pre-reminder pressure) | `build_timeline()` line ~39 |
| 120 | **Reminder A fires** | `build_timeline()` line ~42 |
| 210–240 | Task A execution window (30s) | `build_timeline()` lines ~45–46 |
| 270 | Robot neutral comment #2 | `build_timeline()` — `neutral_2` variable |
| 275 | Force steak READY (pre-reminder pressure) | `build_timeline()` line ~52 |
| 300 | **Reminder B fires** | `build_timeline()` line ~55 |
| 390–420 | Task B execution window (30s) | `build_timeline()` lines ~58–59 |
| 510 | Block end | `build_timeline()` line ~62 |

### Execution Window Duration

The hidden window during which participants can interact with the PM trigger:

```python
(210, "trigger_appear", {"task_id": ..., "slot": "A", "window_ms": 30000}),
(240, "window_close",   {"task_id": ..., "slot": "A"}),
```

Change `window_ms` and the `window_close` offset (currently 30s after `trigger_appear`) to adjust the window length.

### Message Bubble Timing

Six messages per block, defined at the bottom of `build_timeline()`. Timing avoids ±60s around reminders (t=120, t=300):

```python
(55,  "message_bubble", {...}),   # Sarah — party time
(130, "message_bubble", {...}),   # FoodDash — delivery
(220, "message_bubble", {...}),   # David — parking
(310, "message_bubble", {...}),   # Building Mgmt — package
(400, "message_bubble", {...}),   # Sarah — dessert
(460, "message_bubble", {...}),   # Neighbor Jan — visit
```

### Message Reply Timeout

Configured in `frontend/src/components/rooms/MessagesCard.jsx`:
```js
const MESSAGE_TIMEOUT_MS = 15000   // 15 seconds to reply
```

Penalty for expiry: −2 points (set in `frontend/src/store/gameStore.js` → `expireMessage`).

---

## 4. Reminder Text (Experimental Conditions)

The 2×2 condition matrix and reminder texts are in `backend/core/config.py`:

```python
REMINDER_TEXTS = {
    "LowAF_LowCB":   "By the way, remember — after dinner today, take your medicine.",
    "HighAF_LowCB":  "By the way, remember — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed.",
    "LowAF_HighCB":  "I can see you're keeping an eye on the stove. By the way — after dinner today, remember to take your medicine.",
    "HighAF_HighCB": "I can see you're keeping an eye on the stove. By the way — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed.",
}
```

| Code | Affective Focal (AF) | Cognitive Burden (CB) | Description |
|------|---------------------|-----------------------|-------------|
| `LowAF_LowCB` | Low | Low | Generic reminder, no context |
| `HighAF_LowCB` | High | Low | Specific medicine detail, no context-awareness |
| `LowAF_HighCB` | Low | High | Context-aware ("watching the stove"), generic task |
| `HighAF_HighCB` | High | High | Context-aware + specific medicine detail |

---

## 5. Latin Square Counterbalancing

Four groups (A–D), each participant assigned in round-robin at session creation:

```python
LATIN_SQUARE = {
    "A": ["LowAF_LowCB",  "HighAF_LowCB",  "LowAF_HighCB",  "HighAF_HighCB"],
    "B": ["HighAF_LowCB", "LowAF_HighCB",  "HighAF_HighCB", "LowAF_LowCB"],
    "C": ["LowAF_HighCB", "HighAF_HighCB", "LowAF_LowCB",   "HighAF_LowCB"],
    "D": ["HighAF_HighCB","LowAF_LowCB",   "HighAF_LowCB",  "LowAF_HighCB"],
}
```

Each group determines the order of conditions across blocks 1–4.

### Task Pairs per Block

```python
TASK_PAIRS = {
    1: ("medicine_a", "medicine_b"),   # Block 1 — medicine cabinet
    2: ("laundry_c",  "laundry_d"),    # Block 2 — laundry (not yet implemented)
    3: ("comm_e",     "comm_f"),        # Block 3 — communication (not yet implemented)
    4: ("chores_g",   "chores_h"),      # Block 4 — chores (not yet implemented)
}
```

---

## 6. PM Task Answer Keys (Backend Only)

Correct answers are stored **only** in `backend/services/scoring.py` to prevent participants from inspecting via browser DevTools.

```python
CORRECT_ANSWERS = {
    "medicine_a": {"bottle": "round_red",    "amount": "2 tablets"},
    "medicine_b": {"bottle": "round_orange", "amount": "500mg × 2"},
}
```

Scoring: both correct = 2 pts, one correct = 1 pt, submitted outside window = 0 pt, missed = 0 pt.

---

## 7. Audio Configuration

### BGM

Place a royalty-free audio file at:
```
frontend/public/audio/bgm.mp3
```

The system also accepts `bgm.wav` as fallback. The audio engine (`frontend/src/utils/audio.js`) fades in over 2 seconds at block start.

Volume levels (editable in `audio.js`):
```js
const BGM_NORMAL = 0.35   // normal playback level
const BGM_DUCKED = 0.08   // ducked during robot speech
```

Ducking transitions:
- Duck: 300ms when robot starts speaking
- Restore: 800ms after robot finishes

### Robot TTS

Uses Web Speech API (built into Chrome/Edge). Settings:
```js
{ lang: 'en-US', rate: 0.9, pitch: 1.0 }
```

Change `rate` for faster/slower speech. Tested on Chrome — Firefox/Safari support varies.

### Sound Effects

All SFX are procedurally generated via Web Audio API (no files required). Functions in `audio.js`:

| Function | Trigger | Description |
|----------|---------|-------------|
| `sfxSteakReady()` | Steak → READY | Short sizzle + high tone |
| `sfxSteakBurning()` | Steak → BURNING | Low sawtooth alarm (2 pulses) |
| `sfxMessageNotify()` | New message arrives | Ascending 3-note chime |
| `sfxMessageTimeout()` | Message expires | Low thud |
| `sfxScorePlus()` | Score increases | Bright double ding |
| `sfxScoreMinus()` | Score decreases | Low double thud |
| `sfxRobotChime()` | Before robot speaks | Soft 2-note chime |

---

## 8. Database

SQLite database is created automatically at:
```
backend/core/experiment.db
```

Add `experiment.db` to `.gitignore` to avoid committing participant data.

### Key Tables

| Table | Contents |
|-------|----------|
| `sessions` | One row per participant session |
| `pm_trials` | One row per PM task execution attempt |
| `encoding_logs` | Quiz attempt counts per block |
| `ongoing_snapshots` | Score delta snapshots (steak actions) |
| `fake_trigger_logs` | Fake trigger interactions |
| `questionnaire_logs` | Post-block Likert ratings |
| `action_logs` | Full audit trail of all events |
| `reminder_room_logs` | Which room participant was in when reminder fired |

### Data Export

Single session CSV (includes PM scores + reminder room context):
```
GET /api/session/{session_id}/export
```

Admin panel export (all sessions):
```
GET /api/admin/sessions
```

---

## 9. Dashboard

**Experimenter dashboard**: `http://localhost:3000/dashboard`

- View active session state (hobs, messages, score)
- Manually fire SSE events (trigger reminder, force steak, trigger PM task)
- Monitor SSE event log

**Database manager**: `http://localhost:3000/manage`

- View raw session and trial data with precise timestamps
- Delete test sessions

---

## 10. Frontend Store Key Settings

In `frontend/src/store/gameStore.js`:

```js
const MESSAGE_TIMEOUT_MS = 15000   // Message reply window (ms)
```

In `frontend/src/components/GameShell.jsx`:

```js
const TICK_RATE = 1000       // Game loop tick (1s)
const HOB_CHECK_RATE = 500   // Hob state transition check interval (ms)
```

Plant wilt delay (living room):
```js
// In GameShell.jsx, 500ms interval:
if (now - state.plantNeedsWaterSince >= 30000) state.wiltPlant()  // 30s
```

---

## 11. Project File Structure

```
SaturdayAtHome/
├── backend/
│   ├── main.py                  # FastAPI entry point (port 5000)
│   ├── requirements.txt
│   ├── core/
│   │   ├── config.py            # ← DIFFICULTY, LATIN_SQUARE, REMINDER_TEXTS
│   │   ├── database.py          # SQLite schema + connection
│   │   ├── sse.py               # SSE queue management
│   │   └── timeline.py          # ← Block event schedule (timings, messages)
│   ├── models/
│   │   ├── schemas.py           # Pydantic request/response models
│   │   └── entities.py          # HobStatus enum, Hob dataclass
│   ├── services/
│   │   ├── scoring.py           # ← PM CORRECT_ANSWERS (backend-only)
│   │   ├── hob_service.py       # Hob state management + respawn
│   │   └── window_service.py    # ExecutionWindow lifecycle
│   ├── routes/
│   │   ├── session.py           # Session start, block config, SSE stream
│   │   ├── experiment.py        # Encoding, PM action, steak, messages
│   │   └── admin.py             # Dashboard API, event firing, export
│   └── utils/
│       └── helpers.py           # log_action()
│
├── frontend/
│   ├── src/
│   │   ├── config/
│   │   │   └── taskConfigs.js   # ← Medicine task bottle/amount options (no answers)
│   │   ├── store/
│   │   │   └── gameStore.js     # ← MESSAGE_TIMEOUT_MS, DIFFICULTY mirror
│   │   ├── utils/
│   │   │   └── audio.js         # ← BGM_NORMAL, BGM_DUCKED, TTS settings
│   │   ├── hooks/
│   │   │   ├── useSSE.js        # SSE event → store action mapping
│   │   │   └── useAudio.js      # Audio hook (mounts in GameShell)
│   │   └── components/
│   │       ├── GameShell.jsx    # ← TICK_RATE, HOB_CHECK_RATE, plant wilt delay
│   │       ├── rooms/
│   │       │   ├── KitchenCard.jsx
│   │       │   └── MessagesCard.jsx  # ← MESSAGE_TIMEOUT_MS (display only)
│   │       ├── tasks/
│   │       │   └── MedicineCabinet.jsx
│   │       └── ui/
│   │           ├── Sidebar.jsx
│   │           └── RobotAvatar.jsx
│   └── public/
│       └── audio/
│           └── bgm.mp3          # ← Replace with your royalty-free BGM file
│
└── docs/
    ├── GDD_v1.0_Saturday_At_Home.md
    ├── GDD_Addendum_v1.0.md
    ├── PRD_v1.7_Robot_Reminder_Experiment.md
    ├── SSE_技术文档.md
    └── CONFIGURATION.md         # ← This file
```
