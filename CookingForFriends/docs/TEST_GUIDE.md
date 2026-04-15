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

### 3. Login with Test Token
- Navigate to **http://localhost:3000**
- Enter token: **`ABC123`**
- Click "Start Session"

## Test Account Details
- **Token**: `ABC123`
- **Participant ID**: `P002`
- **Group**: `B` (Latin Square)
- **Condition Order**: AF → AFCB → CONTROL

## Test Flow

1. **Welcome Page** (`/`)
   - Enter token `ABC123`
   - Verify login succeeds

2. **Encoding Page** (`/encoding`)
   - View 4 PM task cards
   - Cards show: trigger, target room, target description, action
   - Click "Ready" after rehearsal

3. **Game Page** (`/game`)
   - 5-room panorama: Kitchen → Dining → Living → Study → Balcony
   - Click rooms to navigate
   - Kitchen: 3 pans cooking (timers count down)
   - Watch for robot speech (avatar speech bubble)

4. **PM Trigger** (triggered during game)
   - Pink notification appears: "Remember to [do X]!"
   - Click on target room (e.g., "Living Room")
   - Click on target object (e.g., red book)
   - Select action (e.g., "Give to friend")
   - Hidden scoring happens server-side (0-6)

5. **Micro-Break**
   - Not shown in the single-session flow (UI skips the rest page and proceeds to the next phase)

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

### Via CLI
```bash
cd CookingForFriends/backend
python -c "
import sys, asyncio
sys.path.insert(0, '.')
async def create():
    from database import init_db, async_session
    from models.experiment import Experiment, ExperimentStatus, Participant, ParticipantStatus
    from engine.condition_assigner import assign_group, get_condition_order, generate_token
    import uuid
    
    await init_db()
    async with async_session() as db:
        exp = (await db.execute(__import__('sqlalchemy').select(Experiment))).scalars().first()
        if not exp:
            exp = Experiment(name='Test', status=ExperimentStatus.ACTIVE)
            db.add(exp)
            await db.flush()
        
        pid = str(uuid.uuid4())[:8]
        group = await assign_group(db)
        token = await generate_token(db)
        
        p = Participant(
            id=pid, experiment_id=exp.id, participant_id=f'P{len([(await db.execute(__import__('sqlalchemy').select(Participant))).scalars().all()]) + 1:03d}',
            token=token, latin_square_group=group, condition_order=get_condition_order(group),
            status=ParticipantStatus.REGISTERED,
        )
        db.add(p)
        await db.commit()
        print(f'Token: {token}')

asyncio.run(create())
"
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
- **Kitchen timers visual only** — no actual cooking mechanics scoring yet
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
