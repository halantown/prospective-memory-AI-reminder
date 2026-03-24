# 开发 Prompt v3：Cooking for Friends 实验平台

> **使用说明：** 将此 prompt 连同 `experiment_plan_v3.md` 一起提供给 AI 编程助手。分阶段执行。

---

## 项目概述

开发浏览器端 2D 交互实验平台 **"Cooking for Friends"**，用于心理学前瞻记忆（Prospective Memory）实验。被试在虚拟家庭环境中执行日常家务任务，同时需要在特定事件触发时执行预先编码的 PM 任务。虚拟机器人助手会在部分条件下发出语音提醒。

**学术实验工具，非商业游戏。** 优先级：数据采集可靠性 > 视觉美观 > 功能丰富度。

---

## 实验设计概要（开发必读）

**单因素三水平被试内设计：**

```
Layer 0 — Control:  无提醒（纯基线）
Layer 1 — AF:       高联想保真度提醒（具体感知线索，不引用当前活动）
Layer 2 — AF+CB:    AF + 情境桥接（以当前活动为切入点引出提醒）
```

- **3 个 block**，每 block 对应一天（"连续三天为不同朋友准备晚餐"）
- 每 block ~10 分钟，4 个 PM 任务
- AF / AF+CB block 中：3 个有提醒 + 1 个无提醒（混淆用）
- Control block：4 个全部无提醒
- Latin Square counterbalancing 条件顺序
- PM 评分 0-6 分（后端自动判定）
- **所有 reminder message 当前用占位符，后续接 agent 系统**

---

## 叙事背景

被试扮演居家成年人，**连续三天** 为不同朋友准备晚餐聚会。每天有不同菜谱、不同客人、不同家务。三天对应三个实验条件。

---

## 技术栈

```
后端：  Python 3.11+ / FastAPI / MySQL / SQLAlchemy (async)
前端：  React 18 + Vite / TypeScript / Tailwind CSS / Zustand / Framer Motion
通信：  WebSocket（双向：后端推送事件 + 前端上报交互）
音频：  Howler.js（BGM/音效）+ 预录音频（机器人语音）
管理后台：同一前端项目，/admin/* 路由
```

---

## 核心架构

```
[管理员后台] ←→ [后端 REST API] ←→ [MySQL]
                      │
                      │ WebSocket
                      ↕
              [前端游戏客户端]
                      │
                      ├─→ WorldView（家庭全景 + 房间激活/降暗）
                      ├─→ PhoneSidebar（手机侧边栏）
                      ├─→ RobotController（位置/动画/语音）
                      ├─→ PM Monitor（静默监控）
                      └─→ HUD（时钟/积分）
```

### WebSocket 消息协议

```typescript
// 后端 → 前端
type ServerMessage =
  | { type: "block_start"; data: BlockConfig }
  | { type: "time_tick"; data: { elapsed: number; game_clock: string } }
  | { type: "ongoing_task_event"; data: { task: string; event: string; payload: any } }
  | { type: "robot_move"; data: { to_room: string } }
  | { type: "robot_speak"; data: { utterance: string; audio_url?: string } }
  //   注意：不含 is_reminder 字段！前端不区分提醒和闲聊
  | { type: "pm_trigger"; data: { trigger_id: string; trigger_event: string } }
  | { type: "phone_notification"; data: { sender: string; preview: string; is_ad: boolean } }
  | { type: "phone_lock" }
  | { type: "block_end" }
  | { type: "force_sync"; data: GameStateSnapshot }

// 前端 → 后端
type ClientMessage =
  | { type: "room_switch"; data: { from: string; to: string; timestamp: number } }
  | { type: "task_action"; data: { task: string; action: string; payload: any; timestamp: number } }
  | { type: "pm_attempt"; data: { action: string; target_selected?: string; room: string; timestamp: number } }
  | { type: "phone_unlock"; data: { timestamp: number } }
  | { type: "phone_action"; data: { message_id: string; response?: string; timestamp: number } }
  | { type: "mouse_position"; data: { x: number; y: number; timestamp: number } }
  | { type: "heartbeat"; data: { timestamp: number } }
```

**关键：** `robot_speak` 消息不包含 `is_reminder` 字段。前端对所有机器人发言使用同一处理逻辑。提醒/闲聊的区分仅在后端日志中记录。

---

## 游戏界面布局

