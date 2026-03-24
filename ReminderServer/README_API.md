# Virtual Week System API Documentation

## Overview
- **ReminderServer**: Python 3 (FastAPI) - Backend Logic & Game State. Port: 8000
- **RobotServer**: Python 2.7 (SimpleHTTPServer) - Pepper Interface. Port: 8001
- **Frontend**: HTML/JS (Vue 3) - User Interface.

## ReminderServer API (Port 8000)

### 1. Initialize Game
`GET /api/config/init`
Returns map configuration and event data.
**Response**:
```json
{
  "map_size": 120,
  "event_positions": { "32": "evt_shopping" },
  "events": { 
      "evt_shopping": { "id": "evt_shopping", "name": "Shopping", "js_component": "SupermarketGame.js", ... } 
  }
}
```

### 2. Roll Dice
`POST /api/game/roll`
**Response**:
```json
{
  "roll": 4,
  "timestamp": 1700000000.0
}
```

### 3. Log Position / Trigger Check
`POST /api/game/log_position`
Called when token lands on a cell.
**Request**:
```json
{
  "player_pos": 32,
  "cell_type": "Event",
  "timestamp": 1700000000.0,
  "meta_info": "Debug Info"
}
```
**Response**:
```json
{
  "triggered": true,
  "event_id": "evt_shopping",
  "event_data": { ... },
  "robot_message": "Reached Shopping..."
}
```

## RobotServer API (Port 8001)

### 1. Robot Speak
`POST /`
**Request**:
```json
{
    "action": "say", 
    "payload": { "text": "Hello User" }
}
```

### 2. Show Tablet
`POST /`
**Request**:
```json
{
    "action": "show_view", 
    "payload": { "url": "http://..." }
}
```
