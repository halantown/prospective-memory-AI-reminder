# Saturday At Home — SSE 技术文档

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