```
┌─────────────────────────────────────┬──────────────┐
│                                     │              │
│         游戏主区域 (75%)             │  手机侧边栏   │
│                                     │   (25%)      │
│  ┌─────────────────────────────┐    │              │
│  │     家庭全景俯视图           │    │  ┌────────┐  │
│  │                             │    │  │ 通知1  │  │
│  │  [厨房]  [餐厅]  [区域3]    │    │  │ (广告) │  │
│  │  (激活)  (降暗)  (降暗)     │    │  │ 通知2  │  │
│  │                             │    │  └────────┘  │
│  │  🤖 机器人  🧑 avatar       │    │              │
│  │                             │    │  需手动解锁   │
│  └─────────────────────────────┘    │  固定时间后   │
│                                     │  自动锁屏     │
│  [HUD: 游戏时钟 | 积分]             │  (显示时间)   │
└─────────────────────────────────────┴──────────────┘
```

### 布局规则

1. **全景可见，当前激活房间正常亮度，其他房间视觉降暗。** 被试始终能看到所有房间，但注意力聚焦在激活房间。
2. **操作聚焦：** 同时只能在一个房间操作。点击另一个房间 → avatar 走过去 → 新房间激活、旧房间降暗。
3. **手机固定右侧 25%。** 独立锁屏/解锁，不遮挡游戏区。
4. **被试自主移动。** 完全自主决定去哪个房间。

### 手机机制

- 推送朋友消息 + 广告
- 固定时间（如 30 秒）无操作后自动锁屏（黑屏 + 时间显示）
- 手动点击解锁查看内容
- 手机通知可能是 PM trigger（如"朋友 B 说我在路上"）

---

## 后端设计

### 数据模型

```python
class Experiment(Base):
    id: int (PK)
    name: str
    config: JSON                     # 全局参数
    status: enum("draft", "active", "completed")
    created_at: datetime
    updated_at: datetime

class Participant(Base):
    id: str (UUID, PK)
    experiment_id: int (FK)
    condition_order: JSON            # e.g. ["CONTROL", "AF", "AFCB"]
    status: enum("registered", "in_progress", "completed", "dropped")
    current_block: int (nullable)
    created_at: datetime
    started_at: datetime (nullable)
    completed_at: datetime (nullable)
    demographic_data: JSON (nullable)
    debrief_data: JSON (nullable)

class Block(Base):
    id: int (PK)
    participant_id: str (FK)
    block_number: int (1-3)
    condition: str                   # "CONTROL" / "AF" / "AFCB"
    day_story: str                   # "Day 1: Cooking for Alice"
    timeline_config: JSON
    status: enum("pending", "encoding", "playing", "microbreak", "completed")
    started_at: datetime (nullable)
    ended_at: datetime (nullable)
    nasa_tlx: JSON (nullable)

class PMTrial(Base):
    id: int (PK)
    block_id: int (FK)
    trial_number: int (1-4)
    has_reminder: bool               # Control block: 全 false; AF/AFCB: 3 true + 1 false
    is_filler: bool                  # 标记 AF/AFCB block 中的无提醒混淆 trial
    
    # 任务定义
    task_config: JSON
    encoding_card: JSON
    
    # 提醒
    reminder_text: str (nullable)    # 占位符 / agent 生成
    reminder_audio_url: str (nullable)
    reminder_condition: str (nullable)
    
    # 运行时
    reminder_played_at: datetime (nullable)
    reminder_user_room: str (nullable)       # 提醒播放时被试所在房间
    reminder_user_activity: str (nullable)   # 提醒播放时被试正在做的任务
    trigger_fired_at: datetime (nullable)
    exec_window_start: datetime (nullable)
    exec_window_end: datetime (nullable)
    
    # 结果
    user_actions: JSON (nullable)
    score: int (nullable)            # 0-6
    response_time_ms: int (nullable)

class ReminderMessage(Base):
    """Agent 系统输出的 landing zone"""
    id: int (PK)
    task_type: str                   # "take_medicine", "find_book", ...
    condition: str                   # "AF" / "AFCB"
    context_activity: str (nullable) # 仅 AFCB："cooking_steak", "setting_table", ...
    text: str
    audio_url: str (nullable)
    metadata: JSON (nullable)
    is_placeholder: bool (default True)
    created_at: datetime

class InteractionLog(Base):
    id: int (PK, auto)
    participant_id: str (FK)
    block_id: int (FK)
    timestamp: datetime
    event_type: str
    event_data: JSON
    room: str (nullable)

class MouseTrack(Base):
    """鼠标轨迹，批量写入"""
    id: int (PK, auto)
    participant_id: str (FK)
    block_id: int (FK)
    data: JSON                       # [{x, y, t}, {x, y, t}, ...] 批量打包

class OngoingTaskScore(Base):
    id: int (PK)
    block_id: int (FK)
    task_type: str
    events: JSON
    score: int

class GameStateSnapshot(Base):
    id: int (PK)
    participant_id: str (FK)
    block_id: int (FK)
    timestamp: datetime
    state: JSON
```

