# High-Precision Timing System

## Overview
The system now records **dual timestamps** for precise reaction time analysis:

1. **client_timestamp** (ISO format): Human-readable absolute time
   - Example: `2026-01-31T13:15:42.123Z`
   - Precision: ~1 millisecond
   - Use: Correlating events with real-world time

2. **client_time_ms** (performance.now()): High-precision relative time
   - Example: `12345.678` (milliseconds since session start)
   - Precision: **Sub-millisecond (microseconds)**
   - Use: Calculating precise reaction times and durations

## CSV Log Format
```csv
server_timestamp,client_timestamp,client_time_ms,event_type,details,metadata
2026-01-31T13:15:42.123,2026-01-31T13:15:42.120,0.000,game_start,"{""map_id"":""day1""}",{...}
2026-01-31T13:15:45.234,2026-01-31T13:15:45.231,3111.234,dice_roll_start,"",{}
2026-01-31T13:15:46.345,2026-01-31T13:15:46.342,4222.456,dice_roll_result,"{""result"":3}",{...}
```

## Calculating Reaction Times

### Example: Dice Roll Reaction Time
```python
import pandas as pd

# Load log file
df = pd.read_csv('participant_S1_20260131_131542.csv')

# Find dice roll events
roll_start = df[df['event_type'] == 'dice_roll_start']['client_time_ms'].values[0]
roll_result = df[df['event_type'] == 'dice_roll_result']['client_time_ms'].values[0]

# Calculate precise reaction time
reaction_time_ms = roll_result - roll_start
print(f"Reaction time: {reaction_time_ms:.3f} ms")
```

### Example: Event Card Response Time
```python
# Time from event displayed to button clicked
event_show = df[df['event_type'] == 'event_trigger']['client_time_ms'].values[0]
event_close = df[df['event_type'] == 'event_closed']['client_time_ms'].values[0]

response_time = event_close - event_show
print(f"Event card response time: {response_time:.3f} ms")
```

## Key Benefits

1. **Microsecond Precision**: `performance.now()` provides ~5 microsecond precision (vs ~1ms for Date)
2. **Monotonic Clock**: Not affected by system clock adjustments
3. **Session-Relative**: All times measured from session start (easier calculations)
4. **Network-Independent**: Timing recorded client-side before sending to server

## Implementation Details

### Frontend (main.html)
- `sessionStartTime`: Records `performance.now()` when game starts
- `sessionStartISO`: Records `Date.toISOString()` when game starts
- `logAction()`: Sends both timestamps with every event

### Backend (app.py)
- CSV header includes `client_time_ms` column
- No processing needed - just stores the value

## Common Event Types for Timing Analysis

| Event Type | Description | Typical Use |
|------------|-------------|-------------|
| `dice_roll_start` | User clicks dice | Response initiation |
| `dice_roll_result` | Dice animation complete | Total interaction time |
| `event_trigger` | Event card displayed | Stimulus presentation |
| `event_closed` | Event card dismissed | Stimulus response time |
| `minigame_start` | Minigame task begins | Task onset |
| `minigame_complete` | Task finished | Task completion time |
| `event_choice_selected` | Decision made | Choice reaction time |

## Notes

- **Always use `client_time_ms` for duration calculations** (more precise)
- Use `client_timestamp` for correlating with external systems
- `server_timestamp` shows when backend received the log (includes network latency)
- Network latency does NOT affect timing precision (all calculations done client-side)
