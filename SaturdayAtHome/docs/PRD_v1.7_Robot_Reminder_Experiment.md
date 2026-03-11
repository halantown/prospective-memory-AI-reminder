# PRODUCT REQUIREMENTS DOCUMENT
## Context-Aware Robot Reminder
### Experimental Platform for Prospective Memory Study

| | |
|---|---|
| **Version** | v1.7 — Robot/TTS architecture confirmed; reminder agent dependency explicit; prototype scope defined |
| **Date** | 2026-03-10 |
| **Author** | Thesis Candidate |
| **Status** | 🟢 No P0 blockers remain — prototype development can begin |
| **Ethics** | Approved — Within-subjects, n ≈ 28 (G*Power); recruit n = 32 for dropout buffer |

### Changelog v1.6 → v1.7

| Section | Change |
|---|---|
| §4.1 | Robot/TTS架构确定：Pepper API已跑通；原型阶段mock；两轨音频方案（中性话语=Pepper原生TTS；PM提醒=预生成高质量音频） |
| §4.1 | OQ-8降为P1，与OQ-1并列；开发先按laptop进行 |
| §4.9 | 新增：快速原型范围（1个block + Medicine任务对 + 煎牛排 + avatar mock + dashboard只读版） |
| §2.9 | 明确：reminder文本为reminder agent的输出，当前示例为占位符；文本定稿是预生成音频的前置依赖 |
| §9 OQ | OQ-1部分关闭（Pepper确认，原型mock）；OQ-8降为P1 |

---

## 1  Overview

### 1.1  Purpose

A browser-based experimental platform for a 2×2 within-subjects study on how robot reminder content design affects Prospective Memory (PM) performance and user experience.

**Independent variables:**
- **Associative Fidelity (AF)** — specificity of target cue + intended action in the reminder
- **Contextual Bridging (CB)** — whether the reminder bridges to the user's currently detected activity

### 1.2  Research Questions

- Does higher AF reduce qualitative PM execution errors?
- Does higher CB reduce perceived intrusiveness and cognitive switching cost?
- Is there a significant AF × CB interaction on PM accuracy?

### 1.3  Core Design Principle

> **Every PM task must be designed so that Low AF reminders genuinely produce execution errors.**

Each PM task requires a **confusable distractor** — a visually or contextually similar alternative that a participant acting on a Low AF reminder would plausibly choose incorrectly. High AF reminders provide the discriminating information needed to avoid the error; Low AF reminders do not.

Supervisor's canonical example: two similar red medicine bottles — one from a heart specialist, one from a GP. "Take the medicine" (Low AF) is ambiguous. "Take the Doxycycline from the red round bottle — your heart specialist prescribed it" (High AF) is not.

### 1.4  Theoretical Grounding

**PM framework:**
- **Kvavilashvili & Ellis (1996)** — PM four-stage lifecycle: encoding → retention interval → noticing trigger → execution; justifies per-block encoding and block timeline structure
- **McDaniel & Einstein (2000) Multiprocess Framework** — reflexive-associative vs. strategic monitoring; AF operationalises the specificity of the associative link that enables reflexive retrieval
- **Altmann & Trafton (2002) Goal Activation Model** — intentions require periodic reactivation during retention interval to remain accessible; reminder serves this reactivation function

**Reminder mechanism (core evidence for this study):**
- **Guynn, McDaniel & Einstein (1998)** *"Prospective Memory: When Reminders Fail"* — reminders that include both target event AND intended action are most effective; reminders with only one component are weaker or ineffective; **Experiment 2: no significant effect of 1-min vs 6-min reminder-to-trigger delay** — delay is irrelevant once associative link is activated; directly justifies AF manipulation and timing design
- **Hicks, Marsh & Russell (2000)** — retention intervals of 2.5–15 min studied; longer intervals do not hurt PM (counterintuitive vs. retrospective memory); 1.5-min interval in current design is within established range
- **Henry, Rendell, Phillips, Dunlop & Kliegel (2012)** — experimenter-initiated (externally pushed) reminders in ongoing-task paradigm (Virtual Week); directly establishes legitimacy of robot-pushed reminders
- **McDaniel, Einstein, Graham & Rall (2004)** — on-screen dot reminder during ongoing task helps participants overcome interruption-induced PM failures; closest laboratory analogue to robot reminder on-screen

**Platform and context-awareness:**
- **Virtual Week (Rendell & Craik 2000)** — ecological validity via cognitive task structure, not visual immersion; justifies desktop over VR
- **MemFlow framework (2018)** — robot as context-aware collaborative agent; justifies CB operationalisation

### 1.5  Reminder vs. Instruction — Status: Substantially Resolved

*Previously marked P0 (OQ-7). Guynn et al. (1998) provides the mechanistic resolution. Supervisor confirmation still recommended but no longer a development blocker.*

#### The original concern

Robot reminds participant **before** the trigger appears. The concern was: if the participant is aware of the intention when the trigger occurs, this resembles instruction (pre-announced execution moment) rather than reminder (reactivating forgotten intention). Supervisor's framing: event-based triggers are unpredictable — "when will the dog bite you?" — so pre-announcing is instruction.

#### Resolution via Guynn et al. (1998) — associative link mechanism

Guynn's core finding: an effective reminder works by **activating or strengthening the associative link between the target event and the intended action** in long-term memory. Once this link is strengthened, it remains active — it does not depend on working memory maintenance or continuous vigilance.

This directly answers the "dog bite" concern:

> Robot does not tell you *when* the dog will bite. Robot strengthens the link between "dog biting" and "what to do when bitten." When the dog bites (unpredictable moment), the strengthened link fires automatically — spontaneous retrieval. This is reminder, not instruction.

**Critically:** Guynn Experiment 2 shows **no significant effect of 1-min vs 6-min reminder-to-trigger delay**. If the reminder were functioning as instruction ("go do it now"), delay would matter enormously — the instruction would decay. The null delay effect confirms the mechanism is associative link activation, not working-memory maintenance of a pending command.

Three additional design features that distinguish reminder from instruction in this platform:
1. **Trigger timing is unknown** — participant cannot predict when the dinner icon / washing machine light / doorbell will appear; cannot "wait and execute"
2. **Ongoing task demands** — ongoing task occupies attention throughout retention interval; participant cannot simply hold the intention in working memory
3. **Trigger noticing is required** — participant must independently notice the trigger; robot does not announce it

#### Residual concern and recommended option

One scenario remains theoretically ambiguous: participant encodes intention during reminder, maintains it in working memory despite ongoing task pressure, and executes immediately at trigger. This looks identical to the associative-link path in the data.

