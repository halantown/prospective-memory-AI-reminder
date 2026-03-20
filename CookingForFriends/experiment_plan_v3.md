# 实验计划书 v3：Context-Aware Robot Reminders

## "Cooking for Friends" — 情境感知提醒对前瞻记忆的影响

**更新日期：** 2026年3月20日  
**版本：** v3（单因素三水平设计）  
**状态：** 待导师讨论

---

## 1. 研究目标

探究虚拟机器人助手的 **分层提醒策略（Layered Reminder Strategy）** 如何影响用户在多任务家庭环境下的前瞻记忆（Prospective Memory）表现。

分层策略包含两个递进成分：
- **Associative Fidelity（联想保真度）：** 提醒内容与编码时记忆细节的匹配程度
- **Contextual Bridging（情境桥接）：** 提醒与用户当前活动的语义整合

核心关注点是 **提醒内容的设计**，而非中断时机。

---

## 2. 设计变更说明

### 从 2×2 到三水平递进设计的理由

经过反复的操作化尝试，我们发现 AF 和 CB 在理论上不是两个独立的认知机制，而是 **同一个提醒优化策略的两个递进层级**：

- **AF** 解决的是"激活什么"——通过提供与编码一致的感知线索，增强联想链的激活强度
- **CB** 解决的是"激活的提醒如何被处理"——通过与当前活动建立语义桥接，降低从当前任务切换到 PM 任务的认知门槛

两者作用于记忆提取过程的不同环节，但方向一致、功能互补。将其作为独立自变量做交叉设计（2×2），理论上要求它们有独立的主效应和可分析的交互效应，但这一假设与"递进互补"的关系不符。

因此，采用 **递进式三水平设计** 更合理：无提醒 → AF → AF+CB，每一步在前一步基础上叠加一个认知支持成分。

此外，三水平设计将总实验时长从约 65 分钟缩减至约 50 分钟。这在方法论上具有明确优势：降低疲劳效应对后半段数据质量的影响，减少被试对任务结构的 meta-awareness（保护 PM 范式"遗忘"前提的有效性），并提高被试招募的完成率。

---

## 3. 实验设计

### 3.1 总体框架

- **设计类型：** 单因素三水平被试内设计（One-way repeated-measures, 3 levels）
- **Block 数量：** 3 blocks，每 block 对应连续三天中的一天
- **条件分配：** 3×3 Latin Square counterbalancing，6 组被试序列，尽量均衡
- **目标样本量：** n=30（含 buffer），有效数据 n=24-27（基于 G*Power：repeated-measures ANOVA, 3 levels, f=0.25, α=0.05, power=0.80 → n≈28）

### 3.2 三个实验条件

```
Layer 0 — Control（无提醒）
    被试仅依赖自身记忆，无任何外部提醒
    作为纯基线

Layer 1 — AF（Associative Fidelity）
    机器人提供高联想保真度提醒：
    包含与编码一致的具体感知线索（目标名称 + 视觉特征 + 物理属性）
    不引用当前活动

Layer 2 — AF+CB（Associative Fidelity + Contextual Bridging）
    在 AF 基础上，增加情境桥接：
    以用户当前活动为切入点，建立语义过渡后引出提醒内容
```

### 3.3 条件示例（以"服用处方药"为例）

| 条件 | 提醒内容 |
|------|---------|
| **Control** | （无提醒） |
| **AF** | "Remember to take one Doxycycline tablet from the red bottle on the kitchen shelf." |
| **AF+CB** | "Since you just finished cooking, it's a good time to take one Doxycycline tablet from the red bottle on the kitchen shelf." |

### 3.4 条件间的关键差异

| | Control | AF | AF+CB |
|---|---------|-----|-------|
| 联想线索 | 无 | ✓ 具体感知线索 | ✓ 具体感知线索 |
| 情境桥接 | 无 | 无 | ✓ 当前活动过渡句 |
| 认知支持层级 | 0 | 1 | 2 |

### 3.5 试次内混淆控制

每个 block 内：
- **大部分 PM 任务** 按该 block 的条件处理（Control 无提醒 / AF 有提醒 / AF+CB 有提醒）
- **少数 PM 任务** 无提醒（在 AF 和 AF+CB block 中混入 1 个无提醒 trial）

混入目的：**防止被试在有提醒的 block 中形成"每个 PM 都有提醒"的预期**，维持认知警觉。

**注意：** Control block 本身全部无提醒，不需要混入。

### 3.6 控制变量

