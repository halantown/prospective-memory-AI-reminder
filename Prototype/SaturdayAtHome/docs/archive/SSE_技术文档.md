# Saturday At Home — SSE 技术文档（历史版本）

> ⚠️ 本文档主要描述旧版 SSE 架构，现已迁移为 WebSocket。
>
> 当前实时通道：
> - 参与者/观察端事件流：`WS /api/session/{id}/block/{n}/stream`
> - 管理端生命周期流：`WS /api/admin/stream`
>
> 事件语义（`steak_spawn`、`reminder_fire` 等）保持不变，仅传输协议由 SSE 改为 WebSocket。

## 故障记录（2026-03-14）

### 现象
- 前端仅持续发送 heartbeat，收不到时间线事件（提醒/触发/消息等）。

### 根因
- `backend/core/timeline.py::_update_actual_t` 使用了 `UPDATE ... ORDER BY ... LIMIT`。
- 当前环境 SQLite 构建不支持该语法，导致 `BlockTimeline.run()` 在首个事件后异常终止。

### 修复
- 将更新语句改为 SQLite 兼容写法：`WHERE id = (SELECT ... ORDER BY id LIMIT 1)`。
- 同时在 session stream 连接时，若 `active_timelines` 中已有同 key 且 task 已完成/异常结束，自动清理并允许重启 timeline。

## 1. 系统架构总览

```
┌─────────────────────┐         ┌──────────────────────────┐
│   前端 (React)       │         │   后端 (FastAPI/Python)    │
│   localhost:3000     │         │   localhost:5000          │
│                     │         │                          │
│  WelcomeScreen      │──POST──→│  /session/start           │
│    输入被试ID         │←─JSON──│  返回 session_id, group   │
│                     │         │                          │
│  EncodingScreen     │         │                          │
│    任务卡 + 测验     │         │                          │
│                     │         │                          │
│  GameShell          │         │                          │
│   ├─ useSSE() ──────│──SSE───→│  /session/{id}/block/{n}/ │
│   │  EventSource    │←─事件流──│  stream                  │
│   │                 │         │   └─ BlockTimeline        │
│   ├─ KitchenCard    │         │       按时间表发送事件      │
│   │  点击翻面/出锅   │──POST──→│  /steak-action            │
│   │                 │←─JSON──│   验证状态 → 记录日志       │
│   │                 │         │   → 调度重生              │
│   ├─ PmOverlay      │         │                          │
│   │  点击确认/不确定  │──POST──→│  /action                  │
│   │                 │←─JSON──│   评分 → 记录日志          │
│   └─ Dashboard      │         │                          │
│      /dashboard     │──POST──→│  /admin/fire-event        │
│      管理面板        │←─SSE───│   手动触发事件             │
└─────────────────────┘         └──────────────────────────┘
            │                              │
            │  Vite Proxy (/api → :5000)   │
            └──────────────────────────────┘
```

## 2. 连接流程（按时间顺序）

### 第一步：创建会话
```
前端 WelcomeScreen
  → POST /api/session/start { participant_id: "P001" }
  ← { session_id: "abc123", group: "B", condition_order: [...] }
  → Zustand store: sessionId = "abc123"
```

### 第二步：编码阶段
- 前端显示任务卡和测验（纯本地，不与后端通信）
- 通过测验后：`blockRunning = true`

### 第三步：SSE 自动连接
```
useSSE() hook 检测到 sessionId + blockNumber + blockRunning 都有值
  → new EventSource("/api/session/abc123/block/1/stream")
  → Vite 代理转发到 localhost:5000/session/abc123/block/1/stream
  → 后端创建 asyncio.Queue，加入 sse_queues["abc123"]
  → 后端创建 BlockTimeline，开始按时间表发送事件
  → 返回 StreamingResponse (text/event-stream)
```

### 第四步：事件流
```
后端 BlockTimeline 按时间表触发：
  t=3s   → steak_spawn { hob_id: 0 }
  t=23s  → steak_spawn { hob_id: 1 }
  t=35s  → fake_trigger_fire { type: "delivery" }
  t=55s  → message_bubble { text: "Hey!..." }
  t=75s  → robot_neutral { text: "Smells good!" }
  ...每20-35秒 → steak_spawn（轮流分配到3口锅）
  t=120s → reminder_fire { text: "记得吃药..." }
  t=210s → trigger_appear { task_id: "medicine_a" }
  t=510s → block_end

每个事件通过 asyncio.Queue → SSE 流 → 前端 EventSource
前端 useSSE 根据事件类型调用对应的 Zustand action
```

### 第五步：玩家操作
```
用户在前端点击"翻面"按钮：
  1. 前端立即更新本地状态（乐观更新）
     hob.status: READY → COOKING, score += 5
  2. 前端 POST /api/session/abc123/block/1/steak-action
     { hob_id: 0, action: "flip" }
  3. 后端验证：reconcile_hob() 先同步时间状态
     确认 hob 确实是 READY → 执行翻面
  4. 后端记录到 SQLite (action_logs + ongoing_snapshots)
  5. 返回 { status: "ok", score: 5 }

用户出锅后：
  → 后端 _schedule_respawn() 等待 15-25秒
  → 发送 steak_spawn SSE → 前端收到 → 新牛排出现
```

## 3. 关键数据流

### 谁控制什么？