**Option C (change reminder linguistic form) remains recommended** as best practice — not to fix a fundamental flaw, but to make the associative-link mechanism more explicit:
- Current phrasing: *"Don't forget to take your medicine."* (could imply "soon")
- Option C phrasing: *"By the way, remember — after dinner today, take your Doxycycline from the red round bottle."* (intention re-encoding, no trigger timing implied)

This framing aligns the reminder text with Guynn's mechanism and pre-empts reviewer concern without requiring redesign.

**Remaining for supervisor confirmation (OQ-7, now P1):** Confirm Option C phrasing adoption; confirm theoretical frame stays PM-focused rather than shifting to reminder-design-for-task-support.

### 1.6  Complete Theoretical Chain

This section states the full causal model connecting the 2×2 design to predicted outcomes. AF and CB act on **different stages of the PM lifecycle**, which generates testable predictions about their interaction.

```
ENCODING
  Participant forms intention: "When X happens, do Y"
  Encoding confirmation (read aloud + quiz) ensures this stage succeeds

        ↓

RETENTION INTERVAL (ongoing task runs; ~1.5 min before trigger)
  Robot delivers reminder
  ┌─────────────────────────────────────────────────────┐
  │  HIGH AF: reminder specifies exact target + action   │
  │  → Activates HIGH-SPECIFICITY associative link       │
  │  → Link: precise visual cue ↔ exact action           │
  │                                                      │
  │  LOW AF: reminder vague on target and/or action      │
  │  → Activates LOW-SPECIFICITY associative link        │
  │  → Link: general category ↔ general action           │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │  HIGH CB: reminder bridges to detected activity      │
  │  → Lower perceived intrusiveness                     │
  │  → Lower cognitive switching cost                    │
  │  → Reminder processed more fully (better attention)  │
  │                                                      │
  │  LOW CB: reminder decontextualised                   │
  │  → Higher switching cost; reminder may be dismissed  │
  └─────────────────────────────────────────────────────┘

        ↓

TRIGGER NOTICING (participant must independently notice trigger)
  CB may indirectly improve noticing probability by
  reducing cognitive load during retention interval.
  AF does not affect noticing — the trigger is the trigger
  regardless of how well the link was specified.

        ↓

EXECUTION
  HIGH AF link: when trigger fires, retrieved action is specific
  → Participant selects CORRECT target (not distractor)   → Score 2
  LOW AF link: when trigger fires, retrieved action is vague
  → Distractor matches general category; confusion likely → Score 1
  No retrieval (miss):                                    → Score 0
```

**Predicted pattern of results:**

| Outcome | AF effect | CB effect | AF × CB interaction |
|---|---|---|---|
| PM Accuracy (0/1/2) | **Strong** — link specificity determines correct vs wrong execution | Weak or null — CB does not change link content | Theoretically weak — AF and CB act on different stages |
| Perceived Intrusiveness | Null — AF does not change how reminder feels | **Strong** — context bridge reduces disruption | Possible — High AF + High CB may feel most natural |
| Perceived Helpfulness | Moderate — more specific = more obviously useful | **Strong** — contextual relevance increases perceived value | Possible |
| Cognitive Switching Cost | Null or small | **Moderate** — lower switching cost for High CB | Possible |

**If results are null:** Guynn et al. (1998) identifies that expecting a reminder reduces encoding effort. All participants know the robot will remind them → lower encoding investment → both AF and CB effects are attenuated at source. This is a theoretically interpretable null, not a design failure. The literature on reminder-dependent encoding offloading (Henry et al. 2012) provides the discussion frame.

---

### 2.1  Storyline

> It's Saturday. You're at home preparing for a party tonight — there's a lot of food to cook, and some everyday things to take care of in between. Your robot assistant is with you.

**All 4 blocks share identical background story.** Only the 2 PM tasks and the reminder condition change per block. Consistent storyline ensures comparable ongoing-task cognitive load across blocks.

### 2.2  Session Structure

| Phase | Duration | Description |
|---|---|---|
| Onboarding | 3 min | Explain session flow; clarify robot speaks randomly (reminders and small talk mixed, indistinguishable); **no PM task content revealed** |
| Practice | 5 min | Familiarise with ongoing tasks (steak + message bubbles); no PM tasks; robot delivers neutral utterances to set expectation |
| Block 1–4 | 8–9 min × 4 | Per-block encoding (30 s) before each block |
| Final Questionnaire | 5 min | MSE scale + open feedback + strategy use item |
| **Total** | **~55 min** | Including all transitions |

### 2.3  Sample Size

**n = 28** from G*Power analysis. Recruit **n = 32** to account for dropout and exclusions.

Latin Square group sizes: Groups A/B/C ≈ 8 participants each; Group D ≈ 8 participants.

### 2.4  Per-Block Encoding & Confirmation

**Encoding procedure (30 seconds per block):**

1. Screen displays the 2 PM task instruction cards (text + image of target and distractor)
2. Participant reads both cards
3. Participant **reads both tasks aloud** to experimenter (oral confirmation)
4. Participant answers **one single-choice verification question** per task (e.g., "What colour is the correct medicine bottle?") — answer must be correct to proceed; wrong answer returns to step 2

This dual confirmation (oral + quiz) ensures encoding quality and provides a criterion for excluding trials where encoding failed.

**Task cards removed immediately after encoding confirmation:**

Once the participant passes the verification quiz, the task instruction cards are removed from the screen and are **not accessible again for the remainder of the block**. No sticky note, task summary button, or any other review mechanism exists during the retention interval or execution window.

*Rationale:* A persistent reference (sticky note) would allow participants to externalise their intention, bypassing the internal associative link that is the object of study. If participants can look up the task detail at any point, the AF manipulation loses its effect — High AF and Low AF reminders would produce identical execution accuracy because both groups could compensate by consulting the external reference. The entire 2×2 design depends on participants relying on memory, not external scaffolding.

*If participants show high miss rates in pilot (suggesting the task cards removal is too demanding):* The correct remedy is to adjust ongoing task difficulty or encoding duration — not to reintroduce external reference access.

**Rationale for per-block (not upfront) encoding:**
Encoding all 4 tasks before Block 1 creates concurrent intention competition and uncontrolled retention intervals across blocks, inconsistent with the PM theoretical framework. Per-block encoding makes each block a self-contained PM lifecycle unit.

### 2.5  CB Operationalisation — Fixed-State Method

#### The problem with real-time state detection

If CB text is generated dynamically from participant's current location, the same reminder timepoint will find different participants in different states. CB content varies across participants → introduces an uncontrolled variable.

