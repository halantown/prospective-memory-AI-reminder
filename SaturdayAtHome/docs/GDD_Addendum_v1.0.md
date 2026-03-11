# Saturday At Home — GDD Addendum v1.0
## Design Revisions After Prototype Verification

| | |
|---|---|
| **Version** | Addendum v1.0 |
| **Date** | 2026-03-12 |
| **Status** | 🔴 PM Trigger redesign is implementation blocker — must be done before next pilot |
| **Supersedes** | GDD §6 (PM Execution), GDD §4.5 (Messages), GDD §4.1 (Steak) |

---

## A1. PM Trigger Mechanism — Complete Redesign

### 问题：Report Task按钮破坏了PM测量的效度

原设计中，PM trigger出现时系统弹出橙色"Report Task"按钮。这个按钮本质上是**第二次提醒**，完全绕过了PM的核心认知过程。

```
原设计（错误）：
  Trigger出现 → 橙色按钮弹出 → 被试点击按钮 → 执行overlay
  ↑ 被试不需要注意到trigger，不需要记起意图
  ↑ 测量的是"看到按钮会不会点"，不是PM

正确的PM范式：
  Trigger自然出现在游戏环境里
  ↓
  被试必须自己注意到（noticing）← PM的核心
  ↓
  被试必须自己记起该做什么（spontaneous retrieval）← PM的核心
  ↓
  被试通过正常游戏交互执行（execution）
  ↓
  系统在隐藏的30s窗口内监测交互是否正确
  ↓
  窗口关闭 → 记录结果（被试不知道窗口存在）
```

**关键原则：被试永远不知道"执行窗口"的存在。系统在后台监测，对被试完全透明。**

---

### A1.1 新的PM触发架构

#### 触发对象设计

每个PM任务对应一个**平时存在但不可交互的游戏元素**，trigger出现时该元素进入**可交互状态**：

| 任务 | Trigger事件 | 平时状态 | Trigger后状态 | 正确执行 |
|---|---|---|---|---|
| Medicine A（Doxycycline）| 厨房"晚餐准备好"图标亮起 | 药品柜：灰色图标，不可点 | 药品柜：高亮，可点击 | 打开→选红圆瓶→确认用量 |
| Medicine B（Vitamin C）| 咖啡机完成提示音+图标 | 药品柜：灰色图标，不可点 | 药品柜：高亮，可点击 | 打开→选橙圆瓶→确认数量 |
| Task C（洗衣入烘干机）| 洗衣机完成灯亮 | 烘干机/晾衣架：灰色 | 衣物出现在洗衣机前，可拖拽 | 衬衫→晾衣架，牛仔裤→烘干机 |
| Task D（收阳台衣物）| 窗外变成黄昏色调 | 阳台衣物：挂着不可点 | 衣物变为可选中 | 只选干的，不选湿毛巾 |
| Task E（给李明打电话）| 联系人"李明"头像变绿（在线）| 李明头像：灰色离线 | 李明头像：绿色+微动画 | 点击李明→选正确消息 |
| Task F（告诉王阿姨时间）| 门铃响+王阿姨出现 | 玄关：空 | 王阿姨站在门口 | 点击王阿姨→选正确说法 |
| Task G（慢炖锅调味）| 慢炖锅倒计时归零+提示音 | 调料架：灰色不可选 | 关火按钮+调料架高亮 | 点关火→选黑胡椒 |
| Task H（扔垃圾）| 垃圾车图标出现在窗外 | 垃圾袋：在玄关角落，灰色 | 垃圾袋高亮，可拖拽 | 拖蓝色袋子到门外 |

#### 执行窗口的隐藏监测

```
后端SSE推送 trigger_appear{task_id, window_ms: 30000}
  ↓
前端：将对应游戏元素切换为可交互状态（无任何提示文字、无按钮）
前端：开始计时（隐藏，不显示给被试）
  ↓
被试在30s内与元素交互 → 执行界面弹出（自然地，不是overlay强制）
  ↓
被试完成交互 → POST /action（选择内容+时间戳）
  ↓
30s计时结束 → 后端推送 window_close{task_id}
前端：元素恢复灰色不可交互
系统记录：miss=0，或已提交的score
```

#### 与fake trigger的区分

