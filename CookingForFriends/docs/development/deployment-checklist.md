# Deployment & Experiment Running Checklist

## Pre-deployment

### 1. Environment configuration

- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Set `POSTGRES_PASSWORD` to a strong random password
- [ ] Set `DATABASE_URL` with the same password and correct host
- [ ] Set `ADMIN_API_KEY` to a long random secret (32+ characters)
- [ ] Set `CORS_ORIGINS` to the exact frontend/admin origins (no wildcards)
- [ ] Verify `ENVIRONMENT=production`
- [ ] Verify no placeholder values remain (`<replace-with-...>`)

The backend will refuse to start if any of these checks fail in production mode.

### 2. Experiment materials review

- [ ] Run `pytest tests/ -v` — all tests must pass
- [ ] Verify PM task reminders: EE0 gives no episodic detail, EE1 gives episodic anchor
- [ ] Verify no reminder text contains the target item name
- [ ] Verify trigger schedule: 4 real + 2 fake, correct ordering
- [ ] Verify Latin-square counterbalancing: 4 orders, each task at each position
- [ ] Review `pm_tasks.json` — all greeting lines, reminders, decoy items present and sensible
- [ ] Review `cooking_recipes.py` — all dish steps have correct options and stations
- [ ] Review `message_pool_block1.json` — all phone chat messages have correct answers

### 3. Build frontend

```bash
cd CookingForFriends/frontend
npm ci
npm run build
```

Verify `frontend/dist/` is produced. The backend serves it as static files.

### 4. Database setup

```bash
# Start PostgreSQL
docker compose up -d db

# Wait for healthy
docker compose ps  # db should show "healthy"

# Start backend (creates tables on first run)
cd CookingForFriends/backend
ENVIRONMENT=production python main.py
```

Tables are created via `Base.metadata.create_all()` + `_patch_pm_schema()` on startup. No Alembic migrations.

### 5. Smoke test

- [ ] Backend health: `curl https://<host>/api/health` → `{"status":"ok"}`
- [ ] Admin access: `curl -H "X-Admin-Key: <key>" https://<host>/api/admin/experiment/overview`
- [ ] Create test participant: POST `/api/admin/test-session` with `{"condition":"EE1","order":"A","start_phase":"MAIN_EXPERIMENT"}`
- [ ] Login with test token in browser
- [ ] Verify WebSocket connects: browser console shows `[WS] Connected`
- [ ] Complete a full PM trigger cycle: greeting → reminder → item selection → confidence → auto-execute
- [ ] Verify data export: GET `/api/admin/export/full` → ZIP contains all CSV files

---

## Running an experiment session

### Before each participant

- [ ] Verify backend is running and WebSocket responsive
- [ ] Verify PostgreSQL is running and accepting connections
- [ ] Create a fresh participant via admin dashboard or API
- [ ] Record the generated token and assigned condition/order
- [ ] Ensure the experiment room setup is ready (browser, display, instructions)

### During the session

- Monitor the admin dashboard for live session status
- Admin monitor WebSocket (`/ws/monitor`) shows real-time events
- If participant disconnects: they have 30 seconds to reconnect (grace period)
- If WebSocket reconnects: game state is restored from backend snapshot

### After each participant

- [ ] Verify session reached COMPLETED phase in admin dashboard
- [ ] Export data and spot-check the participant's rows in CSV files
- [ ] Note any anomalies (disconnects, unusual timing, missing data)

---

## Data export

### Full export

```bash
curl -H "X-Admin-Key: <key>" \
  "https://<host>/api/admin/export/full" \
  -o cooking_for_friends_export.zip
```

### Export contents

| File | Description |
|------|-------------|
| `pm_events.csv` | PM trigger outcomes (DV: hit rate, RT, confidence) |
| `cooking_steps.csv` | Per-step cooking task performance |
| `cooking_dish_scores.csv` | Per-dish aggregate scores |
| `phone_messages.csv` | Chat task responses |
| `cutscene_events.csv` | Encoding episode viewing times |
| `intention_checks.csv` | Post-encoding comprehension |
| `phase_history.csv` | Phase transition timestamps |
| `experiment_responses.csv` | Questionnaire/survey responses |
| `room_navigation.csv` | Room switch events |
| `recipe_views.csv` | Recipe viewer usage |
| `interaction_logs.csv` | All raw interaction events |
| `event_log.csv` | Unified chronological timeline |
| `mouse_tracking/*.json` | Per-participant mouse tracking |

See [data-dictionary.md](data-dictionary.md) for full field definitions.

### Per-participant export

```bash
curl -H "X-Admin-Key: <key>" \
  "https://<host>/api/admin/export/per-participant"
```

Returns a CSV with one row per PM trigger (real + fake) per participant.

### Quick data validation checks

After collecting data from N participants:

```python
import pandas as pd

pm = pd.read_csv("pm_events.csv")

# Check every participant has 4 real + 2 fake triggers
triggers_per_participant = pm.groupby("participant_id")["is_fake"].value_counts().unstack(fill_value=0)
assert (triggers_per_participant[False] == 4).all(), "Missing real triggers"
assert (triggers_per_participant[True] == 2).all(), "Missing fake triggers"

# Check real triggers have item selection data
real = pm[pm["is_fake"] == False]
assert real["item_selected"].notna().all(), "Missing item selection"
assert real["confidence_rating"].notna().all(), "Missing confidence"

# Check condition balance
print(pm.groupby("condition")["participant_id"].nunique())
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Backend won't start | Check `.env.production` for placeholder values |
| 401 on admin endpoints | Verify `X-Admin-Key` header matches `ADMIN_API_KEY` |
| WebSocket refused | Backend must be running; check firewall allows WS upgrade |
| Participant stuck on loading | Check browser console for WS errors; verify session token |
| Game clock frozen | May be paused for PM pipeline; check admin monitor for active PM |
| Missing CSV columns | Ensure backend version includes all export fixes (Task 9) |
| Participant offline in admin | Heartbeat timeout (60s); may be network issue |
| Reconnect fails | Grace period is 30s; beyond that, session may need restart |

---

## Production security notes

- Admin API key comparison uses `hmac.compare_digest()` (timing-safe)
- WebSocket monitor key is in query params (visible in access logs — use HTTPS)
- No WebSocket rate limiting (acceptable for single-participant lab use)
- Session tokens are 6-char alphanumeric, rate-limited to 10 attempts/60s per IP
- CORS is enforced; ensure origins match exactly