#### Solution: force a consistent state immediately before each reminder

**10 seconds before each PM reminder fires**, the backend forces one of the following contextually appropriate events, guaranteeing the participant's attention is in the correct zone:

| Block / Task pair | Forced pre-reminder event | CB text (fixed string) |
|---|---|---|
| All blocks (default) | One steak enters **yellow warning zone** on the stove | "I can see you're keeping an eye on the stove." |
| Task pair 2 block (laundry) | Washing machine progress bar reaches 90% | "I can see the laundry is almost done." |

**The steak enters yellow — not burnt.** Yellow warning attracts attention without penalising the participant. After the CB utterance, the steak continues its normal progression.

**Implementation:** Backend SSE sends `force_yellow_steak` event at t_reminder − 10s. Frontend transitions one steak's progress bar to yellow zone. Reminder fires 10 seconds later. CB text is a hardcoded string, not generated dynamically.

**Result:** CB text is identical for all participants at each reminder timepoint. The only variable is whether the reminder contains CB content (High CB) or not (Low CB). No enumeration of states needed.

### 2.6  Latin Square Design

**Principle:** Task pairs are a fixed blocking factor assigned to block positions. Reminder conditions are counterbalanced via Latin Square across participants. Analysis compares conditions within the same task pair — task content is constant, condition is the only variable.

| Group | Block 1 (Pair 1) | Block 2 (Pair 2) | Block 3 (Pair 3) | Block 4 (Pair 4) |
|---|---|---|---|---|
| Group A (n≈8) | Pair 1 × **LL** | Pair 2 × **HL** | Pair 3 × **LH** | Pair 4 × **HH** |
| Group B (n≈8) | Pair 1 × **HL** | Pair 2 × **LH** | Pair 3 × **HH** | Pair 4 × **LL** |
| Group C (n≈8) | Pair 1 × **LH** | Pair 2 × **HH** | Pair 3 × **LL** | Pair 4 × **HL** |
| Group D (n≈8) | Pair 1 × **HH** | Pair 2 × **LL** | Pair 3 × **HL** | Pair 4 × **LH** |

LL = LowAF_LowCB, HL = HighAF_LowCB, LH = LowAF_HighCB, HH = HighAF_HighCB

Verification: each condition appears once per block position ✓; each task pair appears once per condition across participants ✓

**Analysis logic:** `PM Accuracy ~ AF × CB + (1 | participant) + (1 | task_pair)` — task_pair absorbs between-pair difficulty variance; condition effects are estimated within-pair.

**Thesis statement:** *Task pairs are treated as a fixed blocking factor assigned to block positions; condition order is fully counterbalanced via Latin Square across participants.*

### 2.7  Block Internal Timeline

```
Block N starts
│
├─ 0:00   📋 Per-block encoding (30 s)
│         2 PM task cards displayed (text + image)
│         Participant reads aloud → answers verification quiz → confirmed
│
├─ 0:30   Steak task activates; message bubbles on standby
│         Robot neutral utterance #1 (random within 0:30–1:45)
│
├─ 0:30   🔔 FAKE TRIGGER appears (see §2.8)
│         Participant handles or ignores; no PM execution expected
│
├─ 1:50   force_yellow_steak event fires (10 s before Reminder A)
│
├─ 2:00   🤖 Robot Reminder A (condition for this block)
│
├─ 2:15   Retention interval — steak task continues; participant unaware of trigger timing
│
├─ 3:30   🎯 Task A Target Event appears
│         "Report Task" button activates; 30-second execution window
│
├─ 4:00   Execution window closes; system logs Task A result (0/1/2)
│         New steak batch enters to fill gap
│
├─ 4:30   Robot neutral utterance #2
│
├─ 4:50   force_yellow_steak event fires (10 s before Reminder B)
│
├─ 5:00   🤖 Robot Reminder B (same condition)
│
├─ 5:15   Retention interval continues
│
├─ 6:30   🎯 Task B Target Event appears
│         "Report Task" button activates; 30-second execution window
│
├─ 7:00   Execution window closes; system logs Task B result
│         Final steak batch enters (fills 7:00–8:30 gap)
│
└─ 8:30   Block ends → Likert 2 items → 30-second rest
```

> **Timing justification:** Reminder-to-trigger gap is ~1.5 min. Guynn et al. (1998) Experiment 2 found no significant effect of 1-min vs 6-min reminder-to-trigger delay on PM performance (null main effect and null interaction). The associative link mechanism explains why: once the link is activated by the reminder, delay is irrelevant. 1.5 min is well within the established 2.5–15 min retention interval range (Hicks et al. 2000). **OQ-6 closed.**

### 2.8  Fake Trigger Specification

**Purpose:** Prevent participants from learning "event appears = PM task incoming." Without fake triggers, participants rapidly form the rule and engage strategic monitoring, undermining the ecological validity of PM measurement.

**Placement:** 1 fake trigger per block, appearing at ~t = 0:30, **before Reminder A**. This is the most effective placement: the participant has just entered the block with no PM reminder yet, so the fake trigger establishes early that events can appear without PM tasks attached.

**Design rules for each fake trigger:**
1. Visually indistinguishable in category from the real PM trigger it mirrors
2. Requires a simple, brief interaction (or none at all) — not a new ongoing task
3. Narratively natural; no PM intention should be inferrable from it

**Fake trigger catalogue:**

| Real PM Trigger | Fake Trigger | Fake handling |
|---|---|---|
| Friend Li appears online → call | Another friend appears online | Click to view chat; no action needed; close |
| Doorbell — Mrs Wang (neighbour) | Doorbell — delivery person | Click to sign for package; done |
| Window outside: dark sky | Window outside: cloudy sky | Visual change only; no interaction |
| Washing machine done light | Dishwasher done light | Click confirm; dishes clean; no PM |
| Rubbish truck outside | Food delivery motorbike outside | Visual event only; no interaction |

**Fake trigger assignment per block:** Each block gets 1 fake trigger, selected to match the general event category of that block's PM tasks. Blocks without a natural matching fake trigger use the "delivery person" default (universally plausible on a Saturday).

**System handling if participant clicks "Report Task" on a fake trigger:**
System responds with a gentle neutral message: *"Nothing needs to be done right now."* No score penalty, no indication that this was a "test." Participant does not learn that fake triggers exist.

**Data logging:** Fake trigger appearances and any participant responses are logged separately (`fake_trigger_appeared_at`, `fake_trigger_response`) for post-hoc analysis of false alarm rates.

### 2.9  Conditions — 2×2 Design