fake trigger同样是游戏元素出现（快递员门铃、张芳在线），但：
- 没有PM意图与之对应（被试encoding阶段没有被告知要对张芳做什么）
- 被试与元素交互 → 正常游戏交互完成（签收包裹、随意聊天）
- 如果被试打开PM执行流程后发现"没有什么要做的"，元素只是普通交互

---

### A1.2 执行界面重新设计

去掉Report Task按钮之后，执行界面不是overlay，而是**游戏元素的自然展开**：

```
点击高亮的药品柜
  ↓
药品柜"打开"动画（SVG展开，0.3s）
  ↓
内部展示两个瓶子（正常游戏内交互风格，不是弹窗）
  ↓
点击选择瓶子 → 用量选择
  ↓
确认按钮 → 药品柜关闭，回到游戏
```

**视觉风格：** 执行界面应该看起来和游戏其他交互一致，不是实验系统的弹窗。被试应该感觉"我在游戏里取了个药"，不是"我在完成一个实验任务"。

**不能有任何以下元素：**
- 进度条（被试不知道有时间限制）
- "Report Task"、"Submit"、"Confirm PM"等字样
- 与游戏风格不一致的UI组件

---

### A1.3 Scoring的后端变化

```python
# 新的执行窗口管理
class ExecutionWindow:
    task_id: str
    opened_at: int      # Unix ms
    closes_at: int      # opened_at + 30000
    status: str         # "open" | "submitted" | "missed"

# 后端验证逻辑
def validate_pm_action(session_id, task_id, choice, client_ts):
    window = get_execution_window(session_id, task_id)
    
    if window is None:
        return {"error": "no_active_window"}  # 可能是fake trigger的正常交互
    
    if window.status != "open":
        return {"error": "window_closed"}
    
    if client_ts > window.closes_at:
        return {"error": "too_late"}
    
    score = calculate_score(task_id, choice)
    close_window(session_id, task_id, score)
    return {"received": True}   # 不返回score给前端
```

**关键：后端不把score返回给前端。** 前端只知道"提交成功"，被试看不到任何反馈。

---

## A2. Audio设计 — BGM + Robot Audio Ducking

### A2.1 BGM

**风格：** Cozy ambient，不能有人声，不能有强节奏（会干扰认知任务）。

推荐：Lo-fi厨房背景音（轻微的锅碗瓢盆声 + 柔和钢琴），可在YouTube免版权音乐库（Pixabay、Free Music Archive）找到。

```javascript
// Howler.js实现
const bgm = new Howl({
  src: ['bgm_kitchen.mp3'],
  loop: true,
  volume: 0.35,
  autoplay: false
})

// 游戏开始时淡入
bgm.fade(0, 0.35, 2000)
bgm.play()
```

### A2.2 Robot说话时的Audio Ducking

```javascript
// Robot开始说话
function robotStartSpeaking() {
  bgm.fade(0.35, 0.08, 300)    // 300ms降到8%
}

// Robot说完后
function robotFinishSpeaking() {
  bgm.fade(0.08, 0.35, 800)    // 800ms恢复到35%，比降低慢，更自然
}
```

### A2.3 Robot说话前的注意力引导音

Robot每次说话前0.5秒，播放一个短促的提示音（"叮"，0.3s）。

作用：把被试沉浸在游戏里的注意力拉向robot方向，确保提醒内容被处理。

```javascript
// SSE reminder_fire收到时
async function handleReminderFire(text) {
  await playSound('ding.mp3')          // 0.3s
  await delay(200)                      // 0.2s间隔
  robotStartSpeaking()
  await robotSpeak(text)               // typewriter + TTS
  robotFinishSpeaking()
}
```

### A2.4 其他游戏音效

| 事件 | 音效 | 时长 |
|---|---|---|
| 牛排进入READY | 轻微嗞嗞声 | 0.5s |
| 牛排BURNING | 烟雾报警式短音 | 0.8s |
| 消息气泡出现 | 手机通知音 | 0.3s |
| 消息超时 | 低沉短音 | 0.3s |
| 植物需要浇水 | 水滴声 | 0.3s |
| PM trigger（门铃）| 门铃声 | 1.5s |
| PM trigger（洗衣机）| 洗衣机完成音 | 1.0s |
| PM trigger（慢炖锅）| 计时器滴声 | 0.5s |
| 得分+5 | 轻快"叮" | 0.2s |
| 扣分 | 低沉"咚" | 0.2s |

---

## A3. 邮件/消息系统 — Story重设计

### A3.1 世界观人物关系

