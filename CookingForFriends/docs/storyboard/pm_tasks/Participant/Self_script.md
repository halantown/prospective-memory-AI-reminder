# Delivery Person — Front Door Instruction

## 人设描述

Delivery person 是一个通过电话出现的配送员角色，不需要在 encoding video 中出现完整人物形象。这个角色的功能是作为后续 PM trigger：在主实验中打电话询问包裹应该如何投递。

视觉上，encoding video 的重点不是配送员本人，而是主角家里的 hallway / entrance area。场景应清楚呈现三个关键元素：**neighbor、mailbox、front door**。整体氛围应是普通居家早晨，主角正在为晚上的 dinner preparation 做整理。

Neighbor 是主角的邻居，年龄约 25–35 岁，形象普通、友好、日常。邻居只作为 hallway episode 中的背景人物，用于形成一个合理的 episode detail，不是 PM target。不要让 neighbor 显得过于重要或像任务对象。

## 故事大纲

昨天早上，你在家里的 hallway 整理东西，为晚上的晚餐准备做一些收拾。你在入口附近遇到邻居，和对方简单打了个招呼。回到 hallway 后，你注意到墙上的 mailbox，也看到 front door 附近有几个之前留下的 delivery boxes。你把 boxes 挪开，让 front door 旁边变得更整洁。整理之后，你检查 front door 附近的位置，发现那里现在有足够空间放一个 small package。于是你决定，今天如果 delivery person 打电话询问配送方式，就让他们把 small package 放在 front door 旁边。之后，你结束 hallway 的整理，继续去准备晚餐。

## Video Structure

视频风格为 soft anime / motion-comic / pixel-inspired cutscene。画面可以由静态背景、角色立绘、轻微表情变化、简单物体移动和对话框构成，不需要复杂动画。

地点：主角家 hallway / entrance area。

环境要素：

hallway 靠近 front door。墙上有 mailbox，front door 附近有几个 delivery boxes。画面不应过度杂乱，因为三个关键叙事元素需要清楚可见：neighbor、delivery boxes、front door。Mailbox 可以清楚出现，但不要在交互上比 front door 更突出。

注意：final choice distractors 已经与 encoding video 解耦。neighbor、mailbox、delivery boxes 只是 episode grounding / click target，不是最终选择项。最终选择项应使用同类别 delivery instruction / delivery location 选项，例如 leave by the front door、leave by the side gate、leave on the porch bench；side gate 和 porch bench 不需要出现在视频里。

## 脚本

### Cutscene 1：在 hallway 遇到邻居

**总时长：12s**

#### 分镜 1（0s–6s）

**画面**：主角家 hallway / entrance area 全景。front door 在画面一侧，主角正在整理 hallway。邻居站在入口附近，像是刚路过或刚打招呼。
**动作**：邻居看向主角，轻微挥手；主角停下整理动作，看向邻居。
**台词**：

* 1.0s–3.0s Neighbor：**“Morning. Getting ready for tonight?”**
* 3.5s–5.2s 主角：**“Yeah, just tidying up a bit.”**

#### 分镜 2（6s–12s）

**画面**：镜头轻微拉近到 hallway 入口区域，neighbor 更清楚。front door 保持在背景中，但不高亮。
**动作**：Neighbor 微笑点头，准备离开；主角继续站在 hallway。
**台词**：

* 6.8s–8.8s Neighbor：**“Sounds busy. Good luck with dinner.”**
* 9.5s–12.0s 画面停留，**neighbor 高亮**，等待点击。

#### 本段结束时三个物品位置

* **neighbor**：hallway 入口附近，靠近 front door 一侧，清楚可见
* **mailbox**：可在墙上隐约出现，但不突出
* **front door**：背景中可见，不高亮

---

### Cutscene 2：整理 front door 附近的 boxes

**总时长：14s**

#### 分镜 1（0s–6s）

**画面**：hallway 中景。邻居已经离开。墙上可见 mailbox，front door 附近有几个 delivery boxes。
**动作**：主角回到 hallway，看向 front door 附近的 boxes。
**台词**：

* 1.0s–2.5s 主角：**“These boxes are still by the door.”**
* 3.0s–5.2s 主角：**“I should clear some space here.”**

#### 分镜 2（6s–14s）

**画面**：主角把 delivery boxes 从 front door 附近挪开。mailbox 仍在墙上可见，但不高亮。
**动作**：boxes 被移到 hallway 侧边，front door 旁边空间变得更清楚。
**台词**：

* 7.0s–9.0s 主角：**“That’s better.”**
* 9.5s–11.0s 主角：**“The entrance looks less cluttered now.”**
* 11.0s–14.0s 画面停留，**delivery boxes 高亮**，等待点击。

#### 本段结束时三个物品位置

* **neighbor**：不再出现
* **mailbox**：墙上，front door 附近，清楚可见但不高亮
* **delivery boxes**：hallway 侧边，被挪开后的位置，高亮等待点击
* **front door**：画面右侧或下方，清楚可见但不高亮

---

### Cutscene 3：决定 small package 放在 front door

**总时长：15s**

#### 分镜 1（0s–7s）

**画面**：front door 附近中景。delivery boxes 已经被挪开，front door 旁边有一块空出来的位置。mailbox 仍在墙上。
**动作**：主角看向 front door 旁边的空位，像是在确认是否适合放包裹。
**台词**：

* 1.0s–3.0s 主角：**“There’s enough space by the front door now.”**
* 3.8s–6.5s 主角：**“A small package could be left here safely.”**

#### 分镜 2（7s–15s）

**画面**：front door 旁边出现一个小的 package icon / delivery thought bubble，表示主角在思考今天的配送方式。
**动作**：主角点头，确认决定。
**台词**：

* 8.0s–10.5s 主角：**“If the delivery person calls later…”**
* 11.0s–13.5s 主角：**“I’ll ask them to leave it by the front door.”**
* 13.5s–15.0s 画面停留，**front door 高亮**，等待点击。

#### 本段结束时三个物品位置

* **neighbor**：不再出现
* **mailbox**：墙上，保持可见但不高亮
* **delivery boxes**：hallway 侧边，不高亮
* **front door**：画面中心或右侧，旁边有清出的空间，**高亮等待点击**

---

### Cutscene 4：结束 hallway 整理

**总时长：11s**

#### 分镜 1（0s–5s）

**画面**：hallway 中景。front door 附近已经整理好，boxes 在侧边，mailbox 在墙上。
**动作**：主角最后看一眼 hallway，准备离开。
**台词**：

* 1.0s–2.8s 主角：**“Okay, the hallway is ready.”**
* 3.2s–4.8s 主角：**“Time to get back to dinner prep.”**

#### 分镜 2（5s–11s）

**画面**：镜头稍微拉远，显示整理后的 hallway。front door、mailbox、boxes 都在背景中，但不高亮。
**动作**：主角离开 hallway，画面准备淡出。
**台词**：

* 5.8s–8.2s 主角：**“I’ll handle the delivery call later.”**
* 8.5s–11.0s 画面停留，等待点击 **Continue / hallway area** 进入下一步。

#### 本段结束时三个物品位置

* **neighbor**：不再出现
* **mailbox**：墙上，背景元素
* **delivery boxes**：hallway 侧边，背景元素
* **front door**：清楚可见，但不高亮