**Reminder texts are outputs of the reminder agent (separate workstream).** The examples below are structural placeholders that illustrate the AF × CB manipulation. Final texts replace these once the reminder agent is complete. Final texts must be approved before audio pre-generation begins.

**Structural requirements for each condition (must be preserved in agent output):**

| Condition | Structure requirement | Example placeholder (Medicine A) |
|---|---|---|
| **Low AF · Low CB** | Intention re-encoding only; entity + action; NO specific cues | "By the way, remember — after dinner today, take your medicine." |
| **High AF · Low CB** | Intention re-encoding; MUST include: specific visual identifier + item name + encoding source | "By the way, remember — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed." |
| **Low AF · High CB** | CB bridge sentence first; then Low AF intention re-encoding | "I can see you're keeping an eye on the stove. By the way — after dinner today, remember to take your medicine." |
| **High AF · High CB** | CB bridge sentence first; then High AF intention re-encoding | "I can see you're keeping an eye on the stove. By the way — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed." |

**AF manipulation check:** High AF text must provide enough information to distinguish the correct target from its distractor. Low AF text must NOT provide this information. This is the core validity requirement; reminder agent output must be verified against each task's distractor before finalisation.

### 2.10  PM Task Pairs (8 Tasks)

8 tasks in 4 structurally parallel pairs. Within each pair, both tasks share identical option count, distractor type, and execution step count — ensuring within-pair difficulty equivalence.

---

#### Task Pair 1 — Medicine
*Structure: 2 visually similar containers → select correct 1 → confirm dose/amount*

**Task A — Doxycycline**
- Encoding: Red **round** bottle, prescribed by **cardiologist**, take after dinner
- Distractor: Red **square** bottle (GP-prescribed, different drug)
- Trigger: Kitchen "dinner is ready" icon
- Execution: Two bottles appear → select one → confirm dose
- Scoring: 2 = round bottle + correct dose / 1 = wrong bottle or wrong dose / 0 = no action

**Task B — Vitamin C**
- Encoding: Vitamin C in **orange round** bottle, take after breakfast
- Distractor: Yellow square bottle (Vitamin D — not needed today)
- Trigger: Kitchen coffee machine completion chime
- Execution: Two bottles appear → select one → confirm count
- Scoring: 2 = orange round bottle + correct count / 1 = wrong bottle or wrong count / 0 = no action

---

#### Task Pair 2 — Laundry
*Structure: 2 items → route each to the correct destination*

**Task C — Laundry into dryer**
- Encoding: White cotton shirt → hang dry only; dark jeans → dryer on low heat
- Distractor: Put white shirt in dryer too
- Trigger: Living room washing machine done indicator
- Execution: 2 garments → drag each to dryer or drying rack
- Scoring: 2 = both correct / 1 = either wrong / 0 = no action

**Task D — Bring in balcony laundry**
- Encoding: Bring in laundry before dark; towel is still damp — do not bring in
- Distractor: Bring in damp towel too
- Trigger: Outside window background switches to dusk light
- Execution: Balcony view, 2 items → click to select which to bring in
- Scoring: 2 = only dry items / 1 = damp towel included / 0 = no action

---

#### Task Pair 3 — Communication
*Structure: select correct person (4-choice) → select correct message (3-choice)*

**Task E — Phone call**
- Encoding: If friend Li is online today, tell her the dinner is moved to Restaurant B
- Distractor: 3–4 contacts online; message options include wrong venue
- Trigger: Li's avatar shows "online" in message area
- Execution: Select contact (4-choice) → select message (3-choice)
- Scoring: 2 = correct person + correct message / 1 = correct person wrong message, or wrong person / 0 = no action

**Task F — Inform visitor**
- Encoding: If neighbour Mrs Wang comes by, tell her Sunday's community event is moved to 3 PM
- Distractor: Delivery person as fake trigger; message options include wrong time
- Trigger: Doorbell; Mrs Wang appears at door
- Execution: Select what to say (3-choice: correct time / wrong time / unrelated)
- Scoring: 2 = correct time / 1 = wrong time / 0 = nothing said

---

#### Task Pair 4 — Chores
*Structure: single-step action → select correct target from 2 similar options*

**Task G — Slow cooker**
- Encoding: When soup is done, turn off heat and add **black** pepper (not white pepper)
- Distractor: Black pepper and white pepper side by side on counter
- Trigger: Slow cooker countdown reaches zero
- Execution: Click turn off heat → select one seasoning from 2
- Scoring: 2 = off + black pepper / 1 = wrong seasoning or forgot seasoning / 0 = no action

**Task H — Take out rubbish**
- Encoding: Rubbish truck comes today; take out the **blue recyclable** bag (not the green food waste bag)
- Distractor: Blue recyclable bag and green food waste bag at entrance
- Trigger: Rubbish truck icon appears outside window
- Execution: Select one of 2 bags → drag to outside
- Scoring: 2 = blue bag / 1 = green bag / 0 = no action

---

#### Task Pair Summary

| Pair | Task A | Task B | Shared structure | Parallelism |
|---|---|---|---|---|
| 1 | Doxycycline | Vitamin C | 2 containers → select 1 + confirm amount | Same option count, same visual distractor type |
| 2 | Laundry dryer | Balcony laundry | 2 items → route to 2 destinations | Same item count, same destination count |
| 3 | Phone call | Inform visitor | Select person + select message | Same step count, same option counts |
| 4 | Slow cooker | Rubbish | Single action → 2-choice target | Same option count, same execution steps |

---

## 3  Dependent Variables & Analysis

### 3.1  Dependent Variables

| DV | Measurement | Operationalisation | Analysis |
|---|---|---|---|
| PM Accuracy | System log (auto) | 0 = Miss / 1 = Wrong / 2 = Correct | Mixed ANOVA; see §3.2 |
| Perceived Intrusiveness | 7-pt Likert post-block | "The reminder disrupted my focus" | Repeated measures ANOVA |
| Perceived Helpfulness | 7-pt Likert post-block | "The reminder helped me recall the task" | Repeated measures ANOVA |
| Cognitive Switching Cost | Ongoing score delta (auto) | Per-block baseline − reminder ±30s window | Paired t-test per condition |
| Memory Self-Efficacy | MSE scale pre/post session | Bandura-adapted 6-item scale | Pre-post comparison |
| Strategy Use | Single post-session item | "Did you actively monitor the robot for reminders?" 1–5 | Covariate in PM accuracy analysis |

### 3.2  Analysis Plan

**Primary model:**
```
PM Accuracy ~ AF × CB + (1 | participant) + (1 | task_pair)
```
task_pair as random effect absorbs between-pair difficulty variance. Condition effects are estimated within task pair.