- **提醒语音时长：** AF 和 AF+CB 条件均控制在 3–5 秒
- **提醒字数：** AF+CB 因桥接句略长，但差异控制在最小范围（具体上限待 pilot 确定）
- **提醒与 trigger 间隔：** 统一 ~120 秒（仅适用于 AF 和 AF+CB 条件）
- **Ongoing task 难度：** 三个 block 间尽量均衡（不同菜谱但操作复杂度相近）

---

## 4. 实验情境："Cooking for Friends"

### 4.1 叙事背景

被试扮演一位居家成年人，需要连续三天为不同的晚间朋友聚会做准备。每天（每个 block）有不同的菜谱和客人，需要在烹饪主线任务的同时处理各项家务，并记住执行之前被告知的任务。

### 4.2 虚拟环境

浏览器端 2D Web 游戏。

**核心布局：**
- **游戏主区域（75%）：** 家庭全景俯视图，被试可以看到所有房间/区域
- **手机侧边栏（25%）：** 固定在屏幕右侧

**操作聚焦：** 被试同时只能在一个房间操作。当前激活房间正常显示，**其他房间视觉降暗**（可见但弱化），强化被试对当前活动的沉浸感。点击目标房间 → avatar 行走过去（~1-2 秒动画）→ 该区域交互激活。

**被试自主移动：** 被试完全自主决定何时去哪个房间。系统不强制行动路线。

### 4.3 房间/区域

| 区域 | 主要活动 | 注意力吸收机制 |
|------|---------|--------------|
| **厨房（Kitchen）** | 煎牛排/烹饪 — 多锅并行，限时翻面/盛盘 | 时间压力 + 多任务并行 |
| **餐厅（Dining Room）** | 布置餐桌 — 按要求摆放餐具/装饰 | 记忆匹配 + 决策 |
| **[第三区域待定]** | 待讨论 | — |

**关键机制：** 厨房任务即使被试不在厨房也会继续运行（牛排继续煎 → 可能烧焦），创造持续的时间压力和注意力竞争。

### 4.4 手机机制

- 固定在屏幕右侧 25%
- 推送朋友消息（可能是 PM trigger 的一部分）和广告（干扰）
- 固定时间无操作后自动锁屏（黑屏，始终显示当前时间）
- 需手动解锁查看完整内容
- 使用手机时占用被试注意力，但不遮挡游戏区域

### 4.5 虚拟机器人

机器人（Pepper 2D 形象）在虚拟家庭中持续可见：
- **平时：** 在房间内自主移动、idle 动画、偶尔发出 neutral utterance
- **PM 提醒时：** 语音/文字气泡（与 neutral utterance 外观行为一致，被试无法区分）
- **Control block 中：** 机器人仍然在场并发出 neutral utterance，但不发出 PM 提醒
- **设计目的：** justify "robot" 角色（感知环境、自主行为），避免"机器人说话=PM 任务"的条件关联

---

## 5. PM 任务设计

### 5.1 任务结构（所有 PM 任务同构）

```
1. 编码（Encoding）：block 开始前通过任务卡呈现
   → "当 [trigger event] 发生时，去 [target room] 找到 [target object] 并 [执行动作]"
   → 附带 target 视觉图片
   → 被试复述确认 + 记忆测试

2. 触发（Trigger）：trigger event 在游戏中出现
   → 被试需识别 trigger 并主动行动

3. 执行（Execution）：
   → 导航到目标房间
   → 从 2 个视觉相似物品中选择正确 target
   → 执行指定动作
```

### 5.2 PM 任务数量

- **每 block 4 个 PM 任务**
- AF block：3 个有提醒 + 1 个无提醒（混淆）
- AF+CB block：3 个有提醒 + 1 个无提醒（混淆）
- Control block：4 个全部无提醒
- **总计 12 个 PM trial**，其中 6 个有提醒（每条件 3 个），6 个无提醒

### 5.3 PM 任务示例

| # | Trigger Event | Target Action | AF 线索 | CB 桥接（仅 AF+CB 条件使用） |
|---|--------------|---------------|---------|---------------------------|
| 1 | 门铃响（朋友 A 到达） | 去客厅找一本书送给朋友 | 红色封面、山峰图案 | "Since your friend just arrived..." |
| 2 | 邮件中收到牙医确认信 | 去书房日历上标记预约 | 蓝色标签、周三下午 3 点 | "While you're reading emails..." |
| 3 | 洗衣机发出完成提示音 | 去阳台取出深色衣物晾晒 | 黑色羊毛衫、平铺晾干 | "Since the laundry is done..." |
| 4 | 游戏内时钟到达下午 6 点 | 去厨房服用处方药 | 红瓶、圆形药片、1 片 | "Now that it's dinner time..." |
| 5 | 有人敲门送快递 | 去客厅检查包裹并放入储物柜 | 棕色纸箱、Fragile 标签 | "Since you're at the door..." |
| 6 | 手机收到朋友 B "我在路上" | 去厨房为朋友 B 准备饮品 | 绿色茶罐、薄荷茶 | "While you're checking messages..." |
| 7 | 植物浇水提醒响起 | 去阳台给特定植物施肥 | 红色花盆、仙人掌、蓝色肥料棒 | "Since you're near the plants..." |
| 8 | 电视自动开启新闻 | 去客厅录制特定新闻片段 | 频道 7、红色录制键 | "While the TV is on..." |
| 9-12 | （待设计，结构同上） | — | — | — |