### API 端点

```
# ============ 被试端 ============
POST   /api/session/create                    → 创建 session，分配条件
GET    /api/session/{pid}/status              → 当前进度（断线恢复）
GET    /api/session/{pid}/block/{n}/encoding  → 编码卡数据
WS     /ws/game/{pid}/{block_n}              → WebSocket 游戏主连接
POST   /api/session/{pid}/block/{n}/nasa-tlx → NASA-TLX
POST   /api/session/{pid}/debrief            → 收尾问卷

# ============ 管理员后台 ============
POST   /api/admin/experiment                  → 创建/更新实验
GET    /api/admin/experiment/{eid}/overview   → 总览
GET    /api/admin/participants                → 被试列表
GET    /api/admin/participant/{pid}/live      → 实时状态
WS     /ws/admin/monitor                      → 实时监控 WebSocket
GET    /api/admin/participant/{pid}/logs      → 完整日志
PUT    /api/admin/participant/{pid}/status    → 手动更改状态
GET    /api/admin/export/{eid}               → 数据导出
PUT    /api/admin/config/{eid}               → 更新参数
POST   /api/admin/reminders/import           → 批量导入 agent reminder
GET    /api/admin/reminders                   → 查看 reminder
```

### Block Timeline 示例

```json
{
  "block_number": 1,
  "condition": "AFCB",
  "day_story": "Day 1: Cooking steak dinner for Alice",
  "duration_seconds": 600,
  "ongoing_tasks": {
    "kitchen": { "type": "steak_cooking", "config": { "auto_place_interval": 20 } },
    "dining": { "type": "table_setting", "config": { "guests": 3 } }
  },
  "events": [
    { "t": 0,   "type": "block_start" },
    { "t": 30,  "type": "robot_speak", "data": { "text": "Lovely weather today!", "log_tag": "neutral" } },
    { "t": 60,  "type": "phone_notification", "data": { "sender": "Alice", "preview": "Can't wait!", "is_ad": false } },
    { "t": 110, "type": "ongoing_task_event", "data": { "task": "steak", "event": "urgent_flip", "room": "kitchen" } },
    { "t": 120, "type": "robot_speak", "data": { "text": "{{reminder:pm_001}}", "log_tag": "reminder" } },
    { "t": 180, "type": "phone_notification", "data": { "sender": "Ad", "preview": "50% off!", "is_ad": true } },
    { "t": 240, "type": "pm_trigger", "data": { "trial_id": "pm_001", "trigger_event": "doorbell" } },
    { "t": 300, "type": "robot_speak", "data": { "text": "The kitchen smells great.", "log_tag": "neutral" } },
    { "t": 350, "type": "pm_trigger", "data": { "trial_id": "pm_002", "trigger_event": "email_dentist" } },
    { "t": 400, "type": "robot_speak", "data": { "text": "{{reminder:pm_003}}", "log_tag": "reminder" } },
    { "t": 460, "type": "ongoing_task_event", "data": { "task": "steak", "event": "urgent_flip", "room": "kitchen" } },
    { "t": 520, "type": "pm_trigger", "data": { "trial_id": "pm_003", "trigger_event": "washing_done" } },
    { "t": 540, "type": "pm_trigger", "data": { "trial_id": "pm_004", "trigger_event": "clock_6pm" } },
    { "t": 590, "type": "block_warning" },
    { "t": 600, "type": "block_end" }
  ]
}
```

**注意：**
- `{{reminder:pm_001}}` 在运行时从 `ReminderMessage` 表读取。找不到则用占位文本。
- `log_tag` 仅在后端日志中记录，**不发送给前端**。前端收到的 `robot_speak` 无区分。
- `t: 110` 的 `ongoing_task_event` 是引导机制——在提醒前让厨房出现紧急事件，提高被试在厨房的概率。

---

## 管理员后台

### 功能