**Pre-analysis pilot check:** Test whether task_pair main effect is significant across conditions. If not significant → difficulty equivalence supported, report as evidence. If significant → add task_pair as fixed covariate.

**Cognitive Switching Cost:** Per-block baseline (mean ongoing score/5s before the reminder within that block) minus reminder ±30s window mean. Using within-block baseline controls for learning effects across blocks.

### 3.3  Attention Check Mechanism

**Definition:** A trial is flagged as **low-attention** if the participant's ongoing task score in the 60 seconds surrounding the reminder is less than 50% of their per-block baseline.

**Handling:**
- Flagged trials are retained in primary analysis
- Sensitivity analysis re-runs primary model with flagged trials excluded
- If sensitivity results diverge substantially, low-attention rate is reported and discussed

**Implementation:** `attention_flag` boolean field added to per-trial log (§7.1). Computed post-hoc from `ongoing_score_baseline` and `ongoing_score_window`.

### 3.4  Exclusion Criteria (Placeholder)

*To be finalised after pilot testing. Provisional criteria:*

**Participant-level exclusion:**
- Completion rate < 75% (fewer than 3 of 4 blocks completed)
- Technical failure affecting ≥ 2 blocks
- Self-reported non-compliance (e.g., not reading encoding instructions)

**Trial-level exclusion:**
- Encoding verification quiz failed and not corrected within 2 attempts
- Block-level technical error confirmed in experimenter log

*Note: Exclusion criteria must be pre-specified before data collection begins to avoid post-hoc decisions.*

---

## 4  Platform Architecture

### 4.1  Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | Python + FastAPI | All experiment logic server-side; frontend is display-only |
| Frontend | React + Vite | Component structure matches room/block architecture |
| Styling | Tailwind CSS | Utility-first; fast layout without custom CSS |
| Audio | Howler.js | Cross-browser audio; precise callback timing |
| Frontend State | Zustand | Lightweight global state |
| Backend → Frontend | Server-Sent Events (SSE) | Push timing events (reminder_fire, trigger_appear, force_yellow_steak) |
| Database | SQLite | Local; one-command CSV export |
| Counterbalancing | Latin Square JSON config | participant_id → condition order auto-assigned |
| Deployment | Local LAN | FastAPI on experimenter machine; participant accesses via browser |

**Robot integration — Pepper (confirmed):**
- Pepper robot API already tested and working
- Prototype phase: **mock the robot API call** — backend sends reminder text to a stub that logs it; no physical robot needed for prototype validation
- Week 3 integration: swap stub for real Pepper API calls

**Audio architecture — two-track system:**

| Audio type | Method | Rationale |
|---|---|---|
| Neutral utterances ("Smells good in the kitchen") | Pepper native TTS, real-time | High volume, low stakes; quality requirement low; real-time generation appropriate |
| **PM reminder content** | **Pre-generated high-quality audio files** | Quality matters for reminder perception (CB/AF manipulation); text is fixed once reminder agent output is finalised; files loaded onto Pepper and triggered by filename |

**Pre-generated reminder audio pipeline:**
1. Reminder agent produces final text for all 32 reminder variants (4 conditions × 8 tasks)
2. Generate audio via ElevenLabs or equivalent high-quality TTS
3. Files named by convention: `reminder_{task_id}_{condition}.mp3`
4. Loaded onto Pepper; backend triggers playback by sending filename
5. **Constraint: reminder text must be fully finalised before audio generation begins.** Any text change after this point requires re-generating the affected files.

**Device — laptop first (P1 decision):**
- Develop against 14.4" laptop initially
- iPad (2018) adaptation deferred; layout adjustments needed if device changes
- Touch target sizing and drag interaction may need revision for iPad

**Reminder text — reminder agent dependency:**
See §2.9. All reminder texts in this PRD are placeholders. Final texts are outputs of the reminder agent (separate development workstream). Prototype requires at least 1 complete task pair's texts (4 variants) to be functional.

### 4.2  Backend API

```
POST /session/start                     # participant_id → session_id + Latin Square group + condition order
GET  /session/{id}/block/{n}            # condition, task pair, reminder text, audio path
GET  /session/{id}/block/{n}/stream     # SSE: encoding_start, force_yellow_steak, reminder_fire,
                                        #      trigger_appear, window_close, fake_trigger_fire
POST /session/{id}/block/{n}/encoding   # log encoding confirmation + quiz result
POST /session/{id}/block/{n}/action     # PM action report → backend scores and logs
POST /session/{id}/block/{n}/ongoing    # ongoing score update (every 5 seconds)
POST /session/{id}/block/{n}/fake       # log participant response to fake trigger
POST /session/{id}/questionnaire        # Likert + open comment + strategy use
GET  /session/{id}/export               # CSV export for single session
GET  /admin/export/all                  # CSV export for all sessions
GET  /admin/dashboard                   # Experimenter dashboard (see §4.8)
```

### 4.3  Asset Production Pipeline

#### Visual style: Flat Illustration

**Rationale:** High object recognisability (round vs square bottle, blue vs green bag clearly distinguishable); warm low-saturation background + high-saturation signal colours (red = urgent, yellow = warning, green = done); broadly acceptable aesthetic across participant demographics.

**Reference games:** Unpacking (2021) — top-down home scene, objects clearly readable; A Little to the Left — object discrimination logic, clean visuals.

#### AI image generation workflow

All assets generated in a single batch session to ensure visual consistency. Do not generate across multiple sessions — style drift between sessions breaks cohesion.

**Base style prompt (Midjourney / DALL-E 3):**
```
flat illustration, cozy home interior object, warm pastel palette,
simple clean shapes, no shadows, white background, icon style, 2D
```

Append specific object description to base prompt for each asset.

**Asset list (generate all at once, ~35–40 items):**

| Category | Items | Critical visual requirement |
|---|---|---|
| Medicine bottles | Red round, red square, orange round, yellow square | Shape difference must be unambiguous |
| Clothing | White shirt, dark jeans, towel | Colour and texture distinguishable |
| Rubbish bags | Blue (recyclable), green (food waste) | Colour difference must be unambiguous |
| Seasonings | Black pepper grinder, white pepper grinder | Colour label clearly different |
| Contacts / visitors | 6–8 avatar faces, Mrs Wang, delivery person | Consistent cartoon style |
| Kitchen appliances | Frying pan (with steak), slow cooker, coffee machine | Size-appropriate for layout |
| Laundry appliances | Washing machine, dryer, drying rack | Status indicator area visible |
| Robot avatar | Idle state, speaking state | Two versions needed |
| Environmental events | Rubbish truck, delivery motorbike, dark sky, cloudy sky, dusk window | Icon scale for map view |
| UI icons | Doorbell, online indicator, done indicator | Functional clarity over style |