被试扮演角色：**在家准备今晚派对的主人**

```
人物网络：
  李明   ——— 老朋友，今晚来派对，负责PM Task E（打电话告知餐厅改变）
  王阿姨 ——— 楼上邻居，今晚也来，负责PM Task F（告知社区活动时间）
  张芳   ——— 同事，今晚要来，fake trigger（在线但不是PM任务对象）
  陈医生 ——— 开了Doxycycline处方的心脏科医生（在encoding卡片里提及）
  物业   ——— 发停车信息（纯背景，fake message）
  外卖平台——— 食材配送确认（纯背景，fake message）
```

### A3.2 消息内容池

每个block的消息从对应池里随机抽取，保证内容和块的主题一致：

**Block 1（所有块通用的背景消息）：**

```javascript
const MESSAGE_POOL_GENERAL = [
  {
    sender: "张芳",
    avatar: "zhangfang",
    subject: "今晚几点到？",
    body: "今晚我大概7点出发，应该8点前能到你家，可以吗？",
    options: ["完全没问题！", "8点有点晚，能早点吗？"],
    correct: 0,
    reward: 2
  },
  {
    sender: "外卖平台",
    avatar: "delivery",
    subject: "您的食材订单已发货",
    body: "牛肉500g、蔬菜礼包已由骑手取件，预计30分钟送达。请问您方便接收吗？",
    options: ["方便，放门口即可", "请等我一下"],
    correct: 0,
    reward: 2
  },
  {
    sender: "物业",
    avatar: "property",
    subject: "停车场临时占用通知",
    body: "B区12-15号车位今日下午维修，请移至C区停车，不便之处敬请谅解。",
    options: ["收到，谢谢通知", "我没有车，不影响"],
    correct: null,   // 两个都算正确
    reward: 2
  },
  {
    sender: "李明",
    avatar: "liming",
    subject: "今晚带什么来？",
    body: "我准备带瓶红酒，你们还缺什么？我顺路可以带。",
    options: ["带点饮料就好！", "不用了，我都准备好了"],
    correct: null,
    reward: 2
  },
  {
    sender: "张芳",
    avatar: "zhangfang",
    subject: "餐厅地址",
    body: "等等，今晚是在你家吃完再去餐厅，还是直接去餐厅？我要告诉我男朋友。",
    options: ["先来我家，再一起去", "直接在餐厅集合"],
    correct: 0,     // 和Task E相关——餐厅改了，需要先确认
    reward: 2
  }
]
```

**Pair 2 Block（洗衣相关块）加入：**
```javascript
{
  sender: "王阿姨",
  avatar: "wangayi",
  subject: "洗衣液",
  body: "小张啊，你家还有多的洗衣液吗？我家刚好用完了，能借一点吗？",
  options: ["有的，等会儿送过去", "不好意思，我也快用完了"],
  correct: null,
  reward: 2
}
```

### A3.3 消息显示规则（不变）

- 每block 3-4条消息
- 不在reminder ±60s内出现
- 15s倒计时，超时-2分
- 和PM联系人（李明、王阿姨）的消息不涉及PM任务内容（避免混淆）

---

## A4. 烹饪系统 — 分阶段复杂度

### A4.1 原型阶段（当前）— 不改变

煎牛排：13s cooking, 4s ready, 3口锅并发。已验证认知负荷合适，不再调整。

### A4.2 Phase 2（Pilot后，如需要提高负荷）

引入**随机烹饪事件**，不改变核心煎牛排机制：

```
每个block随机触发1-2次"特殊烹饪"：
  炒蛋：出现炒锅图标 → 点击加盐（5秒内）→ +8分，超时+0分
  煮汤：点击开火 → 15秒后点击关火 → +6分，忘记关-5分
```

规则简单（一步或两步），不需要新的学习，但打断了被试的"煎牛排自动化"节奏。

### A4.3 洗衣机复杂度提升（Phase 2）

```
点击洗衣机 → 弹出设置面板
  显示当前衣物堆：[蓝色衬衫 + 白色毛巾] 或 [红色T恤 + 牛仔裤]
  选择洗涤剂：[彩色衣物专用] [白色衣物专用]
  选择温度：[30°] [60°]
  
正确组合（随机生成）：彩色衣物+30° / 白色+60°
错误组合：衣物受损 → -5分
```

关键：每次洗涤组合不同，被试需要每次重新读，产生真实认知负荷。

---

## A5. 实施优先级