**实验管理：** 创建/编辑实验、设置参数（block 时长、执行窗口、ongoing task 难度、手机锁屏时间）、编辑 timeline 模板

**被试监控：** 被试列表 + 状态、实时监控面板（WebSocket）、单个被试详情/日志、手动操作（标记 invalid / 重置 / 强制结束）

**Reminder 管理：** 查看所有 reminder（按条件/任务筛选）、占位符 vs. agent 生成标记、批量导入 agent 输出

**数据导出：** 按实验/被试/条件筛选、CSV + JSON、包含 PM 结果、交互日志、ongoing task 得分、NASA-TLX、鼠标轨迹

---

## 关键设计约束

### 实验完整性
1. **前端永远不知道 PM 评分。** 后端评分后只返回 `{"type": "pm_received"}`
2. **前端不知道哪些 trial 是混淆/baseline。** 编码时一视同仁
3. **执行窗口对被试不可见。** 无倒计时、无提示
4. **`robot_speak` 不含 `is_reminder`。** 前端对所有机器人发言同一处理
5. **所有交互落库。** 点击、房间切换、任务操作、手机操作、鼠标轨迹
6. **Reminder 当前用占位符。** `ReminderMessage` 表预留 agent 接口

### 游戏机制
7. **全景可见，非激活房间降暗。** 不完全遮挡，但强化操作聚焦
8. **被试自主移动。** 不强制行动路线
9. **厨房离人也运行。** 牛排会烧焦
10. **手机侧边栏常驻。** 不遮挡游戏区
11. **机器人三个 block 都在。** Control block 也有 neutral utterance

### 技术
12. **WebSocket 消息带服务器时间戳**
13. **每 10-15 秒保存 GameStateSnapshot**
14. **鼠标轨迹每 200ms 采样，批量上传**（每 5 秒打包一次）

---

## 文件结构

