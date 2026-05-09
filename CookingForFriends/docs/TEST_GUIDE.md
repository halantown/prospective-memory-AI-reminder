# CookingForFriends — Test Guide

## Quick Start

### 1. Start Backend
```bash
conda activate thesis_server
cd CookingForFriends/backend
python main.py
```
Backend runs on **http://localhost:5000**

### 2. Start Frontend (Development)
```bash
cd CookingForFriends/frontend
npm run dev
```
Frontend runs on **http://localhost:3000** (proxies API to :5000)

### 3. Login with a Test Token
- Navigate to **http://localhost:3000**
- Enter a token created in the Admin dashboard, or set `DEV_TOKEN=ABC123` before backend startup and use **`ABC123`**
- Click "Start Session"

## Test Account Details

The current assignment design is:

- Condition: `EE1` or `EE0`
- Latin-square order: `A`, `B`, `C`, or `D`
- Four PM tasks per participant (`T1`-`T4`)

Admin Test Mode can create sessions with an explicit condition, task order, and
start phase without affecting round-robin counts.

## Test Flow

1. **Welcome Page** (`/`)
   - Enter token `ABC123`
   - Verify login succeeds

2. **Encoding / Tutorial Flow**
   - Watch encoding cutscene material
   - Complete detail and intention checks
   - Continue through phone/cooking/trigger tutorial phases

3. **Main Experiment**
   - Floor plan: Kitchen, Dining Room, Living Room, Study, Bathroom/Balcony, Hallway
   - Click rooms to navigate
   - Complete cooking steps when the Cooking Indicator appears
   - Watch for robot speech (avatar speech bubble)

4. **PM Trigger** (triggered during game)
   - Doorbell or phone-call affordance appears
   - Complete click-to-advance encounter dialogue
   - Real PM trigger: robot reminder → item selection → confidence → avatar auto-action
   - Fake trigger: direct request → single action

5. **Post-Test and Debrief**
   - Complete post-test questionnaires
   - Continue to debrief and completion

## Admin Dashboard

Navigate to **http://localhost:3000/admin** to:
- View participant list
- Create new participants (generates random tokens)
- Monitor live experiment status

## Creating Additional Test Participants

### Via Admin Dashboard
1. Go to http://localhost:3000/admin
2. Click "Create Participant"
3. System generates unique token automatically

### Via API

Set `X-Admin-Key` to `ADMIN_API_KEY` from `.env`.

```bash
curl -X POST http://localhost:5000/api/admin/participant/create \
  -H "X-Admin-Key: admin_secret" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Create an explicit test session:

```bash
curl -X POST http://localhost:5000/api/admin/test-session \
  -H "X-Admin-Key: admin_secret" \
  -H "Content-Type: application/json" \
  -d '{"condition":"EE1","order":"A","start_phase":"MAIN_EXPERIMENT"}'
```

## Browser Devtools

### Check WebSocket Communication
1. Open DevTools (F12)
2. Go to **Network** tab
3. Filter by "WS" (WebSocket)
4. Click on `/ws/game/...` connection
5. View **Messages** tab to see real-time events:
   - `block_start` — game begins
   - `time_tick` — clock update
   - `robot_speak` — robot utterance
   - `pm_trigger` — PM reminder fired
   - `phone_notification` — phone alert

### Check Console Logs
- Frontend logs all WebSocket events with `[WS]` prefix
- Backend logs to console with timestamps

## Known Issues / Limitations

- **Reminders are placeholders** — all robot speech uses placeholder text (agent system pending)
- **No sound** — robot doesn't speak audio yet
- **No persistence across tabs** — session only in current browser tab
- **No animations** — basic CSS/Framer Motion (not polished)
- **Cooking feedback visible** — active steps use the Kitchen Timer banner; missed steps flash red, and station choices flash green/red before advancing
- **PM scoring hidden** — all PM attempts scored server-side but not shown to participant

## API Endpoints (for testing)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/session/start` | POST | Login with token |
| `/api/session/{id}/block/{n}/encoding` | GET | Get PM task data |
| `/api/session/{id}/status` | GET | Current session state |
| `/api/admin/participant/create` | POST | Create test participant |
| `/api/admin/participants` | GET | List all participants |
| `/api/admin/experiment/overview` | GET | Stats (participants, blocks completed) |

## Debugging

### Backend Errors
- Ensure PostgreSQL container is running: `docker compose up -d`
- Verify `conda activate thesis_server` is active
- Check port 5000 is free (or edit config.py)

### Frontend Not Connecting
- Verify `/api` proxy works: `curl http://localhost:3000/api/health`
- Check backend is running on port 5000
- Browser console should show `[WS] Connecting: ws://localhost:3000/ws/game/...`

### WebSocket Connection Refused
- Ensure backend running (not just frontend dev server)
- Check firewall/network allows WebSocket
- Try direct connection: `wscat -c ws://localhost:5000/ws/game/SESSION_ID/1`
