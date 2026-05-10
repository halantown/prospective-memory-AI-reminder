# CookingForFriends — Configuration Reference

> All configurable parameters, their defaults, and where they're used.

---

## Backend Configuration (`backend/config.py`)

### Paths & Database

| Constant | Default | Env Var | Description |
|----------|---------|---------|-------------|
| `BASE_DIR` | `Path(__file__).parent` | — | Backend root directory |
| `DATA_DIR` | `BASE_DIR/data` | `DATA_DIR` | Phone messages, timelines, assets |
| `DATABASE_URL` | `postgresql+asyncpg://cff:cff_dev_pass@localhost:5432/cooking_for_friends` | `DATABASE_URL` | PostgreSQL connection URL |

### Server

| Constant | Default | Env Var | Description |
|----------|---------|---------|-------------|
| `HOST` | `0.0.0.0` | `HOST` | Server bind address |
| `PORT` | `5000` | `PORT` | Server port |

### Session & Tokens

| Constant | Value | Description |
|----------|-------|-------------|
| `TOKEN_LENGTH` | `6` | Participant login token length |
| `TOKEN_CHARSET` | `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | Charset (no 0/O/1/I ambiguity) |
| `DEV_TOKEN` | `None` (env: `DEV_TOKEN`) | Dev participant auto-seed. Set `DEV_TOKEN=ABC123` to enable. |

### Experiment Design and Timing

| Constant | Value | Used In | Description |
|----------|-------|---------|-------------|
| `CONDITIONS` | Loaded from `counterbalancing.json` | config.py, admin.py | Current condition levels: `EE1`, `EE0` |
| `TASK_ORDERS` | Loaded from `counterbalancing.json` | condition_assigner.py | Four Latin-square orders over `T1`-`T4` |
| `TRIGGER_SCHEDULE` | Loaded from `counterbalancing.json` | pm_session.py | Event-driven trigger delays in game-time seconds |
| `SESSION_END_DELAY_AFTER_LAST_TRIGGER_S` | `60` | pm_session.py | Delay after final real trigger pipeline before post-test |
| `BLOCK_DURATION_S` | `900` | legacy timeline compatibility | Main experiment duration cap in gameplay seconds |
| `EXECUTION_WINDOW_S` | `120` | legacy compatibility | Historical PM response window constant |
| `LATE_WINDOW_S` | `60` | legacy compatibility | Historical late-window constant |
| `REMINDER_LEAD_S` | `30` | legacy compatibility | Historical reminder lead constant |

The current active design is one main experiment runtime with four real PM tasks,
plus fake trigger encounters. Older docs may mention 3 blocks / 12 PM tasks; that
design is archived and should not be used for new implementation work.

### Phone

| Constant | Value | Description |
|----------|-------|-------------|
| `PHONE_LOCK_TIMEOUT_S` | `15` | Must match frontend lock timeout if phone lock is enabled |
| `MESSAGE_COOLDOWN_S` | `10` default from env | Minimum gap between messages |
| `PHONE_MESSAGE_EXPIRY_MS` | `20,000` | Per-message expiry, must match frontend |

### Data Capture

| Constant | Value | Description |
|----------|-------|-------------|
| `MOUSE_SAMPLE_INTERVAL_MS` | `100` | Mouse position sampling rate |
| `MOUSE_BATCH_INTERVAL_S` | `60` | Mouse batch send interval |
| `SNAPSHOT_INTERVAL_S` | `15` | Game state snapshot interval |
| `HEARTBEAT_INTERVAL_S` | `30` | Client heartbeat interval |
| `HEARTBEAT_TIMEOUT_S` | `60` | Max time before marking offline |

### Latin Square

| Group | Position 1 | Position 2 | Position 3 | Position 4 |
|-------|------------|------------|------------|------------|
| A | T1 | T2 | T4 | T3 |
| B | T2 | T3 | T1 | T4 |
| C | T3 | T4 | T2 | T1 |
| D | T4 | T1 | T3 | T2 |

---

## Frontend Configuration

### Vite (`frontend/vite.config.ts`)

| Setting | Value | Description |
|---------|-------|-------------|
| Dev server port | `3000` | Frontend dev server |
| API proxy | `/api → http://localhost:5000` | REST proxy |
| WS proxy | `/ws → ws://localhost:5000` | WebSocket proxy |

