# PRD Addendum: Visual Overhaul — Home Scene with Embedded Game Panels

> **Status:** 追加需求，覆盖 PRD v2.1 Section 4.2 Visual Layout
> **Date:** 2026-03-17
> **Priority:** P0 — 直接影响实验生态效度和参与者沉浸感

---

## 1  问题：当前实现与设计意图的偏差

PRD v2.1 Section 4.2 描述了一个 75/25 的面板+侧栏布局。当前实现忠实还原了这个描述，但效果是一个**抽象的UI面板界面**——左边是全屏游戏，右边是信息侧栏。这与研究的叙事设定（"Saturday at home, 你在家中度过一天"）严重脱节。参与者看到的是一个软件界面，而不是一个家。

**本次追加需求的核心变更：** 将整个画面改为**俯视角2D家庭平面图**，角色在房间间真实移动，认知游戏在角色到达对应房间后以浮层面板形式弹出。原侧栏中的信息元素（时钟、机器人状态、trigger icons）直接嵌入家庭场景中。

---

## 2  目标视觉模型

### 2.1  整体画面

整个浏览器窗口就是一个**俯视角2D家庭平面图（floor plan view）**。不是像素风，不是等距视角，而是**简约的建筑平面图风格**——干净的线条勾勒墙壁和家具，柔和的颜色区分不同房间，有真实的空间感和比例感。

**视觉参考风格：**
- 干净的建筑平面图 / floor plan illustration 风格
- 墙壁用细线条，房间用淡色填充区分
- 家具用简约icon或简单形状表示（沙发、桌子、洗衣机、电脑桌等）
- 整体色调温暖、明亮，符合"周六在家"的轻松氛围
- 不需要精致的像素艺术，不需要3D效果

### 2.2  房间布局

房屋包含以下房间（与PRD storyline对应）：

