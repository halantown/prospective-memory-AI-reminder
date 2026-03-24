# Saturday At Home — WebSocket 技术文档

本文档描述 `SaturdayAtHome` 当前实时通信架构（WebSocket），以及与 session 在线状态/服务端计时器的联动。

## 1. 总览

- 参与者事件流：`WS /api/session/{session_id}/block/{block_num}/stream`
- 管理端事件流：`WS /api/admin/stream`
- 后端推送枢纽：`backend/core/ws.py`
- 调度引擎：`backend/core/timeline.py`
- 前端订阅：
  - 游戏端：`frontend/src/hooks/useWebSocket.js`
  - Dashboard：`frontend/src/components/Dashboard.jsx`

## 2. 消息格式

服务端统一发送 JSON：

```json
{
  "event": "steak_spawn",
  "data": { "hob_id": 0, "duration": { "cooking": 13000, "ready": 4000 } },
  "ts": 1773500000.123
}
```

空闲 keepalive：

```json
{ "event": "keepalive", "data": {}, "ts": 1773500000.123 }
```

## 3. 事件来源

### 3.1 时间线自动事件

`BlockTimeline.run()` 按 `game_config.yaml -> timeline` 调度并推送：

- `steak_spawn`
- `message_bubble`
- `trigger_appear` / `window_close`
- `reminder_fire`
- `robot_neutral`
- `force_yellow_steak`
- `fake_trigger_fire`
- `plant_needs_water`
- `block_end`

### 3.2 Dashboard 手动事件

Dashboard 通过 `POST /api/admin/fire-event` 注入事件，后端转发至指定 session 的 WS 客户端。

## 4. session 在线状态与计时器

计时器由服务端持久化到 `sessions` 表：

- `timer_started_at`: 首次开始实验时间
- `timer_running_since`: 当前运行段开始时间（暂停时为 `NULL`）
- `timer_elapsed_s`: 已累计秒数
- `is_online`: 参与者在线状态

计时规则：

1. `session/start` 首次进入实验时初始化计时（开始累计）。
2. 参与者 WS 连接建立：标记 `is_online=1`，若计时暂停则恢复。
3. 参与者 WS 断开：将本段时长累加进 `timer_elapsed_s`，并暂停（`timer_running_since=NULL`）。
4. Dashboard/观察者连接使用 `client=dashboard`，不影响参与者计时。
5. 服务重启时会执行一次全量暂停，避免“幽灵在线”导致计时持续增长。

Dashboard 状态接口：

- `GET /api/admin/session/{session_id}/state`
  - `is_online`
  - `session_timer_s`（实时累计秒）
  - `timer_started_at`
  - `ws_clients`

## 5. 关键实现文件

- `backend/core/ws.py`: WS 队列注册、广播、keepalive、关闭
- `backend/routes/session.py`: 参与者 WS 路由、timeline 启动、在线计时联动
- `backend/routes/admin.py`: Dashboard WS 路由、session state
- `backend/core/session_lifecycle.py`: 在线标记、计时累计、重启时暂停逻辑
- `frontend/src/hooks/useWebSocket.js`: 游戏端 WS 客户端
- `frontend/src/components/Dashboard.jsx`: Dashboard WS 客户端与计时展示

## 6. 故障排查

### 6.1 只有 heartbeat，没有时间线事件

优先检查：

- `backend/core/timeline.py::_update_actual_t` 是否使用兼容 SQLite 的子查询更新写法
- 当前 session 是否存在活动 timeline（`/api/admin/session/{id}/state` 的 `active_timelines`）

### 6.2 Dashboard 注入 `steak_spawn` 不生效

检查目标 hob 是否仍非 `empty`。后端会在推送前 reconcile 状态，只有空锅才允许新的 `steak_spawn`。

### 6.3 Ctrl+C 关闭服务很慢

原因：Uvicorn 会先执行优雅关闭，等待活跃 WS/background task 结束。

当前配置与优化：

- `main.py` 设置 `timeout_graceful_shutdown=5`
- WS pump 与 admin stream 空闲轮询超时缩短为 5 秒，减少关闭等待窗口

如仍需立刻退出，可再次按 `Ctrl+C` 强制终止。