#### Room layout map — Figma (not AI-generated)

Top-down floor plan is built in Figma, not generated by AI. AI-generated floor plans have poor room proportion control and unreliable door/window placement.

**Process:**
1. Draw room outlines as rectangles in Figma (30 min)
2. Export room background as transparent-background SVG
3. Place AI-generated object assets as PNG layers on top
4. Export final composite scenes per room as SVGs/PNGs

**Advantage:** Room geometry is precise; individual assets can be swapped or repositioned without regenerating the whole scene; transparent SVG integrates cleanly with React/Tailwind layout.

### 4.4  Visual Layout

**Scheme: 2D top-down floor plan**

Interaction: click room → room expands to fill main area; other rooms shrink to sidebar with status indicators still visible. No movement delay. CSS transition animation gives "walking into room" feel.

```
┌──────────────────────────────────────────┐
│          🌿 Balcony (laundry collection) │
├─────────────────────┬────────────────────┤
│                     │                    │
│  🛋️ Living Room      │  🍳 Kitchen         │
│  (laundry + TV)     │  (steak + medicine) │
│                     │                    │
├─────────────────────┴────────────────────┤
│  🚪 Entrance (visitors + rubbish)  💬 Desk (messages) │
└──────────────────────────────────────────┘
                              🤖 Robot (bottom-right, persistent)
```

### 4.5  Ongoing Task Design

#### Design principle

**Steak task creates sustained pressure; message bubbles provide narrative texture; TV fills idle gaps.** Three roles, no overlap. Deep-thinking games (Wordle) are explicitly excluded: they lock attention into a closed cognitive loop — a half-guessed word creates a completion compulsion that prevents participants from noticing PM triggers. Miss rates would be inflated for reasons unrelated to reminder quality.

#### 🥩 Steak (primary pressure, all blocks, continuous)

Overcooked-style asynchronous timers:
- 2–3 steaks on hobs simultaneously, each with a colour-coded progress bar
- Green zone: leave it; Yellow zone: ready to flip — click to flip (+5 pts); Red zone: must act immediately or burns (−10 pts)
- New steaks spawn randomly every 20–40 seconds; at least 1 steak always active
- Narrative: cooking a lot for the party explains high intensity

**Difficulty calibration:** Last 1 minute of practice phase records baseline score/5s. Sets difficulty (slow/medium/fast) targeting 70–80% attention load for that participant. Fixed for remainder of session.

#### 💬 Message bubbles (secondary task, all blocks, low load)

Replaces Papers Please (excluded: read-then-judge cognitive mode causes high mode-switching cost with steak task, introducing noise).

- Short message (2–3 sentences) appears; select reply A or B within 15 seconds: +2 pts
- No penalty for timeout; bubble disappears
- 3–4 per block; timing controlled by backend to avoid clustering around PM reminders
- Content is narratively consistent (friends asking about the party) but **never involves PM contacts** (Li / Mrs Wang) to prevent PM trigger confusion

#### 📺 Television (idle placeholder, living room, zero load)

- Click TV → short silent animation plays (party-related content)
- Can switch away at any time; no completion compulsion
- Zero cognitive load; does not compete with steak task
- No score; purely a presence-in-room justification and idle gap filler

#### Score display

| What | Displayed? | Rationale |
|---|---|---|
| Ongoing task score (steak + messages) | ✅ Real-time, top bar | Maintains motivation and pressure |
| PM task execution result | ❌ Hidden from participant | Prevents PM tasks becoming score-farming targets; suppresses strategic monitoring |
| Final session score | ✅ At end (ongoing only) | Provides closure; reinforces game frame |

#### Element frequency by block

| Element | B1 | B2 | B3 | B4 | Notes |
|---|---|---|---|---|---|
| 🥩 Steak | ✅ | ✅ | ✅ | ✅ | Always on |
| 💬 Messages | ✅ 3–4× | ✅ 3–4× | ✅ 3–4× | ✅ 3–4× | Never PM contacts |
| 📺 TV | ✅ | ✅ | ✅ | ✅ | Available; no score |
| 🧺 Washing machine / dryer | ❌ standby | ✅ Pair 2 | ❌ standby | ❌ standby | |
| 🌿 Balcony laundry | ❌ | ✅ Pair 2 | ❌ | ❌ | |
| 🍲 Slow cooker | ❌ | ❌ | ❌ | ✅ Pair 4 | |
| 🚪 Mrs Wang (visitor) | ❌ | ❌ | ✅ Pair 3 | ❌ | |
| 📦 Delivery person (fake) | ✅ 1× | ✅ 1× | ✅ 1× | ✅ 1× | Universal fake trigger |
| 🚛 Rubbish truck | ❌ | ❌ | ❌ | ✅ Pair 4 | |

> 📌 Inactive elements (washing machine, slow cooker etc.) show a clearly grey **standby** state outside their active block — no progress bar, no activity. Participant does not feel compelled to monitor them.

### 4.6  Idle Time Fill

**Target: no 30-second window in any block where the participant has nothing to do.**

Guaranteed by:
1. Steak spawn frequency ensures ≥1 active steak at all times
2. t = 4:00–4:30 gap (Task A closes, Task B reminder not yet): new steak batch auto-spawned at t = 4:00
3. t = 7:00–8:30 gap (Task B closes, block ending): final steak batch spawned at t = 7:00; participant clears it before block ends
4. Message bubble timing backend-controlled to fill steak lulls without clustering near PM events

### 4.7  Room Specifications

#### 🍳 Kitchen (primary activity zone, always active)

| Element | Function | Active when |
|---|---|---|
| Hobs (2–3) + steak progress bars | Primary ongoing task | All blocks |
| Colour progress bar system | Visual urgency signal | All blocks |
| Medicine cabinet | Tasks A & B execution UI | Trigger fires |
| Slow cooker | Task G trigger | Pair 4 block only |
| Coffee machine | Task B trigger | Pair 1 block only |

#### 🛋️ Living Room (secondary zone)

| Element | Function | Active when |
|---|---|---|
| Washing machine / dryer / drying rack | Task C execution UI | Pair 2 block |
| Television | Idle placeholder | All blocks |
| Window | Dusk light change visible | Pair 2 block (Task D trigger) |

#### 🌿 Balcony (trigger zone)

| Element | Function | Active when |
|---|---|---|
| Drying rack (shirt + towel) | Task D execution UI | Pair 2 block |
| Outside background | Day → dusk transition (trigger) | Pair 2 block |