```
cooking-for-friends/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── experiment.py         # Experiment, Participant
│   │   ├── block.py              # Block, PMTrial, ReminderMessage
│   │   └── logging.py            # InteractionLog, MouseTrack, OngoingTaskScore, Snapshot
│   ├── routers/
│   │   ├── session.py
│   │   ├── block.py
│   │   ├── admin.py
│   │   └── export.py
│   ├── websocket/
│   │   ├── game_handler.py
│   │   ├── admin_handler.py
│   │   └── connection_manager.py
│   ├── engine/
│   │   ├── timeline.py           # Block timeline engine
│   │   ├── pm_scorer.py          # 0-6 评分逻辑
│   │   ├── condition_assigner.py # Latin Square (3 levels)
│   │   └── snapshot.py
│   ├── data/
│   │   ├── timelines/            # Block timeline JSON 模板
│   │   ├── pm_tasks/             # PM 任务定义
│   │   ├── placeholder_reminders/
│   │   └── robot_utterances/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── stores/
│   │   │   ├── gameStore.ts
│   │   │   └── adminStore.ts
│   │   ├── pages/
│   │   │   ├── game/
│   │   │   │   ├── WelcomePage.tsx
│   │   │   │   ├── EncodingPage.tsx
│   │   │   │   ├── GamePage.tsx
│   │   │   │   ├── MicroBreakPage.tsx
│   │   │   │   └── DebriefPage.tsx
│   │   │   └── admin/
│   │   │       ├── LoginPage.tsx
│   │   │       ├── DashboardPage.tsx
│   │   │       ├── MonitorPage.tsx
│   │   │       ├── RemindersPage.tsx
│   │   │       └── ExportPage.tsx
│   │   ├── components/
│   │   │   ├── game/
│   │   │   │   ├── WorldView.tsx
│   │   │   │   ├── rooms/
│   │   │   │   │   ├── KitchenRoom.tsx
│   │   │   │   │   ├── DiningRoom.tsx
│   │   │   │   │   └── RoomBase.tsx
│   │   │   │   ├── PhoneSidebar.tsx
│   │   │   │   ├── RobotAvatar.tsx
│   │   │   │   ├── PlayerAvatar.tsx
│   │   │   │   ├── HUD.tsx
│   │   │   │   ├── PMInteraction.tsx
│   │   │   │   ├── EncodingCard.tsx
│   │   │   │   └── NasaTLX.tsx
│   │   │   └── admin/
│   │   │       ├── ParticipantList.tsx
│   │   │       ├── LiveMonitor.tsx
│   │   │       └── ReminderManager.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useLogger.ts
│   │   │   └── useMouseTracker.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── types/
│   │       └── index.ts
│   ├── public/
│   │   ├── audio/
│   │   └── assets/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

---

## 分阶段开发

### Phase 1：跑通一个完整 block

**目标：** 被试走完 编码→游戏（厨房+机器人+PM触发）→micro-break，数据全落库。

#### 后端
1. MySQL + SQLAlchemy async 模型
2. Session 管理：创建被试 → Latin Square 分配（3 levels）
3. WebSocket 连接 + 心跳
4. Timeline Engine：读 JSON → 按时间推送
5. PM 评分（0-6）：接收 pm_attempt → 判定 → 存库
6. 交互日志接收
7. 基础 admin API

#### 前端
1. 页面路由：Welcome → Encoding → Game → MicroBreak → loop → Debrief
2. WebSocket hook
3. Zustand store
4. 游戏界面：75/25 布局 + 全景房间（激活/降暗）+ 手机侧边栏
5. 厨房煎牛排（3 锅 + 放肉/翻面/盛盘/烧焦）
6. 机器人：sprite + 文字气泡
7. Avatar：点击房间 → 走过去 → 激活
8. PM：trigger → 导航 → 选 target → 执行
9. 编码页 + Micro-break
10. 鼠标轨迹采集

#### Admin（最小版）
1. 登录
2. 被试列表 + 状态
3. 实时监控

#### 验收标准
- [ ] 创建 session → 编码卡 → 确认
- [ ] 游戏：全景可见 + 当前房间亮 + 其他降暗
- [ ] 点击房间 → avatar 走过去 → 任务激活
- [ ] 煎牛排运行，离开后继续煎
- [ ] 机器人按 timeline 说话（不区分提醒/闲聊）
- [ ] PM trigger → 执行 → 后端评分 0-6
- [ ] 手机通知 → 解锁 → 自动锁屏
- [ ] Block 结束 → micro-break → NASA-TLX
- [ ] 所有数据写入 MySQL
- [ ] 鼠标轨迹写入
- [ ] Admin 可看被试状态

### Phase 2：PM 系统完善
- 完整执行流程（导航→选 target→动作）
- 0-6 评分各档位的精确判定逻辑
- Execution window 静默计时
- 混淆 trial 与正常 trial 前端无区分
- 编码阶段记忆测试
- Response time 精确记录

### Phase 3：更多房间和 ongoing task
- 餐厅：布置餐桌
- 第三区域（待确认）
- 不同 block 不同菜谱/故事

### Phase 4：机器人行为引擎
- idle 动画 + 自主移动
- Neutral utterance 调度器
- 音频播放（TTS 预录）
- 三个 block 行为一致

### Phase 5：Agent 接口
- `ReminderMessage` 表作为 landing zone
- 批量导入 API
- 运行时读取，缺失 fallback 占位符
- Admin 管理界面

### Phase 6：Admin 完善
- 参数热配置
- Timeline 编辑器
- 实时多被试监控
- 日志回放
- 数据导出（CSV/JSON，按条件筛选）

### Phase 7：打磨与 Pilot
- 视觉美化
- 音效
- 全屏 + 防刷新
- 断线重连
- 参数调优
- Onboarding 教程

---

## Phase 1 开发顺序

1. MySQL + models → database
2. Session API → Latin Square (3 levels)
3. WebSocket 骨架 → 心跳 → 消息收发
4. Hardcoded timeline JSON → Timeline Engine → WS 推送
5. 前端路由 + Zustand store + WS hook
6. 游戏界面布局（75/25 + 房间激活/降暗）
7. 厨房煎牛排
8. 机器人 sprite + 文字气泡
9. Avatar 移动 + 房间切换
10. PM trigger + 执行 + WS 上报 + 后端评分
11. 编码页 + Micro-break
12. 手机侧边栏（通知/锁屏/解锁）
13. 交互日志 + 鼠标轨迹上报
14. Admin 最小版
15. 端到端：完整走一个 block

---

## 附加上下文

一同附上 `experiment_plan_v3.md`，包含：
- 设计变更理由（2×2 → 三水平）
- 分层提醒策略框架
- PM 任务示例和 0-6 评分标准
- 统计分析计划
- 假设和预期贡献

**Reminder 当前状态：** 全部占位符。`ReminderMessage` 表预留。运行时读取，缺失 fallback 到 `"[Placeholder] Remember to do [task_type] (condition: [condition])"`。
