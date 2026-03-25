# CookingForFriends — Configuration Reference

> All configurable parameters, their defaults, and where they're used.

---

## Backend Configuration (`backend/config.py`)

### Paths

| Constant | Default | Env Var | Description |
|----------|---------|---------|-------------|
| `BASE_DIR` | `Path(__file__).parent` | — | Backend root directory |
| `DATA_DIR` | `BASE_DIR/data` | `DATA_DIR` | Phone messages, timelines, assets |
| `DB_PATH` | `BASE_DIR/experiment.db` | `DB_PATH` | SQLite database file |

### Server

| Constant | Value | Description |
|----------|-------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `5000` | Server port |

### Session & Tokens

| Constant | Value | Description |
|----------|-------|-------------|
| `TOKEN_LENGTH` | `6` | Participant login token length |
| `TOKEN_CHARSET` | `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | Charset (no 0/O/1/I ambiguity) |
| `DEV_TOKEN` | `ABC123` (env: `DEV_TOKEN`) | Auto-seeded dev participant. Set empty for production. |

### Experiment Timing

| Constant | Value | Used In | Description |
|----------|-------|---------|-------------|
| `BLOCKS_PER_PARTICIPANT` | `3` | session.py, admin.py | Number of game blocks per session |
| `PM_TASKS_PER_BLOCK` | `4` | admin.py, timeline_generator | PM tasks per block (12 total) |
| `BLOCK_DURATION_S` | `600` | timeline.py | Block length in real seconds (10 min) |
| `EXECUTION_WINDOW_S` | `30` | pm_scorer.py, execution_window.py | Primary PM response window |
| `LATE_WINDOW_S` | `60` | pm_scorer.py, execution_window.py | Extended PM window (score=1) |
| `REMINDER_LEAD_S` | `120` | timeline_generator.py | Reminder fires N seconds before trigger |

### Phone

| Constant | Value | Description |
|----------|-------|-------------|
| `PHONE_LOCK_TIMEOUT_S` | `30` | Auto-lock phone after inactivity |

### Data Capture

| Constant | Value | Description |
|----------|-------|-------------|
| `MOUSE_SAMPLE_INTERVAL_MS` | `200` | Mouse position sampling rate |
| `MOUSE_BATCH_INTERVAL_S` | `5` | Mouse batch send interval |
| `SNAPSHOT_INTERVAL_S` | `15` | Game state snapshot interval |
| `HEARTBEAT_INTERVAL_S` | `10` | Client heartbeat interval |
| `HEARTBEAT_TIMEOUT_S` | `30` | Max time before marking offline |

### Latin Square

| Group | Block 1 | Block 2 | Block 3 |
|-------|---------|---------|---------|
| A | CONTROL | AF | AFCB |
| B | AF | AFCB | CONTROL |
| C | AFCB | CONTROL | AF |
| D | CONTROL | AFCB | AF |
| E | AF | CONTROL | AFCB |
| F | AFCB | AF | CONTROL |

---

## Frontend Configuration

### Vite (`frontend/vite.config.ts`)

| Setting | Value | Description |
|---------|-------|-------------|
| Dev server port | `3000` | Frontend dev server |
| API proxy | `/api → http://localhost:5000` | REST proxy |
| WS proxy | `/ws → ws://localhost:5000` | WebSocket proxy |

### WebSocket (`frontend/src/hooks/useWebSocket.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| `HEARTBEAT_INTERVAL` | `10,000 ms` | Heartbeat send interval |
| `RECONNECT_BASE_MS` | `500 ms` | Initial reconnect delay |
| `RECONNECT_MAX_MS` | `5,000 ms` | Max reconnect delay (exponential backoff) |

### Phone Sidebar (`frontend/src/components/game/PhoneSidebar.tsx`)

| Constant | Value | Description |
|----------|-------|-------------|
| `BANNER_DURATION` | `3,000 ms` | Phone banner auto-dismiss time |
| `AUTO_LOCK_TIMEOUT` | `30,000 ms` | Phone auto-lock after inactivity |

### PM Interaction (`frontend/src/components/game/PMTargetItems.tsx`)

| Config | Value | Description |
|--------|-------|-------------|
| Room → Furniture mapping | study→Bookshelf, bedroom→Cabinet, living_room→Shelf, bathroom→Supply Shelf, kitchen→Kitchen Shelf | Furniture button per room |

---

## Timeline Generator (`backend/engine/timeline_generator.py`)

### Steak Cadence

| Parameter | Value | Description |
|-----------|-------|-------------|
| `_STEAK_INTERVAL_S` | `20` | New steak every 20 seconds |
| `_NUM_PANS` | `3` | Cycling through 3 pans |

### Fake Triggers (per block)

| Block | Type | Content | Duration |
|-------|------|---------|----------|
| 1 | visitor | Courier drops off a flyer | 5s |
| 2 | appliance | Microwave beeps briefly | 3s |
| 3 | visitor | Neighbor waves hello | 4s |

---

## PM Task Registry (`backend/engine/pm_tasks.py`)

12 PM tasks across 3 blocks (4 per block). Each defines:
- `task_id` — unique identifier (e.g., `b1_book`)
- `block` — which block (1–3)
- `trigger_type` — `visitor`, `communication`, `appliance`, `activity`
- `trigger_visual` / `trigger_audio` — sensory cue identifiers
- `target_room` — room where the item is found
- `target_name` / `target_image` — the correct item
- `distractor` / `discriminating_cue` — distractor item + how to distinguish
- `action` / `action_destination` — what to do with the item
- `encoding_text` — story paragraph shown during encoding
- `reminder_text` — baseline reminder content

---

## Data Directory Structure (`backend/data/`)

```
data/
├── messages/
│   ├── messages_day1.json    — Phone messages for block 1
│   ├── messages_day2.json    — Phone messages for block 2
│   └── messages_day3.json    — Phone messages for block 3
├── timelines/                — Fallback static timeline JSONs (optional)
│   ├── block_1_control.json
│   └── ...
└── sounds/                   — Audio assets (trigger sounds)
```

### Phone Message Format (`messages_dayN.json`)
```json
{
  "messages": [
    {
      "id": "msg_001",
      "sender": "Mom",
      "avatar": "👩",
      "text": "Don't forget to...",
      "type": "chat",
      "replies": [
        {"id": "r1", "text": "Sure!", "correct": true},
        {"id": "r2", "text": "Later", "correct": false}
      ]
    }
  ]
}
```

---

## PM Scoring Thresholds (`backend/engine/pm_scorer.py`)

| Constant | Value | Description |
|----------|-------|-------------|
| `DELAYED_THRESHOLD_S` | `15.0` | Boundary between score 6 (≤15s) and 5 (>15s) |
| `EXECUTION_WINDOW_S` | `30` | From config — primary window boundary |
| `LATE_WINDOW_S` | `60` | From config — late window boundary |

---

## Connection Manager (`backend/websocket/connection_manager.py`)

| Setting | Value | Description |
|---------|-------|-------------|
| Queue size | `256` | Max queued messages per participant |
| Keepalive interval | `5s` | WS pump sends keepalive on idle |
| Critical events | `pm_trigger, block_end, pm_received, ongoing_task_event` | These block (await) instead of dropping on full queue |
| Eviction policy | Single connection | Old connections evicted on reconnect |

---

## Database (`backend/database.py`)

| Setting | Value | Description |
|---------|-------|-------------|
| Engine | `sqlite+aiosqlite` | Async SQLite driver |
| `expire_on_commit` | `False` | Objects accessible after commit |
| Auto-seed | On startup if `DEV_TOKEN` set | Creates/resets dev participant |