### Participant UI Debug Controls

| Env Var | Current local value | Production behavior | Description |
|---------|---------------------|---------------------|-------------|
| `VITE_CFF_SHOW_DEV_NAV_CONTROLS` | `false` in `frontend/.env.local` | Always hidden unless built in Vite dev mode and this value is not `false` | Shows development-only main-experiment navigation controls and the Waypoint Editor button. Keep `false` when demonstrating the production participant experience from `npm run dev`. |

Main experiment navigation is intentionally sparse for participants: kitchen is
the normal active room, bedroom/bathroom and dining hall buttons are hidden, and
the living room button appears only during a doorbell PM trigger. In that PM
trigger state, the living room navigation button is highlighted and bounces.

### WebSocket (`frontend/src/hooks/useWebSocket.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| `HEARTBEAT_INTERVAL` | `30,000 ms` | Heartbeat send interval |
| `RECONNECT_BASE_MS` | `500 ms` | Initial reconnect delay |
| `RECONNECT_MAX_MS` | `15,000 ms` | Max reconnect delay (exponential backoff) |

### Phone Sidebar (`frontend/src/components/game/PhoneSidebar.tsx`)

| Constant | Value | Description |
|----------|-------|-------------|
| `SYSTEM_BANNER_DURATION` | `3,000 ms` | Low-key system notification banner auto-dismiss time |
| `CHAT_BANNER_DURATION` | `5,000 ms` | Chat preview banner auto-dismiss time |
| Phone lock | Temporarily disabled | `LockScreen.tsx` and `phoneLocked` are legacy placeholders; phone remains accessible throughout gameplay |

### Cooking Indicator (`frontend/src/components/game/phone/KitchenTimerBanner.tsx`)

| Behavior | Value | Description |
|----------|-------|-------------|
| Urgency threshold | Final 25% of active step window | Cooking Indicator pulses to signal imminent timeout |
| Missed feedback | `2,000 ms` | Cooking Indicator flashes red and shows "Missed!" |

### PM Interaction (`frontend/src/components/game/PMTargetItems.tsx`)

| Config | Value | Description |
|--------|-------|-------------|
| Room → Furniture mapping | study→Bookshelf, bedroom→Cabinet, living_room→Shelf, bathroom→Supply Shelf, kitchen→Kitchen Shelf | Furniture button per room |

### Encoding Interactive Videos

Encoding video material is configured in:

```text
backend/data/experiment_materials/encoding_materials.json
```

Each task uses four separate video segment files under:

```text
frontend/public/assets/encoding/t1/segment1.mp4
frontend/public/assets/encoding/t1/segment2.mp4
frontend/public/assets/encoding/t1/segment3.mp4
frontend/public/assets/encoding/t1/segment4.mp4
frontend/public/assets/encoding/t2/segment1.mp4
...
frontend/public/assets/encoding/t4/segment4.mp4
```

Files in `frontend/public/` are served directly by Vite. A material path such as
`/assets/encoding/t1/segment1.mp4` maps to:

```text
frontend/public/assets/encoding/t1/segment1.mp4
```

The frontend component is:

```text
frontend/src/components/game/InteractiveEncodingVideo.tsx
```

The formal participant-facing player has no visible video controls. Each
segment autoplays, stops when the segment video ends, then shows a pulsing
hotspot. The participant advances only by clicking the highlighted target.

The configured source of truth for each segment is:

```json
{
  "id": "segment1",
  "src": "/assets/encoding/t1/segment1.mp4",
  "label": "Game controller",
  "duration_ms": 12000,
  "click_target": {
    "id": "game_controller",
    "label": "Game controller",
    "hint": "Click the game controller",
    "x": 311,
    "y": 600,
    "width": 222,
    "height": 133
  }
}
```