```
🔴 立即实施（影响实验效度，不做不能收数据）
   A1：PM触发机制完全重新设计

🟡 本周实施（影响pilot质量）
   A2：BGM + audio ducking + 音效
   A3：邮件故事化（只需要改配置文件，不需要新代码）

🟢 Pilot后实施（体验优化）
   A4.2：烹饪多样性
   A4.3：洗衣机复杂度
```

---

## A6. A1实施的技术任务列表

```
A1-T1  后端：ExecutionWindow类
       opened_at, closes_at, status, task_id
       per-session存储，window_close SSE在closes_at时自动推送

A1-T2  后端：validate_pm_action更新
       检查window是否open，拒绝score返回给前端
       window关闭后记录最终score（submitted or missed）

A1-T3  前端：删除Report Task按钮和PM overlay
       彻底从代码库中移除，不保留dead code

A1-T4  前端：每个可触发PM元素的双状态设计
       inactive（灰色，pointer-events: none）
       active（高亮，可交互）
       由trigger_appear/window_close SSE驱动状态切换

A1-T5  前端：药品柜组件（Medicine A/B共用）
       SVG柜子 + 打开动画
       内部：两瓶并排，选瓶→选用量→确认（与现有Medicine UI逻辑相同，
       但嵌入游戏环境而非overlay）

A1-T6  前端：Zustand store更新
       删除pmExecution.active / overlay逻辑
       新增：activeExecutionTask: string | null
       新增：per-task的interactable状态

A1-T7  集成测试
       trigger_appear → 元素高亮 → 被试交互 → 正确score落库
       trigger_appear → 30s不操作 → window_close → score=0落库
       fake trigger → 正常游戏交互 → 无window，无score记录
```

---

## A8. 设计决策日志 — Reminder延迟播放方案（否决）

### 问题背景

被试不在Kitchen视图时，CB文本"I can see you're keeping an eye on the stove"在语境上失效——被试没有在看锅，机器人说看到他在看锅是不成立的。

### 考虑过的方案

等待被试主动打开Kitchen之后再播放reminder；播放期间锁定导航，不允许离开。

### 否决原因

**1. 破坏retention interval一致性**

等待时间取决于被试行为，短则5秒，长则55秒。Reminder到trigger的间隔从固定变成了变量，引入between-participant variance，数据解释难度上升。

**2. Navigation lock会被感知**

被试点击其他房间没有反应，即使没有提示文字，这个体验是反直觉的。被试会感知到"我被锁住了"，可能触发策略性思考，破坏naturalistic feel。

**3. PRD §2.5的force_yellow机制已经处理了这个问题**

force_yellow本来的设计意图就是在reminder前10秒把被试的注意力拉回厨房。如果这个pull效果够强，被试在reminder播放时已经在kitchen，问题不存在。

### 采用的替代方案

**不添加新机制，而是：**

1. force_yellow提前时间从10秒改为**25秒**，给被试更多时间自然切回kitchen
2. pilot时记录 `participant_room_at_reminder`（被试在reminder播放时所在的房间）
3. 用pilot数据判断：如果90%以上的trial里被试在reminder播放时已在kitchen，原设计足够；如果普遍不在，再考虑进一步干预

### 需要在trial log里记录的字段

```python
reminder_a_room: str        # 被试收到reminder A时所在的房间
reminder_b_room: str        # 被试收到reminder B时所在的房间
# 事后分析：非kitchen的trial是否作为协变量或排除标准
```

**这是pilot后的数据决策，不是现在的实现任务。**

---

## A7. 遗留问题

| 问题 | 严重性 | 决定 |
|---|---|---|
| 被试完成PM执行后应该有什么反馈？ | 🟡 中 | 无反馈（保持盲态）。药品柜自然关闭即可。不显示任何"正确/错误"。 |
| 如果被试多次点击PM元素（重复提交）？ | 🟡 中 | 后端deduplicate：同一个window只接受第一次提交，之后的忽略。 |
| 被试在非执行窗口期点击了PM元素？ | 🟡 中 | 正常游戏交互，但后端不计入PM score（无open window）。前端允许点击（元素在trigger期一直高亮到window_close）。 |
| Fake trigger和真实PM trigger的视觉区分度？ | 🔴 高 | 绝对不能让被试区分。Fake trigger的视觉设计必须和真实trigger同级别的"高亮程度"。这是实验效度的关键。 |