**任务分配原则：**
- 12 个任务分为 3 组（每组 4 个），分配给 3 个 block
- 任务-条件的分配在被试间 counterbalance（避免某些任务总在特定条件下）
- 每组内 4 个任务的 trigger-action focality 尽量均衡

### 5.4 评分系统（0-6 分，参考 VR-EAL）

| 分数 | 标准 | 说明 |
|------|------|------|
| **6** | 完美执行 | 时间窗口内，正确识别 trigger → 导航到正确房间 → 选择正确 target → 正确执行动作 |
| **5** | 正确但延迟 | 所有步骤正确，但 response time 超过阈值（如 >15 秒） |
| **4** | Target 正确，动作有误 | 找到正确 target，但执行动作步骤有小错 |
| **3** | 房间正确，target 选错 | 去对了房间，但从 2 个相似物品中选错了 |
| **2** | 有 PM 意图，执行方向错误 | 表现出明显的 PM 相关行为，但房间/target/动作严重偏离 |
| **1** | 极晚响应 | 时间窗口结束后才执行（有残留记忆但严重延迟） |
| **0** | 完全未执行 | 无任何 PM 相关行为 |

**评分原则：**
- 全部由后端代码自动判定，无人工评分
- 每个分数对应客观可检测的行为指标
- 时间窗口：trigger 出现后 30 秒（待 pilot 调整）
- "极晚响应"窗口：30-60 秒（待确认）

---

## 6. Reminder 触发策略

### 6.1 时间间隔

提醒先于 trigger event 约 120 秒发出。统一固定，作为控制变量。

**论证：** 本研究关注提醒内容而非中断时机。文献表明提前 1-6 分钟对 PM 表现无显著差异（[待补引用]），故将间隔固定于约 2 分钟以排除时间因素。太短（<30s）会被质疑为 instruction 而非 reminder；太长（>5min）在 ~10 分钟 block 内占比过大。

### 6.2 Reminder vs. Instruction

提醒内容**严格限定在编码阶段已呈现的信息范围内**。提醒是已编码意图的再激活线索，不包含任何编码阶段未涉及的新信息或执行步骤指导。

### 6.3 CB 桥接的操作

**挑战：** 被试自主移动，提醒触发时被试可能在任何房间。

**策略：**
- 为每个 PM task × 每种主要 ongoing activity 预生成桥接模板
- Timeline 引擎在提醒前 10-15 秒通过 ongoing task 事件将被试"高概率引导"到目标房间（如厨房牛排快烧焦了）
- 后端记录提醒播放时被试的实际房间和活动状态
- 分析时可做 robustness check：排除"提醒时不在预期房间"的 trial，检查结果是否一致

### 6.4 当前实现

所有 reminder message 暂用占位符。后续由 agent 系统生成并写入数据库，游戏运行时自动读取。

---

## 7. Event-Based PM 实现

Trigger event 由系统在后端预设时间点触发，通过以下手段确保被试主观不可预测性：

- Trigger 嵌入日常家务自然流程（门铃、邮件、洗衣机提示等）
- 不同 block 中 trigger 相对时间点不同
- Ongoing task 进度有随机变化（掩盖固定节奏）
- 机器人 neutral utterance 在非 trigger 时刻也出现
- **Control block 中同样有 trigger event**（只是没有提醒），保证三个条件中 trigger 的出现模式一致

---

## 8. 实验流程时间线

**总时长：约 47-52 分钟**