Coordinates are stored in original video pixels, not CSS pixels. Current
encoding assets are expected to be `1112 x 834`, set by `frame_width` and
`frame_height` in each task material. The rendered window may resize, but the
hotspot is scaled proportionally over the video frame.

Use the hotspot positioning tool at:

```text
http://127.0.0.1:3000/admin/encoding-hotspots
```

Workflow:

1. Place the segment video under `frontend/public/assets/encoding/t*/`.
2. Open `/admin/encoding-hotspots`.
3. Enter the public video path, for example `/assets/encoding/t1/segment1.mp4`.
4. Keep frame size at `1112 x 834` unless the exported video resolution changes.
5. Drag a rectangle over the click target.
6. Copy the generated `click_target` JSON into the matching segment in
   `backend/data/experiment_materials/encoding_materials.json`.
7. Reload the participant flow and verify the hotspot appears on the final
   frame after playback ends.

The hotspot tool itself shows video controls for positioning work. Those
controls are not present in the participant-facing encoding player.

---

## Runtime Plan and Trigger Schedule

The current runtime uses editable material/runtime files rather than the old
per-block generated timelines.

| File | Purpose |
|------|---------|
| `backend/data/experiment_materials/counterbalancing.json` | Conditions, task orders, trigger schedule, session-end delay |
| `backend/data/runtime_plans/main_experiment.json` | PM, cooking, robot-comment, and phone-message lanes for the admin runtime plan editor |
| `backend/engine/runtime_plan_loader.py` | Loads and validates runtime plans |
| `backend/engine/pm_session.py` | Runs event-driven PM trigger schedule |

### Trigger Schedule

| Entry | Type | Delay after previous pipeline | Notes |
|-------|------|-------------------------------|-------|
| 1 | real | 180s after game start | Task at position 1 in participant order |
| 2 | fake doorbell | 120s | Doorbell fake trigger |
| 3 | real | 60s | Task at position 2 |
| 4 | real | 120s | Task at position 3 |
| 5 | fake phone call | 60s | Phone fake trigger |
| 6 | real | 60s | Task at position 4 |
| end | session end | 60s | Transition to post-test |

---

## PM Task Registry (`backend/engine/pm_tasks.py`)

Four PM tasks (`T1`-`T4`) are defined through experiment material files and
runtime helpers. Each task includes trigger type, person/contact, target item,
decoys, assignment text, reminder variants, and encounter metadata.

---

## Data Directory Structure (`backend/data/`)

```
data/
├── experiment_materials/
│   ├── counterbalancing.json
│   ├── encoding_materials.json
│   ├── pm_tasks.json
│   ├── questionnaires.json
│   ├── static_text.json
│   └── tutorial_materials.json
├── messages/
│   └── messages_day1.json
├── runtime_plans/
│   └── main_experiment.json
├── cooking_recipes.py
├── cooking_timeline.py
└── materials.py
```

### Phone Message Format (`messages_day1.json`)
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
| Engine | `postgresql+asyncpg` | Async PostgreSQL driver |
| `pool_size` | `5` | Connection pool size |
| `max_overflow` | `10` | Extra connections beyond pool_size |
| `expire_on_commit` | `False` | Objects accessible after commit |
| Auto-seed | On startup if `DEV_TOKEN` set | Creates/resets dev participant |

### Docker Setup

```bash
cp .env.example .env          # adjust credentials if needed
docker compose up -d           # starts PostgreSQL 16 on port 5432
```

| Env Var | Default | Description |
|---------|---------|-------------|
| `POSTGRES_DB` | `cooking_for_friends` | Database name |
| `POSTGRES_USER` | `cff` | Database user |
| `POSTGRES_PASSWORD` | `cff_dev_pass` | Database password |
| `POSTGRES_PORT` | `5432` | Host port mapping |
| `DATABASE_URL` | `postgresql+asyncpg://cff:cff_dev_pass@localhost:5432/cooking_for_friends` | Full connection URL |