#### 🚪 Entrance (event zone)

| Element | Function | Active when |
|---|---|---|
| Doorbell | Visitor trigger | Pair 3 block |
| Mrs Wang | Task F execution UI | Pair 3 block |
| Delivery person | Fake trigger | Each block 1× |
| Rubbish bags (blue + green) | Task H execution UI | Pair 4 block |
| Outside window | Rubbish truck (Task H trigger) | Pair 4 block |

#### 💬 Desk / Message area (low-load zone)

| Element | Function | Active when |
|---|---|---|
| Contact list | Task E trigger + execution UI | Pair 3 block |
| Message bubbles | Secondary ongoing task | All blocks |

### 4.8  Experimenter Dashboard (/admin)

The dashboard is a second frontend page connected to the same FastAPI backend. Experimenter opens it on their own device; participant runs the game on the experiment device. Both devices on the same LAN → fully synchronised via SSE.

**Read-only monitoring panel (Week 1 priority):**

```
┌──────────────────────────────────────────────────┐
│  Participant: P012   Group: B   Block: 2 / 4      │
│  Condition: HighAF_LowCB   Elapsed: 03:42         │
├─────────────────────────┬────────────────────────┤
│  Block Timeline         │  PM Status              │
│  [==========>    ]      │  Task A: ✅ Correct      │
│  ✓ Encoding confirmed   │  Task B: ⏳ Reminder sent │
│  ✓ Fake trigger shown   │                         │
│  ✓ Reminder A fired     │  Ongoing Score          │
│  ✓ Trigger A appeared   │  ████████░░ 84 pts      │
│  ⏳ Reminder B pending   │  Baseline: 9.2 pts/5s   │
├─────────────────────────┴────────────────────────┤
│  [🔴 Invalidate Trial]  [⏸ Pause]  [▶ Force Remind] │
└──────────────────────────────────────────────────┘
```

**Emergency controls (Week 3 priority):**

| Control | Use case |
|---|---|
| Invalidate Trial | Participant visibly distracted; mark trial as low-quality |
| Pause | Technical issue; freeze all timers |
| Force Remind | TTS failed; manually trigger robot reminder |
| Skip to next block | Unrecoverable block error |
| Mark session complete | Participant cannot continue |

**Implementation:** `/admin` React route; reads same SQLite via FastAPI; receives same SSE stream as participant frontend. No additional backend infrastructure required.

### 4.9  Rapid Prototype Scope

**Goal:** Validate all core mechanisms with minimum viable implementation before building the full 4-block system.

**Prototype includes (approximately 30% of full system code, exposes ~90% of problems):**

| Component | Prototype spec |
|---|---|
| Backend | FastAPI + SQLite; SSE timing for 1 block; single hardcoded condition (HH); Latin Square stub (no real counterbalancing yet) |
| Frontend | Laptop layout (1280×800 target); 5-room top-down view; click-to-expand for kitchen only (other rooms static placeholders) |
| Ongoing task | Steak task fully playable; colour progress bar; score display; 2 steaks concurrent |
| PM task | Medicine pair only (Task A + Task B); distractor logic; 0/1/2 scoring; execution window |
| Robot | On-screen avatar; Pepper API **mocked** (stub logs text, no physical robot); reminder fires via SSE |
| Audio | Pepper native TTS via mock; placeholder text for reminder content |
| Dashboard | /admin read-only: block state, PM status, ongoing score — no controls yet |
| Fake trigger | 1 fake trigger (delivery person) |
| Encoding | Task cards + oral confirmation prompt + single-choice quiz |

**Prototype excludes:**
- Blocks 2–4 and task pairs 2–4
- Latin Square counterbalancing
- Full questionnaire
- Dashboard emergency controls
- Practice phase (replaced by "start immediately" for testing)
- Pre-generated audio files (uses mock TTS)

**Prototype success criteria (before expanding to full system):**
1. SSE timing fires at correct intervals (±5s acceptable for prototype)
2. Steak task creates genuine attention competition — tester cannot casually monitor screen
3. PM execution window opens/closes correctly; scoring logs to SQLite
4. Fake trigger does not confuse tester about PM task expectations
5. Dashboard shows live state without lag

---

### 5.1  Narrative Framing

Robot is a context-aware home assistant — observes activity via camera/sensors (stated in onboarding), speaks throughout the session (reminders and neutral comments mixed, indistinguishable to participant), and announces visitor arrivals ("Someone's at the door") to maintain consistent role as perceptual mediator.

### 5.2  Robot Behavior Model

| Utterance type | Frequency per block | Examples |
|---|---|---|
| Neutral comment | 2–3× | "Smells good in the kitchen." / "How's the party prep going?" |
| Contextual observation | 1–2× | "The washing machine's been going for a while." |
| **PM reminder** | **2× (A + B)** | See §2.9 condition texts |

All utterance types use identical avatar animation. Participant cannot predict reminder from visual cues alone. Neutral utterances in practice phase establish the baseline expectation that robot speaks unpredictably.

### 5.3  Visitor Mechanism

Mrs Wang (Task F trigger) is a single visual event at the door — no extended dialogue. Delivery person (fake trigger) is identical in appearance category. Both announced by robot ("Someone's at the door") to maintain robot-as-mediator consistency. Single click to interact; no multi-step conversation task.

### 5.4  Reminder vs. Instruction

*See §1.5 for full analysis. Three design mechanisms partially address the concern; full theoretical resolution depends on OQ-7.*

1. **Temporal gap** — reminder fires before trigger; participant cannot act immediately; steak task demands continued attention
2. **Retention interval** — participant maintains intention while engaged with ongoing task; this is the PM cognitive process being studied
3. **Event-based trigger** — trigger timing is not announced; participant must notice it themselves

---

## 6  Risks & Mitigations