```
第 0–5 分钟：  导入与练习
├── 知情同意书
├── 背景故事（"接下来三天，你要为不同朋友准备晚餐聚会..."）
├── 操作教程（房间切换、ongoing task、手机、机器人介绍）
└── 练习 block（~2 分钟，不含 PM 任务，仅熟悉 ongoing task）

第 5–8 分钟：  Block 1 编码
├── 呈现 4 张 PM 任务卡（顺序随机化）
├── 每张卡附 target 图片
└── 逐一复述确认 + 记忆测试

第 8–18 分钟： Block 1 游戏（~10 分钟）
├── 被试自主在房间间移动，执行 ongoing task
├── 机器人 neutral utterance + 条件性 PM 提醒
├── PM trigger 事件按 timeline 触发
└── 后端静默记录所有交互

第 18–19 分钟：Micro-break 1
├── 强制锁屏 60 秒
├── 3 道 NASA-TLX 题目
└── 舒缓倒计时

第 19–22 分钟：Block 2 编码
第 22–32 分钟：Block 2 游戏
第 32–33 分钟：Micro-break 2

第 33–36 分钟：Block 3 编码
第 36–46 分钟：Block 3 游戏

第 46–52 分钟：收尾（Debriefing）
├── 人口统计学问卷
├── 机器人提醒风格主观偏好反馈
├── 开放式问题（是否察觉提醒差异、策略描述等）
├── Manipulation check（可选：能否回忆不同 block 中机器人行为的差异）
└── 发放报酬
```

---

## 9. 因变量与测量

所有数据通过后端静默记录，被试不知道具体评分。

### 9.1 主要因变量

| 因变量 | 测量方式 | 说明 |
|--------|---------|------|
| **PM Score** | 0-6 分量表（自动评分） | **主要 DV**；三个条件间比较 |
| **PM Response Time** | Trigger 出现 → 首次 PM 相关操作（秒） | 衡量检索速度 |

### 9.2 次要因变量

| 因变量 | 测量方式 | 说明 |
|--------|---------|------|
| **Resumption Lag** | PM 执行完成 → 恢复 ongoing task 首次正确操作（秒） | 衡量提醒对主任务的中断程度 |
| **Ongoing Task Performance** | Block 内 ongoing task 得分 | 检查条件是否影响主任务表现 |
| **主观认知负荷** | 简版 NASA-TLX（每 block 后） | 主观体验 |

### 9.3 探索性测量

| 测量 | 方式 | 用途 |
|------|------|------|
| **鼠标轨迹** | 每 200ms 采样鼠标位置 | 注意力分布分析 |
| **手机交互** | 解锁次数、查看时长、每 block 总交互时间 | 作为协变量或探索性分析 |
| **房间切换模式** | 切换次数、停留时长分布 | 行为策略分析 |

---

## 10. 假设

```
H1（核心）: AF 条件下 PM score 显著高于 Control
    机制：联想线索提醒有效激活编码时的记忆痕迹
    → 这是论文的核心贡献

H2（探索性）: AF+CB 条件下 PM score 高于 AF 条件
    机制：情境桥接在 AF 基础上进一步降低认知切换成本
    → 显著则为 bonus；不显著则讨论原因

H3: AF+CB 条件下 PM score 显著高于 Control
    机制：分层提醒策略的整体有效性

H4（探索性）: AF+CB 条件下 Resumption Lag 短于 AF 条件
    机制：桥接降低了主任务的中断程度
```

---

## 11. 统计分析计划

### 11.1 主要分析

**One-way repeated-measures ANOVA**（3 levels: Control / AF / AF+CB）

- 检验三组间 PM score 是否存在显著差异
- 球形性检验（Mauchly's test），若显著则用 Greenhouse-Geisser 校正
- 报告 F 值、p 值、partial η²

### 11.2 Planned Contrasts（事先计划的对比）

```
Contrast 1: AF vs. Control
→ 检验 H1："联想线索提醒是否优于无提醒"
→ 核心检验

Contrast 2: AF+CB vs. AF
→ 检验 H2："情境桥接是否在 AF 基础上有增量效应"
→ 探索性检验

Contrast 3: AF+CB vs. Control
→ 检验 H3："完整分层策略的整体效果"
```

每个 contrast 报告 t 值、p 值、Cohen's d。

### 11.3 次要分析

- 对 PM Response Time 做同样的 repeated-measures ANOVA + contrasts
- 对 Resumption Lag 做 AF vs. AF+CB 的 paired t-test
- 检验 block order 是否有显著主效应（Latin Square 有效性验证）

### 11.4 探索性分析

- 手机交互频率作为协变量纳入 ANCOVA
- 鼠标轨迹的热力图可视化
- 提醒时被试实际房间 vs. 预期房间的匹配率对 AF+CB 效果的调节

### 11.5 工具

Python: pingouin / statsmodels / scipy  
或 JASP（免费 GUI，适合不熟悉代码的统计分析）  
或 R: ez / afex

---

## 12. 风险与控制