| 功能 | 控制方 | 说明 |
|------|--------|------|
| **牛排生成** | ✅ 后端 | BlockTimeline 按时间表发送 steak_spawn SSE |
| **牛排状态转换** (cooking→ready→burning) | ✅ 前端 | 500ms setInterval 检查 elapsed time |
| **牛排状态同步** | ✅ 后端 | reconcile_hob() 在验证操作前根据时间同步 |
| **翻面/出锅/清理** | ✅ 双方 | 前端乐观更新 + POST 到后端验证 |
| **牛排重生** | ✅ 后端 | 出锅/清理后 15-25s 通过 SSE 发送新的 steak_spawn |
| **PM 任务出现** | ✅ 后端 | trigger_appear SSE 事件 |
| **PM 任务提交** | ✅ 双方 | 前端 POST /action → 后端评分记录 |
| **消息气泡** | ✅ 后端 | message_bubble SSE 事件 |
| **Block 结束** | ✅ 后端 | block_end SSE → 前端显示结束界面 |

### 数据存储

| 数据 | 存储位置 |
|------|----------|
| 会话信息 | SQLite `sessions` 表 |
| PM 试验结果 | SQLite `pm_trials` 表 |
| 所有操作日志 | SQLite `action_logs` 表 |
| 持续得分快照 | SQLite `ongoing_snapshots` 表 |
| 当前 Hob 状态 | 后端内存 `session_hobs` dict |
| SSE 连接 | 后端内存 `sse_queues` dict |
| 前端游戏状态 | Zustand store（浏览器内存） |

## 4. SSE 事件类型一览

| 事件名 | 方向 | 触发来源 | 前端处理 |
|--------|------|----------|----------|
| `steak_spawn` | 后端→前端 | Timeline / respawn | `spawnSteak(hob_id)` |
| `force_yellow_steak` | 后端→前端 | Timeline | `forceYellowSteak(hob_id)` |
| `trigger_appear` | 后端→前端 | Timeline | `triggerAppear(task_id)` → Report按钮出现 |
| `window_close` | 后端→前端 | Timeline | `windowClose(task_id)` → 按钮消失 |
| `reminder_fire` | 后端→前端 | Timeline | `triggerRobot(text)` → 机器人说话 |
| `robot_neutral` | 后端→前端 | Timeline | `triggerRobot(text)` → 机器人说话 |
| `fake_trigger_fire` | 后端→前端 | Timeline | `triggerFake(type)` → 假触发事件 |
| `message_bubble` | 后端→前端 | Timeline | `addMessageBubble(data)` → 消息气泡 |
| `block_start` | 后端→前端 | Timeline | console.log |
| `block_end` | 后端→前端 | Timeline | `endBlock()` → 显示结束界面 |
| `keepalive` | 后端→前端 | 30s定时 | 忽略（保持连接） |

## 5. Vite 代理配置

前端开发服务器 (localhost:3000) 代理所有 `/api/*` 请求到后端 (localhost:5000):

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    }
  }
}
```

- 前端 fetch `/api/session/start` → 代理到 `http://localhost:5000/session/start`
- 前端 EventSource `/api/session/.../stream` → 代理到 `http://localhost:5000/session/.../stream`
- SSE 长连接通过代理正常工作（已测试验证）

## 6. Dashboard 与游戏的关系

Dashboard (`/dashboard`) 是**实验者管理工具**，与游戏页面 (`/`) 独立运行：
- Dashboard 通过 `/admin/fire-event` 手动发送 SSE 事件
- 这些事件进入同一个 `sse_queues[session_id]`
- 如果游戏页面也连着同一个 session 的 SSE，它会收到这些事件
- Dashboard 自己也可以连 SSE 来观察事件流

**它们共享同一个后端和同一个 SSE 队列系统。**

## 7. 服务端关闭行为（已知特性）

### 现象

用 Ctrl+C 停止服务端后，进程有时不会立刻退出，需要等到用户关闭前端浏览器页面才结束。

### 根本原因

SSE 连接本质是一个长生命周期的 HTTP 请求（HTTP chunked streaming）。服务端关闭时序如下：

```
Ctrl+C
  → lifespan shutdown: cancel timelines + shutdown_all_queues()
      ↓ _shutting_down = True，_SHUTDOWN 哨兵推入所有 queue
  → event_generator 收到哨兵 → 退出 while 循环 → generator 耗尽
  → Starlette 完成 StreamingResponse 写入（HTTP 层面"响应结束"）
  → uvicorn 等待所有 TCP 连接在传输层关闭
      ↓ 问题在这里
  → 浏览器 EventSource 仍持有 TCP 连接（尚未关闭）
  → uvicorn --reload 模式下 graceful shutdown 没有超时上限
  → 进程挂起，直到浏览器关页面（EventSource 断开 → TCP 关闭）
```

关键区别：
- HTTP 响应在逻辑上已完成（generator 耗尽）
- 但 TCP 连接仍处于 CLOSE_WAIT / 半关闭状态，浏览器侧未发 FIN
- uvicorn 在等 TCP 连接数归零，导致进程挂起

### 影响范围

- **不影响实验数据**：所有 SQLite 写入在 shutdown 前已完成
- **不影响实验逻辑**：`block_end` 事件、PM 评分、操作日志均不受影响
- **仅影响**：开发调试时的操作体验

### 绕过方法

1. **正常停止**：先在浏览器关闭 `/` 游戏页面（断开 EventSource），再 Ctrl+C
2. **强制退出**：连续按两次 Ctrl+C（uvicorn 在第二次 SIGINT 时强制退出）
3. **配置超时**（可选）：在 `main.py` 中为 uvicorn 设置 graceful shutdown 超时：
   ```python
   uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True,
               timeout_graceful_shutdown=5)  # 最多等 5 秒后强制退出
   ```