```
┌──────────────────────────────────────────────────────┐
│                        HOUSE                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐  │
│  │  Study   │  │ Kitchen │  │                     │  │
│  │ 📧💻    │  │ 🍳🍽️   │  │    Living Room      │  │
│  │         │  │         │  │    🛋️📺            │  │
│  └─────────┘  └─────────┘  │                     │  │
│  ┌─────────┐  ┌─────────┐  │                     │  │
│  │ Laundry │  │Entrance │  └─────────────────────┘  │
│  │ 🫧👕    │  │ 🚪🔔   │  ┌─────────────────────┐  │
│  │         │  │         │  │     Balcony          │  │
│  └─────────┘  └─────────┘  │     🌤️🌱           │  │
│                             └─────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

每个房间对应一种 ongoing task skin：
| 房间 | Block 1 Game Skin | 对应活动 |
|---|---|---|
| Study | Email sorting (Semantic Cat) | Game A — 整理邮件 |
| Kitchen | — (PM trigger location: dinner, cooking) | PM task location |
| Living Room | Podcast quiz (Trivia / Game C) | 休息听播客 |
| Laundry | — (PM trigger location: washing machine) | PM task location |
| Entrance | — (PM trigger location: doorbell) | PM task location |
| Balcony | Online grocery shopping (Go/No-Go) | Game B — 手机买菜 |

> 注意：不是所有房间在每个block都有活动。有的房间是角色路过或PM任务执行地点。

### 2.3  角色移动

**角色（Avatar）：**
- 简约2D小人，有朝向（上下左右），有走路动画（2-4帧足够）
- 角色移动由**后端timeline驱动**，不是玩家控制
- 收到 `room_transition` 事件时，角色从当前位置沿路径平滑移动到目标房间
- 移动速度：适中，走完一个房间到另一个房间约2-3秒
- 移动过程中参与者只是观看，不需要操作

**机器人（Pepper）：**
- 同样是简约2D角色，在房间中有自己的位置
- 大部分时间跟随在avatar附近（同一房间内）
- 说话时头顶出现气泡，有简单的说话动画

### 2.4  游戏面板弹出机制（核心交互）

**当角色走到目标房间并停下后：**

1. 该房间区域**放大 / zoom in**，或在该房间上方弹出一个**浮层面板（floating panel）**
2. 面板内是对应的认知游戏界面（Semantic Cat / Go-No-Go / Trivia）
3. 面板样式：
   - 圆角矩形，带轻微阴影，半透明背景让底层家庭场景仍然隐约可见
   - 面板大小约占屏幕 60-70%
   - 面板位置：居中偏向角色所在房间那一侧
4. 面板外的家庭场景**不消失**，只是略微暗淡（类似模态框的dimming效果，但更轻）
5. 家庭场景中的其他元素（时钟、trigger icons）仍然可见且可交互

**当 `room_transition` 事件触发时：**
1. 游戏面板收起 / 淡出
2. 角色开始走向下一个房间
3. 到达后新的游戏面板弹出

### 2.5  原侧栏元素的重新安置

原PRD的侧栏被取消。其中的元素直接嵌入家庭场景：

| 原侧栏元素 | 新位置 |
|---|---|
| **Clock** | 画面右上角或客厅墙上，始终可见的HUD元素 |
| **MiniMap** | 不再需要——整个画面就是地图 |
| **ActivityLabel** | 游戏面板的标题栏（如 "📧 Sorting emails"）|
| **RobotStatus** | Pepper角色本身就是状态指示（idle = 站着，speaking = 气泡 + 动画）|
| **TriggerZone** | **关键变更 — 见下方 Section 3** |

---

## 3  Trigger Zone 重新设计

这是实验设计的核心组件，变更必须保持PRD的所有anti-meta-strategy规则。

### 3.1  Trigger 的物理化

原来trigger是侧栏中的抽象icon。现在trigger变成**房间中的物理对象**：

| Trigger | 在场景中的表现 | 房间位置 |
|---|---|---|
| 🍽️ Dinner ready | Kitchen中的餐桌/餐具 | Kitchen |
| 📱 Friend arriving | Entrance处的手机/消息气泡 | Entrance 或 HUD |
| 🫧 Laundry done | Laundry中的洗衣机 | Laundry |
| 🔔 Doorbell | Entrance处的门/门铃 | Entrance |
| ⏲️ Timer done | Kitchen中的计时器/压力锅 | Kitchen |
| 📺 Weather alert | Living Room中的电视 | Living Room |
| 🕐 3:00 PM | 墙上的钟 / HUD时钟 | HUD |
| 💬 Friend leaving | Living Room中的朋友角色/聊天气泡 | Living Room |

### 3.2  三态表现（保持不变的逻辑，改变视觉形式）

| 状态 | 原侧栏表现 | 新场景表现 |
|---|---|---|
| **Inactive (grey)** | 灰色icon | 物品正常状态，静止，无高亮 |
| **Ambient (subtle-pulse)** | icon轻微脉动 | 物品有轻微动画（如洗衣机在转、电视屏幕闪烁），但不引人注目 |
| **Fired (highlight-pulse)** | icon高亮脉动 | 物品明显变化（如洗衣机停止+感叹号、门铃发光脉动），伴随"ding"音效，**可点击** |

### 3.3  Anti-meta-strategy 规则（必须保持）

- 所有trigger物品在场景中**始终可见**（不是只在触发时出现）
- 多个物品可能有ambient动画，不代表是PM任务
- "ding"音效对所有trigger相同
- 参与者**正在玩游戏面板时**，需要注意到面板外场景中的变化——这正是prospective memory的考验
- 点击fired状态的物品 → 游戏面板暂停 → MCQ overlay出现

### 3.4  视觉可达性问题

**关键问题：** 如果参与者正在Study里玩email sorting游戏面板，Kitchen里的餐桌trigger亮了，他能看到吗？

**解决方案：**
- 游戏面板不能完全遮挡整个场景——面板有固定大小（60-70%屏幕），周围的家庭场景可见
- Fired trigger除了物品本身的视觉变化外，还有一个**小型通知气泡**浮在画面边缘，指向trigger方向（类似游戏中"屏幕外事件"的箭头提示）
- 但通知气泡是**非特异性的**（所有trigger用相同样式），且ambient事件也偶尔产生类似的轻微提示——保持anti-meta-strategy
- 参与者仍需**主动判断**这是不是他们需要响应的PM trigger

---

## 4  Transition 动画流程

一个完整的房间切换流程：

```
1. 后端发送 room_transition {to: "balcony", narrative: "11:15 AM — Time to order groceries"}

2. 当前游戏面板淡出收起（300ms）

3. 画面显示 narrative 文字（浮层，居中，如 "11:15 AM — Time to order groceries"）
   持续 2 秒