| 风险 | 控制策略 |
|------|---------|
| 三个 block 场景难度不同 | 不同菜谱但操作复杂度相近；Latin Square 平衡顺序 |
| AF+CB block 被试完全依赖机器人 | 混入 1 个无提醒 trial，维持警觉 |
| 提醒文本长度差异 | AF 和 AF+CB 语音时长均控制在 3-5 秒 |
| CB 桥接时被试不在预期房间 | 引导机制 + 后端记录实际状态 + robustness check |
| "机器人说话=PM 任务"条件关联 | 三个 block 中机器人都有 neutral utterance；Control block 无 PM 提醒但有闲聊 |
| 疲劳效应 | 总时长~50 分钟（较 v2 减少 15 分钟）+ micro-break |
| 学习效应 / 策略变化 | Latin Square + 分析 block order 效应 |
| 编码卡呈现顺序效应 | 每个 block 内卡片顺序随机化 |
| 被试识别 PM 触发模式 | Trigger 嵌入自然事件 + 不同 block 时间点变化 + 机器人 neutral utterance |
| 提醒被视为 instruction | 提前 120 秒 + 内容不超编码范围 + 文献支撑 |
| 机器人≈扬声器 | 虚拟机器人持续可见、自主行为、感知用户状态 |

---

## 13. 与 Agent 系统的对应

分层提醒策略直接对应 agent 系统的处理流程：

```
Agent Stage 1: Information Gathering
    → 从数据源获取任务信息，构建 task JSON

Agent Stage 2: Condition-Based Filtering (→ AF)
    → 根据 AF 规则，从 JSON 中提取 entity_name + visual_cues + properties
    → 生成高联想保真度的提醒核心内容

Agent Stage 3: Contextual Assembly (→ AF+CB)
    → 感知用户当前活动状态
    → 将 AF 内容与当前活动语义桥接
    → 输出最终提醒文本
```

三水平实验直接测试了这个架构的三个输出级别（无输出 / Stage 2 输出 / Stage 3 输出）。

---

## 14. 预期贡献

**理论贡献：** 将联想记忆理论应用于 HRI 提醒设计，提出分层提醒策略框架（AF + CB），为"提醒内容设计"这一被忽视的研究方向提供实证基础。

**实践贡献：** 提供可操作的提醒生成规则，使机器人能够根据 task JSON 自动生成不同层级的提醒文本，具备场景泛化能力。

**方法论贡献：** 设计了一套生态效度较高的前瞻记忆实验范式（日常生活模拟 + 自然触发 + 细化评分），可供后续研究复用。

---

## 15. 待确认事项

- [ ] 每 block 4 个 PM 任务是否足够（每条件有效 trial 仅 3 个）
- [ ] 第三房间/区域的具体设定
- [ ] 每 block 8 分钟 vs. 10 分钟 vs. 12 分钟
- [ ] 执行窗口 30 秒、极晚响应窗口 30-60 秒是否合理
- [ ] 手机操作与房间操作是否互斥
- [ ] 0-6 评分各档位的具体行为判定标准（需 pilot 验证）
- [ ] AF+CB 条件中，桥接句的"引导机制"具体如何实现
- [ ] 12 个 PM 任务的具体设计和 focality 均衡
- [ ] Manipulation check 的具体内容

---

## 附录 A：JSON 任务表征结构

```json
{
  "task_id": "pm_001",
  "element_1_task_ontology": {
    "action_verb": "take",
    "target_entity": {
      "name": "Doxycycline",
      "object_type": "medicine",
      "visual_cues": {
        "container": "red bottle",
        "label": "name printed on label"
      },
      "domain_properties": {
        "form": "tablet",
        "dosage": "100mg",
        "quantity": 1
      }
    }
  },
  "element_2_encoding_context": {
    "task_creator": "doctor",
    "background": "prescribed for throat infection",
    "user_saw": ["red bottle", "label with name", "instruction sheet"]
  },
  "element_3_trigger_context": {
    "trigger_type": "event-based",
    "trigger_cue": "dinner time begins (clock reaches 6PM)",
    "current_user_activity": "cooking steak in kitchen",
    "extra_notes": "do not take with dairy (internal reasoning only)"
  }
}
```

**字段使用规则：**
- Control → 不生成任何提醒
- AF → `action_verb` + `target_entity.name` + `visual_cues` + `domain_properties`
- AF+CB → AF 内容 + `current_user_activity` 桥接

---

## 附录 B：提醒内容生成示例

| 条件 | 提醒文本 | 时长 |
|------|---------|------|
| Control | （无） | — |
| AF | "Remember to take one Doxycycline tablet from the red bottle on the kitchen shelf." | ~4s |
| AF+CB | "Since you just finished cooking, remember to take one Doxycycline tablet from the red bottle." | ~5s |