| Risk | Priority | Mitigation |
|---|---|---|
| Reminder = Instruction (theoretical attack) | **P1** | Resolved via Guynn (1998) associative link mechanism (§1.5); Option C phrasing adopted; supervisor confirmation recommended (OQ-7) |
| AF manipulation fails (Low AF still works) | **P0** | Confusable distractor in every task; pilot specifically tests Low AF error rate |
| Participant learns "robot speaks = PM incoming" | **P0** | Neutral utterance rate ≥ reminder rate; identical avatar animation; practice builds expectation |
| Participant learns "event = PM task" | **P0** | 1 fake trigger per block, before Reminder A; neutral system response to false alarms |
| Task pair difficulty confounds condition effect | **P1** | Structurally parallel pair design; Latin Square balances pair × condition; pilot tests task_pair main effect |
| Learning effect pollutes CSC | **P1** | Per-block baseline computation (§3.2) |
| Strategic monitoring (later blocks) | **P1** | PM score hidden; strategy use item as post-hoc covariate |
| Low-attention trials | **P1** | Attention flag mechanism (§3.3); sensitivity analysis with flagged trials excluded |
| Touch vs mouse interaction difference | **P1** | Fix single device for all participants (§4.1) |
| TTS voice quality or failure | **P1** | Dashboard "Force Remind" fallback; pilot tests TTS reliability |
| Robot = speaker objection | **P1** | Contextual observation utterances demonstrate perception; High CB Detected_Activity is direct evidence |
| Within-subjects order effects | **P1** | Latin Square counterbalancing; block order as covariate if needed |
| Idle time → reduced task load | **P2** | Steak spawn schedule fills all 30-second windows (§4.6) |
| Wordle-type game locks attention | Excluded | Deep-thinking games explicitly excluded (§4.5); TV used as idle placeholder instead |

---

## 7  Data Schema

### 7.1  Per-PM-Trial (8 rows per participant)

| Field | Type | Description |
|---|---|---|
| `participant_id` | string | Anonymised |
| `session_id` | string | |
| `block_number` | int 1–4 | |
| `task_slot` | string A/B | First or second PM task in block |
| `task_pair_id` | int 1–4 | Blocking factor |
| `task_id` | string | medicine_a, medicine_b, laundry_c, laundry_d, comm_e, comm_f, chores_g, chores_h |
| `condition` | string | LowAF_LowCB / HighAF_LowCB / LowAF_HighCB / HighAF_HighCB |
| `participant_group` | string A/B/C/D | Latin Square group |
| `encoding_confirmed_at` | timestamp ms | |
| `encoding_quiz_attempts` | int | Number of attempts before passing |
| `reminder_played_at` | timestamp ms | |
| `target_appeared_at` | timestamp ms | |
| `pm_action_taken` | string | null or structured action description |
| `pm_score` | int 0/1/2 | |
| `ongoing_score_baseline` | float | Mean score/5s before reminder, within block |
| `ongoing_score_window` | float | Mean score/5s in ±30s around reminder |
| `attention_flag` | boolean | True if window score < 50% of baseline |

### 7.2  Per-Fake-Trigger (up to 4 rows per participant)

| Field | Type |
|---|---|
| `fake_trigger_id` | string |
| `fake_trigger_appeared_at` | timestamp ms |
| `participant_response` | string (null / clicked_report / interacted) |
| `false_alarm` | boolean |

### 7.3  Per-Block (4 rows per participant)

| Field | Type |
|---|---|
| `perceived_intrusiveness` | int 1–7 |
| `perceived_helpfulness` | int 1–7 |
| `block_ongoing_score_total` | float |
| `open_comment` | string |

### 7.4  Per-Session (1 row per participant)

| Field | Type |
|---|---|
| `mse_pre` / `mse_post` | float |
| `strategy_use` | int 1–5 |
| `latin_square_group` | string A/B/C/D |
| `difficulty_assigned` | string slow/medium/fast |
| `session_date` | ISO date |
| `completion_flag` | boolean |
| `experimenter_notes` | string |

---

## 8  Development Milestones

| Sprint | Target | Acceptance Criteria |
|---|---|---|
| Week 1 | Backend core | FastAPI + SQLite; Latin Square; SSE (incl. force_yellow_steak, fake_trigger_fire); all API endpoints callable |
| Week 1 | Frontend shell + Dashboard (read-only) | React + Vite; 5-room top-down layout; click-to-expand interaction; SSE events update UI; /admin shows live block state |
| Week 2 | Steak task MVP | Fully playable; colour progress bar system; score real-time display; difficulty calibration working |
| Week 2 | Full ongoing tasks | Message bubbles; TV placeholder; all rooms switchable; standby states visible for inactive elements |
| Week 3 | PM + Robot MVP | 1 complete block end-to-end: encoding quiz → neutral utterances → forced yellow steak → reminder → trigger → execution → scoring logged |
| Week 3 | All 8 PM tasks | All tasks with distractor logic; visitor mechanism; fake triggers with neutral system response; 0/1/2 scoring complete |
| Week 4 | Full experiment flow | Onboarding → Practice → 4 Blocks → Questionnaire; Latin Square live; CB text fixed strings firing correctly; CSV export validated |
| Week 4 | Dashboard emergency controls | Invalidate, Pause, Force Remind, Skip all functional |
| Week 4 | **Pilot test (hard gate)** | ① Low AF error rate > High AF ② Strategy use score < 3 (mean) ③ task_pair main effect p > .10 ④ Timing accuracy ±10 s ⑤ No crashes ⑥ TTS fires reliably |
| Week 5 | Data collection | Recruit n = 32; target n = 28 valid completions |

---

## 9  Open Questions

| ID | Priority | Topic | Status / Question |
|---|---|---|---|
| ~~OQ-6~~ | ~~P0~~ | ~~Reminder–trigger interval~~ | ✅ **CLOSED** — Guynn et al. (1998) Exp 2: no significant effect of 1-min vs 6-min delay. 1.5-min interval justified. |
| ~~OQ-1~~ | ~~P1~~ | ~~Robot modality + TTS~~ | ✅ **PARTIALLY CLOSED** — Pepper confirmed; API already working; prototype uses mock. Two-track audio: native TTS for neutral utterances, pre-generated files for PM reminders. |
| **OQ-R** | 🔴 **P0** | **Reminder agent text output** | **Critical path.** Prototype needs ≥1 task pair's texts (4 variants). Full system needs all 32 variants finalised before audio pre-generation. Text changes after audio generation require re-recording. |
| **OQ-7** | 🟡 **P1** | Theoretical framing + reminder phrasing | Option C phrasing adopted. Confirm with supervisor: texts acceptable; PM-focused frame stays. Not a development blocker. |
| **OQ-8** | 🟡 **P1** | Device selection | Developing on laptop first. iPad adaptation deferred. Confirm final device before data collection begins. |
| OQ-3 | 🟡 P1 | Encoding context in AF | High AF includes encoding source ("cardiologist prescribed"). Confirm pattern applies across all 4 task pairs — feeds reminder agent design. |
| OQ-4 | 🟡 P1 | Fake trigger count | Currently 1 per block. Confirm whether any blocks need a second. |
| OQ-2 | 🟢 P2 | Ongoing task difficulty | Fixed after practice calibration vs dynamic. Current design: fixed. |
| OQ-5 | 🟢 P2 | Participant briefing text | Onboarding script needs writing in English. Required before data collection. |