4. 角色开始从当前房间走向目标房间（2-3秒走路动画）
   Pepper跟随移动

5. 角色到达目标房间，停在该房间的"工作位置"

6. 新的游戏面板从该房间位置弹出展开（300ms）

7. 游戏开始，计时器启动
```

---

## 5  技术实现指引

### 5.1  场景渲染

- 使用 **HTML/CSS + absolute positioning** 或 **Canvas (2D)** 渲染家庭平面图
- 推荐方案：整个场景是一个固定尺寸的div容器（如1920×1080或响应式），内部用绝对定位放置房间、家具、角色
- 角色移动用 CSS transition 或 Framer Motion animate
- 不使用游戏引擎（Phaser/PixiJS）—— 保持简单，这不是游戏，是实验平台

### 5.2  游戏面板

- 游戏面板是一个 React portal 或 absolute positioned overlay
- 面板内部的游戏组件（SemanticCatGame, GoNoGoGame, TriviaGame）**不需要改动**，只是容器变了
- 面板位置根据当前房间动态计算

### 5.3  Trigger 交互

- 场景中的trigger物品是可点击的div/button
- 只有 fired 状态才响应点击
- 点击后的流程不变：WS发送trigger_click → 收到MCQ数据 → MCQOverlay弹出

### 5.4  需要保留不变的部分

- **所有后端逻辑** — timeline engine、WS协议、PM scoring、数据库schema
- **游戏组件内部逻辑** — SemanticCatGame、GoNoGoGame、TriviaGame 的item展示、计时、评分
- **PM流程** — EncodingCard → EncodingQuiz → MCQOverlay 的交互逻辑
- **Robot speech** — TTS + 气泡，只是气泡现在显示在Pepper角色头顶而非侧栏
- **Session flow** — Onboarding → Practice → Block×4 → Final Questionnaire
- **Zustand stores** — 数据结构不变，只是UI消费方式改变

### 5.5  需要新建/重写的部分

- **HomeScene.jsx** — 新的顶层场景容器，渲染整个家庭平面图
- **Room.jsx** — 单个房间组件（墙壁、家具、trigger物品）
- **Avatar.jsx** — 角色组件，支持移动动画和朝向
- **PepperCharacter.jsx** — 机器人角色，跟随移动+说话动画
- **GamePanel.jsx** — 游戏面板浮层容器（替代原来的MainPanel）
- **SceneTrigger.jsx** — 场景内的trigger物品组件（替代原来的TriggerZone）
- **SceneClock.jsx** — 场景内/HUD的时钟
- **TransitionOverlay.jsx** — 房间切换时的narrative文字覆盖层
- **原Sidebar.jsx** — 删除或替换
- **原MainPanel** — GameShell保留，但外层容器改为GamePanel

---

## 6  房间与家具资产

不需要精美的图片资产。所有视觉元素用**CSS + emoji/SVG icon**实现：

- 墙壁：CSS border
- 地板：CSS background-color（不同房间不同淡色）
- 家具：emoji或简单SVG icon + CSS定位
  - 🛋️ 沙发、💻 电脑桌、🍳 灶台、🧺 洗衣篮、📺 电视、🚪 门
- 角色：emoji（🧑‍🦱）或简单SVG小人，用CSS animation做走路效果
- Pepper：🤖 emoji或简单机器人SVG

如果后续需要提升视觉质量，可以替换为Figma导出的SVG资产，但MVP阶段用emoji+CSS即可。

---

## 7  验收标准

1. ✅ 打开页面看到完整的家庭平面图，所有房间和家具可见
2. ✅ 角色站在Study房间，游戏面板在Study区域弹出，显示email sorting游戏
3. ✅ 游戏面板外的场景清晰可见（不是全屏遮挡）
4. ✅ 房间切换时角色平滑走动，有narrative文字过渡
5. ✅ Kitchen中的餐桌trigger从inactive变为fired时有明显视觉变化
6. ✅ 在Study玩游戏时可以注意到并点击Kitchen中的fired trigger
7. ✅ 点击fired trigger后MCQ正常弹出
8. ✅ Pepper在场景中可见，说话时头顶有气泡
9. ✅ 时钟在场景中可见且随事件更新
10. ✅ 整个flow（onboarding → encoding → playing → questionnaire）正常运行
