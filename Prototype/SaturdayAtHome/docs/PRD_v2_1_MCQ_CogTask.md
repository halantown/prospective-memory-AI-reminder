# PRODUCT REQUIREMENTS DOCUMENT
## Context-Aware Robot Reminder
### Experimental Platform for Prospective Memory Study

| | |
|---|---|
| **Version** | v2.1 — MCQ execution + cognitive task paradigm + sidebar architecture |
| **Date** | 2026-03-17 |
| **Author** | Thesis Candidate |
| **Status** | 🟡 Pending supervisor confirmation on paradigm direction |

### Changelog v2.0 → v2.1

| Area | Change | Rationale |
|---|---|---|
| Ongoing tasks | Life-simulation activities → Literature-validated cognitive tasks with life-scene skins | Controllable cognitive load with ecological validity packaging |
| PM execution | Navigate + visual target selection + 2-step action → Self-initiated MCQ | Simpler, cleaner AF manipulation; eliminates visual asset dependencies |
| PM trigger | System-controlled narrative events → Sidebar visual/audio cues requiring self-detection | Preserves prospective component of PM |
| Visual layout | Full room scenes → Main panel (game) + Sidebar (character state, mini-map, triggers) | Honest about what the interaction actually is; sidebar provides narrative and CB anchor |
| Block structure | Single ongoing task per block → 3 games per block (Game A + Game B + Game C buffer) | Each PM task's retention interval stays within one game; variety reduces fatigue |
| LLM role | Runtime generation with cache fallback → Pre-generate + validate + freeze; demo shows capability | Experimental control priority; system contribution shown via independent demonstration |
| Game variety | Different tasks per block → Same cognitive structure, different visual themes (skin-swap) | Controls cognitive load while preventing visual monotony |

---

## 1  Overview

### 1.1  Purpose

A browser-based experimental platform for a 2×2 within-subjects study on how robot reminder content design affects Prospective Memory (PM) performance and user experience.

**Independent variables:**
- **Associative Fidelity (AF)** — match between reminder content and participant's original memory encoding
- **Contextual Bridging (CB)** — whether the robot acknowledges the participant's current activity before delivering the reminder

### 1.2  Research Questions

- **RQ1:** How does Contextual Bridging affect perceived intrusiveness of robot reminder interruptions?
- **RQ2:** How does Associative Fidelity affect PM task execution accuracy?
- **RQ3:** How do CB and AF jointly influence PM performance and user experience?

### 1.3  Core Design Principles

> **Principle 1: Low AF must produce genuine execution errors.**
> PM tasks use MCQ format with plausible distractors. Low AF reminders provide insufficient information to distinguish the correct option. High AF reminders provide the critical detail.

> **Principle 2: PM must remain prospective, not cued recall.**
> Triggers appear in the sidebar as ambient changes. The participant must self-detect the trigger and self-initiate action. The system never forces PM execution UI onto the participant.

> **Principle 3: Cognitive load must be literature-grounded and controllable.**
> Ongoing tasks are established cognitive paradigms (Semantic Categorization, Go/No-Go) wrapped in daily-life visual themes. Load levels are known from published research, not estimated from gameplay.

> **Principle 4: Reminder must interrupt active cognition, not rest.**
> Both AF and CB depend on the participant's cognitive resources being occupied at the time of reminder delivery and throughout the retention interval. Reminders never fire during low-load buffer periods.

### 1.4  Theoretical Grounding

**PM framework:**
- **Ellis (1996)** — PM five-stage lifecycle. Reminder operates in Phase B (retention — re-boosting activation), not Phase A (encoding). Marker concept: reminder tags an upcoming event as action-relevant.
- **McDaniel & Einstein (2000) Multiprocess Framework** — reflexive-associative vs. strategic monitoring; AF operationalises associative link specificity.
- **Altmann & Trafton (2002) Goal Activation Model** — intentions require periodic reactivation; CB preamble serves as alerting cue providing WM time to save current task state.

**Reminder mechanism:**
- **Guynn, McDaniel & Einstein (1998)** — reminders including both target event AND intended action are most effective; Experiment 2: null effect of 1-min vs 6-min delay; justifies AF manipulation and 90s retention interval.
- **Tulving & Thomson (1973)** — encoding specificity principle; theoretical basis for AF.
- **Henry et al. (2012)** — experimenter-initiated reminders in ongoing-task paradigm; legitimacy of externally pushed reminders.

**Ongoing task paradigms:**
- **Semantic Categorization Task** — established paradigm for sustained semantic processing; moderate-to-high cognitive load; well-documented in attention and dual-task literature.
- **Go/No-Go Task** — established paradigm for response inhibition; moderate cognitive load; requires sustained attention and rule maintenance.
- **Clark & Brennan (1991)** — grounding in communication; theoretical basis for CB (situational common ground).

### 1.5  Reminder vs. Instruction — Resolved

Reminder operates in Ellis Phase B (retention). Participant has already encoded the intention (confirmed by quiz). Reminder re-boosts existing associative link; no new information introduced. Guynn et al. (1998) Exp 2: null delay effect confirms associative link mechanism.

Three distinguishing design features:
1. Encoding precedes reminder (quiz-confirmed)
2. Reminder content ⊆ encoding content (no new information)
3. Trigger timing unknown to participant

### 1.6  Complete Theoretical Chain

```
ENCODING (Ellis Phase A)
  Participant forms intention via task card + quiz confirmation:
  "When [TRIGGER EVENT] happens, I need to [ACTION + SPECIFIC DETAILS]"

        ↓

RETENTION INTERVAL — cognitive task occupies attention (~90s)

  Robot delivers reminder (Ellis Phase B — re-boost)
  ┌─────────────────────────────────────────────────────┐
  │  CB acts HERE (at reminder delivery)                 │
  │  HIGH CB: "Quick pause from sorting those emails —"  │
  │  → Alerting cue; WM saves current task state         │
  │  → Robot perceived as aware social agent              │
  │  → Reminder content processed more fully              │
  │                                                      │
  │  LOW CB: direct delivery, no preamble                │
  │  → Abrupt interruption; higher switching cost         │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │  AF content delivered HERE — carried through interval │
  │  HIGH AF: "...find the red round bottle of            │
  │   Doxycycline on the left side of the cabinet"       │
  │  → Detailed associative link re-activated             │
  │                                                      │
  │  LOW AF: "...take your medicine"                     │
  │  → Only generic link re-activated                     │
  └─────────────────────────────────────────────────────┘

  Ongoing cognitive task continues → AF content suppressed by task demands

        ↓  ~90s

TRIGGER APPEARS (in sidebar — ambient cue)
  Participant must SELF-DETECT trigger (prospective component)
  If detected → participant clicks sidebar to initiate action
  
  AF acts HERE — link specificity determines MCQ performance
  HIGH AF → remembers specific detail → selects correct option  → Score 2
  LOW AF  → remembers task but not detail → guesses among options → Score 1
  Not detected or not acted on                                   → Score 0
```

**Predicted pattern:**

| Outcome | AF effect | CB effect | AF × CB |
|---|---|---|---|
| PM Accuracy (0/1/2) | **Strong** — link specificity → correct MCQ choice | Weak/null — CB doesn't change link content | Weak — different mechanisms; exploratory: low CB may suppress AF via poor reminder processing |
| Perceived Intrusiveness | Null | **Strong** — CB reduces disruption | Possible |
| Perceived Helpfulness | Moderate | **Strong** | Possible |

---

## 2  Experiment Design

### 2.1  Storyline

> It's Saturday morning. You woke up at 10 AM. You have a relaxed but busy day ahead — catching up on emails, doing some online grocery shopping, tidying up around the house, and a friend is coming over later. Your robot assistant Pepper is around the house with you.

The day unfolds across 4 blocks. Each block represents a segment of the day. The participant sees their avatar move through the house in the sidebar, while the main panel displays the current ongoing task.

### 2.2  Session Structure

| Phase | Duration | Description |
|---|---|---|
| Onboarding | 3 min | Explain: day simulation, robot speaks throughout (comments + reminders mixed), you'll be given things to remember, sidebar shows triggers — you need to notice them yourself |
| Practice | 5 min | 1 mini-block: play each game type briefly; robot makes neutral comments; no PM tasks; practice noticing sidebar events |
| Block 1–4 | ~8.5 min × 4 | Per-block encoding (60s for 2 tasks) before each block |
| Block questionnaire | ~1 min × 4 | 2 Likert items after each block |
| Final Questionnaire | 5 min | MSE scale + open feedback + strategy use |
| **Total** | **~52 min** | |

### 2.3  Sample Size

**n = 28** (G*Power). Recruit **n = 32** for dropout buffer.

Latin Square: 4 groups × ~8 participants each.

### 2.4  Per-Block Encoding & Confirmation

**Encoding procedure (~30 seconds per PM task, 2 tasks per block = ~60s total):**

1. Screen displays PM task instruction card:
   - Text: "When you hear/see [TRIGGER], you need to [FULL ACTION WITH DETAILS]"
   - Image: the relevant objects/scene (e.g., picture of two similar medicine bottles with labels)
2. Participant reads the card
3. Single-choice verification question (e.g., "Which bottle should you take — the round one or the square one?")
4. Must answer correctly to proceed

**After confirmation:** Cards removed. No external reference available for rest of block.

**Critical constraint:** Encoding card content is the ceiling of what any reminder can contain. High AF reminder ⊆ encoding card. Low AF reminder ⊂ encoding card.

### 2.5  Block Structure

Each block contains 3 game segments and 2 PM tasks:

```
Block start (after encoding)

├─ 0:00    [Transition] Avatar walks to Room A; sidebar updates
│          "10:30 AM — Time to sort through those emails"
│
├─ 0:00-3:00   GAME A — Semantic Categorization (skin: email sorting)
│                 Ongoing task runs continuously
│    1:00        🤖 Robot Reminder 1 (interrupts Game A)
│    1:00-2:30   Retention interval (Game A continues)
│    2:30        🎯 Trigger 1 appears in SIDEBAR
│                 (visual change + non-specific "ding" sound)
│                 30s execution window: participant must self-detect,
│                 click sidebar trigger, then answer MCQ
│    3:00        Window closes; backend logs score
│
├─ 3:00-3:30   [Transition] Avatar walks to Room B
│              "11:15 AM — Need to order some groceries online"
│
├─ 3:30-6:30   GAME B — Go/No-Go (skin: online grocery shopping)
│                 Ongoing task runs continuously
│    4:30        🤖 Robot Reminder 2 (interrupts Game B)
│    4:30-6:00   Retention interval (Game B continues)
│    6:00        🎯 Trigger 2 appears in SIDEBAR
│                 30s execution window
│    6:30        Window closes; backend logs score
│
├─ 6:30-7:00   [Transition] Avatar walks to Room C
│              "12:00 PM — Quick break, listen to some news"
│
├─ 7:00-8:00   GAME C — Light task (skin: podcast quiz / trivia)
│              No PM tasks. Robot may make 1 neutral comment.
│              Cognitive palate cleanser.
│
├─ 8:00        [Transition] Day segment ends
│
└─ 8:30        Block ends → 2 Likert items → 30s rest
```

**Key timing constraints:**
- Reminder-to-trigger: 90s (within same game segment)
- Execution window: 30s
- Each game segment: ~3 min
- Retention interval fully contained within one ongoing task — no game switching during interval

### 2.6  Ongoing Task Design — Cognitive Paradigms with Life Skins

#### Design Philosophy

Each ongoing task is a **published cognitive paradigm** re-skinned as a daily activity. The cognitive mechanism is identical across blocks; only the visual theme changes.

#### Game Type A — Semantic Categorization

**Cognitive mechanism:** Rapid semantic judgment and categorization. Participant reads a stimulus, classifies it into one of 2–3 categories. Moderate-to-high cognitive load through sustained semantic processing.

**Life skins (one per block):**

| Block | Skin | Stimuli | Categories |
|---|---|---|---|
| 1 | Email sorting | Email subject lines + preview | Work (archive) / Personal (keep) / Spam (delete) |
| 2 | Photo organizing | Photo descriptions | Family / Travel / Delete |
| 3 | Bookshelf sorting | Book titles + short descriptions | Keep / Donate / Store |
| 4 | Fridge cleanup | Food items + dates | Keep / Throw away / Freeze |

**Mechanics (identical across skins):**
- Item appears every 3–4 seconds
- Participant clicks one of 2–3 category buttons
- Correct categorization: item sorts with satisfying animation
- Wrong categorization: brief "hmm" feedback, item re-appears once
- No score display; no penalty; engagement through steady decision stream
- ~50–60 items per 3-minute segment

**Cognitive load is controlled because:** item presentation rate is fixed; categorization complexity is equivalent across skins (all are 2–3 category semantic judgments); decision time per item is similar.

#### Game Type B — Go/No-Go

**Cognitive mechanism:** Response inhibition. Items appear; participant must respond to target category (Go) and withhold response to non-target category (No-Go). Moderate cognitive load through sustained vigilance and inhibitory control.

**Life skins (one per block):**

| Block | Skin | Go items | No-Go items |
|---|---|---|---|
| 1 | Online grocery shopping | Vegetables & fruits | Snacks & sweets |
| 2 | Laundry sorting | Colored clothes (wash) | Whites (separate pile) |
| 3 | Recycling | Recyclable items (bin them) | Non-recyclable (skip) |
| 4 | Wardrobe declutter | Old/worn items (donate) | Good condition (keep) |

**Mechanics (identical across skins):**
- Item appears every 2–3 seconds
- Go: click/tap the item (it moves to target area)
- No-Go: do nothing (item passes by after 2s)
- Go/No-Go ratio: approximately 70/30 (standard)
- ~60–80 items per 3-minute segment
- No score display; engagement through rhythm and inhibition challenge

**Cognitive load is controlled because:** presentation rate fixed; Go/No-Go ratio fixed; discrimination difficulty equivalent across skins.

#### Game Type C — Light Buffer Task

**Purpose:** Cognitive palate cleanser between blocks' PM-heavy segments. Low load. No PM tasks embedded.

**Skins:** Podcast true/false quiz, short news headlines to rate as interesting/boring, simple spot-the-difference on household images.

**Mechanics:** One item every 5–8 seconds. Binary response. No time pressure. ~10–15 items per minute.

### 2.7  Skin-Swap Verification

All skins within a game type must be verified as cognitively equivalent:

| Property | Must be equal across skins |
|---|---|
| Item presentation rate | ±0.5s |
| Number of categories / Go-NoGo ratio | Identical |
| Semantic difficulty of categorization | Comparable (pilot-verify with 3–5 testers) |
| Visual complexity of items | Comparable (text-based or simple icons; no complex images) |

**Pre-pilot checklist:** Run each skin for 3 minutes with 3 testers. Compare mean response time and accuracy. If any skin deviates >15% from the mean, adjust difficulty (simplify categories or slow presentation rate).

### 2.8  Latin Square Design

Task pairs assigned to fixed block positions. Conditions rotate via Latin Square.

| Group | Block 1 (PM 1+2) | Block 2 (PM 3+4) | Block 3 (PM 5+6) | Block 4 (PM 7+8) |
|---|---|---|---|---|
| A (n≈8) | Low AF · Low CB | High AF · Low CB | Low AF · High CB | High AF · High CB |
| B (n≈8) | High AF · Low CB | High AF · High CB | Low AF · Low CB | Low AF · High CB |
| C (n≈8) | Low AF · High CB | Low AF · Low CB | High AF · High CB | High AF · Low CB |
| D (n≈8) | High AF · High CB | Low AF · High CB | High AF · Low CB | Low AF · Low CB |

Both PM tasks within a block receive the **same condition**. This simplifies the design and ensures the block-level Likert ratings (intrusiveness, helpfulness) correspond to a single condition.

### 2.9  Conditions — 2×2 Design

#### AF Manipulation

| Level | What the reminder contains | What it omits |
|---|---|---|
| **Low AF** | Action verb + generic target category | All distinguishing details (color, shape, location, name, specific steps) |
| **High AF** | Action verb + specific target name + visual/perceptual cues + specific steps | Nothing — includes all details from encoding card |

**Word count control:**
- Low AF: ≤15 words of reminder content
- High AF: ≤35 words of reminder content
- CB preamble (when present): ≤12 words, not counted toward reminder content

#### CB Manipulation

| Level | Preamble | Mechanism |
|---|---|---|
| **Low CB** | None. Reminder starts directly. | Abrupt interruption during ongoing task |
| **High CB** | One sentence acknowledging current activity (generated by LLM, pre-validated) | Alerting cue → WM saves task state → smoother transition → reminder processed more fully |

**CB preamble references the current game skin, not the cognitive mechanism.** "Quick pause from sorting those emails" (not "Quick pause from that categorization task"). The sidebar confirms the participant is indeed "sorting emails," making the preamble credible.

#### Reminder Generation Pipeline

**Pre-experiment workflow:**

```
Step 1: For each PM task (8) × each condition (4) × each possible 
        current activity at reminder time (known from timeline):
        → Feed task JSON + condition rules + activity label into LLM prompt
        → Generate reminder text

Step 2: Two independent raters verify each of 32 variants:
        □ Low AF contains ONLY action + generic target
        □ High AF contains ALL required detail fields
        □ CB preamble accurately references the scheduled activity
        □ No information beyond encoding card content
        □ Word count within limits
        □ Tone is casual and non-urgent

Step 3: Revise and re-generate any that fail validation

Step 4: Freeze approved set → load into experiment backend as lookup table
```

**During experiment:** Backend looks up the pre-validated reminder for (task_id, condition, current_activity). No runtime LLM calls. No risk of rule violation.

**System capability demonstration (separate from experiment):**
- Appendix / system chapter includes: given an arbitrary task JSON + arbitrary game state + condition label → LLM generates compliant reminder
- Shows generalizability: rules transfer to new tasks and new contexts
- This is the "context-aware" contribution — the system can do it; the experiment uses frozen outputs for control

#### Condition Examples (Medicine PM Task)

Context: Participant is sorting emails (Game A, Block 1) when reminder fires.

| Condition | Reminder Text |
|---|---|
| **Low AF · Low CB** | "Remember, you need to take your medicine later today." |
| **High AF · Low CB** | "Remember, after dinner take the Doxycycline — the red round bottle on the left side of the cabinet. Glass of water first, then one tablet." |
| **Low AF · High CB** | "Quick pause from those emails — remember, you need to take your medicine later today." |
| **High AF · High CB** | "Quick pause from those emails — after dinner, take the Doxycycline from the red round bottle on the left of the cabinet. Water first, one tablet." |

### 2.10  PM Tasks — Self-Initiated MCQ Format

#### Execution Flow

```
1. TRIGGER EVENT appears in SIDEBAR
   (visual change + non-specific "ding" sound)
   Examples: washing machine icon stops spinning,
             doorbell icon pulses, clock shows target time
   
2. PARTICIPANT NOTICES (prospective component)
   If participant is absorbed in ongoing task, they may miss it
   → 30-second window; if no action → Score 0

3. PARTICIPANT CLICKS the sidebar trigger element
   This is the self-initiated action (PM criterion)
   Main game panel dims; MCQ overlay appears

4. MCQ APPEARS (3 options — one correct, two plausible distractors)
   Participant selects one option
   
5. SCORING
   Score 0 = Did not click trigger within 30s (prospective failure)
   Score 1 = Clicked trigger but selected wrong MCQ option (retrospective failure)
   Score 2 = Clicked trigger and selected correct option (full success)

6. MCQ CLOSES
   Main game panel resumes; ongoing task continues
```

**Critical:** The MCQ never appears unless the participant clicks the sidebar trigger. The system never forces the PM execution UI. This preserves the self-initiated nature of PM.

#### PM Task Catalogue

**Design constraints for all tasks:**
- MCQ has exactly 3 options
- All 3 options are plausible actions for the trigger context
- Only 1 option matches the specific details from encoding
- Low AF reminder is compatible with all 3 options (no distinguishing info)
- High AF reminder uniquely identifies the correct option

---

**PM Task 1 — Take Medicine** (Block 1, Game A segment)

| | |
|---|---|
| Encoding | "After dinner, take your Doxycycline — the red round bottle on the LEFT side of the medicine cabinet. Pour a glass of water first, then take one tablet." + image of two bottles |
| Sidebar trigger | 🍽️ Dinner table icon appears in sidebar + "ding" |
| MCQ | A. Take the red square bottle from the right side → pour water → take one tablet |
| | B. Take the red round bottle from the left side → pour water → take one tablet ✅ |
| | C. Take the red round bottle from the left side → take one tablet directly (no water) |
| Low AF | "Remember to take your medicine later." → all 3 plausible |
| High AF | "...red round bottle, left side, water first, one tablet" → only B |

---

**PM Task 2 — Prepare Tea for Friend** (Block 1, Game B segment)

| | |
|---|---|
| Encoding | "Your friend is coming over. Prepare Longjing tea — it's in the green tin on the TOP shelf. Boil water first, then steep for 3 minutes." + image of two tins |
| Sidebar trigger | 📱 Phone notification icon pulses in sidebar + "ding" ("Friend: I'm 10 min away") |
| MCQ | A. Get the green tin from the bottom shelf (Biluochun) → boil water → steep 3 min |
| | B. Get the green tin from the top shelf (Longjing) → steep with room-temp water for 5 min |
| | C. Get the green tin from the top shelf (Longjing) → boil water → steep 3 min ✅ |
| Low AF | "Remember to make tea for your friend." → all 3 plausible |
| High AF | "...Longjing in the green tin, top shelf, boil water, steep 3 minutes" → only C |

---

**PM Task 3 — Handle Laundry** (Block 2, Game A segment)

| | |
|---|---|
| Encoding | "When the washing machine finishes, take out the DARK clothes and hang them to dry SEPARATELY. Leave the whites in for an extra rinse cycle." + image of mixed laundry |
| Sidebar trigger | 🫧 Washing machine icon stops spinning + "ding" |
| MCQ | A. Take out all clothes → hang everything together |
| | B. Take out the dark clothes → hang separately; leave whites for extra rinse ✅ |
| | C. Take out the whites → hang to dry; leave darks for extra rinse |
| Low AF | "Remember to deal with the laundry when it's done." → all 3 plausible |
| High AF | "...take out the dark clothes, hang them separately, leave the whites for an extra rinse" → only B |

---

**PM Task 4 — Return Book to Neighbor** (Block 2, Game B segment)

| | |
|---|---|
| Encoding | "Neighbor Chen is stopping by today. Return '三体' (The Three-Body Problem) — it has a DARK BLUE cover with a planet on it. Put it in a gift bag first, then hand it to him." + image of two books |
| Sidebar trigger | 🔔 Doorbell icon pulses + "ding" |
| MCQ | A. Grab the dark blue book with the planet (三体) → hand directly to neighbor |
| | B. Grab the light blue book with the rocket (人类简史) → put in gift bag → hand to neighbor |
| | C. Grab the dark blue book with the planet (三体) → put in gift bag → hand to neighbor ✅ |
| Low AF | "Remember, your neighbor is coming to pick something up." → all 3 plausible |
| High AF | "...return 三体, the dark blue cover with the planet, put it in a gift bag first" → only C |

---

**PM Task 5 — Turn Off Pressure Cooker** (Block 3, Game A segment)

| | |
|---|---|
| Encoding | "The pressure cooker is making stew. When the timer goes off, first RELEASE THE VALVE to let out steam, then open the lid. It's the pot with the SILVER handle on the LEFT burner." + image of two pots |
| Sidebar trigger | ⏲️ Kitchen timer icon flashes + "ding" |
| MCQ | A. Open the lid of the silver-handle pot (left) directly |
| | B. Release valve on the black-handle pot (right) → open lid |
| | C. Release valve on the silver-handle pot (left) → open lid ✅ |
| Low AF | "Remember to deal with the pot on the stove." → all 3 plausible |
| High AF | "...silver handle, left burner, release valve first, then open lid" → only C |

---

**PM Task 6 — Prepare Umbrella for Friend** (Block 3, Game B segment)

| | |
|---|---|
| Encoding | "Rain is forecast for tomorrow. Get the BLUE FOLDING umbrella from the hallway closet — open it to CHECK FOR DAMAGE first, then leave it by the front door." + image of two umbrellas |
| Sidebar trigger | 📺 TV icon flashes weather symbol + "ding" ("Rain expected") |
| MCQ | A. Get the blue long umbrella → place by front door |
| | B. Get the blue folding umbrella → place by front door directly |
| | C. Get the blue folding umbrella → open to check for damage → place by front door ✅ |
| Low AF | "Remember to get an umbrella ready for your friend." → all 3 plausible |
| High AF | "...blue folding umbrella, open it to check for damage first, then by the door" → only C |

---

**PM Task 7 — Record TV Show** (Block 4, Game A segment)

| | |
|---|---|
| Encoding | "Your mum asked you to record a show. It's on CHANNEL 5 — the documentary 'Blue Planet.' Switch to Channel 5 FIRST, then press record." + image of TV guide showing two shows |
| Sidebar trigger | 🕐 Clock in sidebar shows "3:00 PM" + "ding" |
| MCQ | A. Switch to Channel 3 (Interstellar movie) → press record |
| | B. Switch to Channel 5 (Blue Planet) → press record ✅ |
| | C. Stay on current channel → press record (wrong show) |
| Low AF | "Remember to record a TV show for your mum." → all 3 plausible |
| High AF | "...Channel 5, Blue Planet documentary, switch to channel 5 first, then record" → only B |

---

**PM Task 8 — Get Coat for Departing Friend** (Block 4, Game B segment)

| | |
|---|---|
| Encoding | "When your friend leaves, give them the THIN grey jacket on the LEFT hook. Check the pockets for your KEYS first — you left them in there yesterday." + image of two jackets |
| Sidebar trigger | 💬 Friend chat bubble appears in sidebar + "ding" ("I should head out soon") |
| MCQ | A. Grab the thick grey jacket (right hook) → check pockets → hand to friend |
| | B. Grab the thin grey jacket (left hook) → hand to friend directly |
| | C. Grab the thin grey jacket (left hook) → check pockets for keys → hand to friend ✅ |
| Low AF | "Remember to get a coat for your friend before they leave." → all 3 plausible |
| High AF | "...thin grey jacket, left hook, check pockets for your keys first" → only C |

---

#### AF Manipulation Verification

| Task | Low AF → how many MCQ options remain plausible? | High AF → uniquely identifies correct option? |
|---|---|---|
| T1 Medicine | 3/3 (all involve taking medicine) | ✅ round + left + water first |
| T2 Tea | 3/3 (all involve making tea) | ✅ Longjing + top + boil + 3min |
| T3 Laundry | 3/3 (all involve handling laundry) | ✅ darks + separate + whites stay |
| T4 Book | 3/3 (all involve giving something to neighbor) | ✅ 三体 + dark blue + gift bag |
| T5 Pot | 3/3 (all involve handling the pot) | ✅ silver + left + valve first |
| T6 Umbrella | 3/3 (all involve preparing umbrella) | ✅ folding + check damage |
| T7 TV | 3/3 (all involve recording) | ✅ Channel 5 + Blue Planet |
| T8 Coat | 3/3 (all involve giving coat) | ✅ thin + left + check pockets |

**All Low AF reminders leave all 3 options plausible. All High AF reminders uniquely identify the correct option.** AF manipulation is structurally valid.

#### Trigger Focality — Uniform Medium Level

| Task | Trigger | Inferential distance |
|---|---|---|
| T1 | Dinner table appears | Dinner → after dinner → medicine (1 step) |
| T2 | Friend "10 min away" msg | Friend coming → prepare → tea (1 step) |
| T3 | Washing machine stops | Laundry done → handle it → but how? (1 step) |
| T4 | Doorbell | Someone's here → who? → neighbor → return book (2 steps) |
| T5 | Kitchen timer | Timer done → what was cooking? → pressure cooker (1 step) |
| T6 | TV weather: rain | Rain → umbrella → prepare for friend (2 steps) |
| T7 | Clock shows 3 PM | Time → something at 3? → TV show (1-2 steps) |
| T8 | Friend says leaving | Leaving → need coat → which one? (1 step) |

All triggers require 1-2 inferential steps. None are direct causal (no "doorbell → package" one-to-one mapping). T4 and T6 are slightly more distant; monitor in pilot for disproportionate miss rates.

### 2.11  Robot Behavior

#### Visual Presence (Sidebar)

Robot character (Pepper-styled icon) displayed in sidebar near the avatar location indicator. States:
- **Idle:** Small icon, static
- **Speaking:** Icon animates slightly; speech text appears as a toast/bubble near sidebar; audio plays via TTS

#### Utterance Types

| Type | Frequency per block | Purpose | When |
|---|---|---|---|
| Neutral comment | 2–3× | Establish robot as social agent; prevent "robot speaks = PM" | During Game A, between games, during Game C |
| **PM reminder** | **2×** | Experimental manipulation | During Game A (PM1) and Game B (PM2) |

Neutral comments reference the current game skin context: "Looks like a lot of emails piled up this week" (during email sorting), "Those vegetables look fresh" (during grocery shopping).

**All utterances use identical visual treatment** (same toast style, same icon animation). Participant cannot distinguish reminder from neutral comment by appearance.

#### Why Robot ≠ Speaker in This Design

1. Robot icon **co-located** with avatar in sidebar — visible in context
2. Robot makes **contextual observations** referencing current activity — demonstrates awareness
3. CB preamble **matches sidebar-displayed activity** — computationally grounded (backend knows state)
4. LLM system **demonstrated capable** of generating from state + rules (appendix demo)
5. Pepper robot can be integrated for formal experiment (swap TTS source, visual presence on screen or physical)

---

## 3  Dependent Variables & Analysis

### 3.1  Variables

| DV | Measurement | Analysis |
|---|---|---|
| **PM Accuracy** (primary) | System log: 0/1/2 per trial | Ordinal GLMM (cumulative link) |
| **PM error type** (exploratory) | 0 = prospective failure (didn't click trigger), 1 = retrospective failure (wrong MCQ option) | Descriptive; proportion comparison |
| **Perceived Intrusiveness** | 7-pt Likert post-block | Repeated measures ANOVA |
| **Perceived Helpfulness** | 7-pt Likert post-block | Repeated measures ANOVA |
| **Response time** (exploratory) | Trigger onset → sidebar click (ms) | Mixed model |
| **MCQ response time** (exploratory) | MCQ open → option selected (ms) | Mixed model |
| **Memory Self-Efficacy** | MSE scale pre + post session | Paired t-test |
| **Strategy use** | Post-session item (1–5) | Covariate |

### 3.2  Primary Model

```
PM_Accuracy ~ AF * CB + block_position + (1 | participant)
```

- Ordinal GLMM due to 0/1/2 scale
- `block_position` as covariate (learning effects)
- If pilot shows task variance: add `(1 | task_id)` as random effect

### 3.3  Attention Check

A trial is flagged if participant's ongoing task response rate drops below 50% of their session average during the 90s retention interval.

Sensitivity analysis: re-run model with flagged trials excluded.

### 3.4  Exclusion Criteria

**Participant-level:** <3 blocks completed; technical failure ≥2 blocks; encoding quiz failed >3 attempts on >2 tasks.

**Trial-level:** Confirmed technical failure; encoding not confirmed.

---

## 4  Platform Architecture

### 4.1  Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python + FastAPI |
| Frontend | React + Vite + Tailwind CSS |
| State | Zustand |
| Animation | Framer Motion (transitions, sidebar) |
| Audio | Howler.js (sounds) + Web Speech API (robot voice, prototype) |
| Communication | SSE (backend → frontend) + REST POST (frontend → backend) |
| Database | SQLite + SQLAlchemy |
| Deployment | Local LAN |

### 4.2  Visual Layout

```
┌────────────────────────────────────────────┬────────────┐
│                                            │  🕐 11:30   │
│                                            │  Saturday   │
│                                            │            │
│          MAIN PANEL                        │  ┌────────┐│
│          Current Ongoing Task              │  │ 🏠     ││
│          (email sorting / grocery shop /   │  │  Mini   ││
│          podcast quiz)                     │  │  Map    ││
│                                            │  │ 📍 Kit ││
│          Full-screen game interface        │  └────────┘│
│          styled as life activity           │            │
│                                            │  🧑 Kitchen │
│                                            │  📧 Sorting │
│                                            │   emails   │
│                                            │            │
│                                            │  🤖 Pepper  │
│                                            │   (idle)   │
│                                            │            │
│                                            │ ┌────────┐ │
│                                            │ │TRIGGERS│ │
│                                            │ │🫧 wash │ │
│                                            │ │🍽 dinner│ │
│                                            │ │🔔 door │ │
│                                            │ └────────┘ │
│                                            │            │
└────────────────────────────────────────────┴────────────┘
```

**Main panel (~75% width):** Fully occupied by current ongoing task. Styled to look like the life activity it represents (email client UI for email sorting, shopping app UI for grocery shopping). No room scene visible — the game IS the experience.

**Sidebar (~25% width):**
- **Clock:** Simulated time of day
- **Mini-map:** Simple floor plan showing avatar position (dot) and robot position (dot)
- **Activity label:** Text showing current activity ("Sorting emails", "Grocery shopping")
- **Robot status:** Pepper icon + status (idle / speaking)
- **Trigger zone:** Small icons representing household systems (washing machine, doorbell, stove timer, TV, clock, phone). Icons are normally static/greyed. When a trigger fires, the relevant icon **animates + changes color** and a non-specific "ding" sounds. Participant must notice and click.

**Trigger zone design rules:**
- All trigger icons are always visible (not just the active one) — this prevents "only icon = PM task" deduction
- Icons have 3 states: grey (inactive), subtle-pulse (ambient — e.g., washing machine spinning), highlight-pulse (trigger fired — needs attention)
- The "ding" sound is identical for all triggers — participant cannot distinguish PM trigger from ambient by sound alone
- Some icons pulse ambiently even when no PM trigger is associated — adds noise, prevents "animation = PM" meta-strategy

### 4.3  Backend API

```
POST /session/start                        # → session_id, group, condition_order, timeline
GET  /session/{id}/block/{n}               # → block config (tasks, conditions, game skins, timeline)
GET  /session/{id}/block/{n}/stream        # SSE: game_start, room_transition, robot_speak,
                                           #      reminder_fire, trigger_fire, window_close
POST /session/{id}/block/{n}/encoding      # Log quiz result
POST /session/{id}/block/{n}/ongoing       # Log ongoing task interactions (batched, every 5s)
POST /session/{id}/block/{n}/trigger-click # Participant clicked sidebar trigger → open MCQ
POST /session/{id}/block/{n}/mcq-answer    # MCQ option selected → backend scores
POST /session/{id}/questionnaire           # Likert + feedback

GET  /admin/dashboard                      # Experimenter view
GET  /admin/export/all                     # CSV export
```

### 4.4  Block Timeline Engine

```python
BLOCK_TIMELINE = [
    # Game A segment
    {"t": 0,    "event": "game_start",       "game": "semantic_cat", "skin": "email_v1"},
    {"t": 30,   "event": "robot_speak",      "type": "neutral",     "text": "Lot of emails this week!"},
    {"t": 60,   "event": "reminder_fire",    "task_slot": "A"},
    {"t": 150,  "event": "trigger_fire",     "task_slot": "A",      "sidebar_icon": "dinner_table"},
    {"t": 180,  "event": "window_close",     "task_slot": "A"},
    
    # Transition
    {"t": 180,  "event": "room_transition",  "to": "living_room",   "narrative": "11:15 — Grocery time"},
    
    # Game B segment
    {"t": 210,  "event": "game_start",       "game": "go_nogo",     "skin": "grocery_v1"},
    {"t": 270,  "event": "reminder_fire",    "task_slot": "B"},
    {"t": 300,  "event": "robot_speak",      "type": "neutral",     "text": "Those veggies look fresh."},
    {"t": 360,  "event": "trigger_fire",     "task_slot": "B",      "sidebar_icon": "washing_machine"},
    {"t": 390,  "event": "window_close",     "task_slot": "B"},
    
    # Transition
    {"t": 390,  "event": "room_transition",  "to": "balcony",       "narrative": "12:00 — Quick break"},
    
    # Game C segment (buffer)
    {"t": 420,  "event": "game_start",       "game": "trivia",      "skin": "podcast_v1"},
    {"t": 450,  "event": "robot_speak",      "type": "neutral",     "text": "Nice weather today."},
    {"t": 480,  "event": "game_end"},
    
    # Block end
    {"t": 510,  "event": "block_end"}
]
```

### 4.5  Experimenter Dashboard

```
┌──────────────────────────────────────────────────────┐
│  Participant: P012   Group: B   Block: 2 / 4          │
│  Condition: HighAF_LowCB                              │
├──────────────────────────┬───────────────────────────┤
│  Block Timeline           │  PM Status                │
│  [========>          ]    │  PM1: ✅ Score 2           │
│  Game B: grocery (2:14)   │  PM2: ⏳ Reminder sent     │
│                           │       Trigger in 54s       │
│  Ongoing task:            │                           │
│  Go/NoGo accuracy: 84%   │  Sidebar triggers:        │
│                           │  🫧 wash: active (PM2)    │
│  Robot: idle              │  🍽 dinner: triggered (PM1)│
│  Last utterance: neutral  │  🔔 door: ambient         │
│  Reminder text used:      │                           │
│  "Quick pause from..."   │                           │
├──────────────────────────┴───────────────────────────┤
│  [🔴 Invalidate] [⏸ Pause] [▶ Force Remind] [⏭ Skip] │
└──────────────────────────────────────────────────────┘
```

---

## 5  Data Schema

### 5.1  Per-PM-Trial (8 rows per participant)

| Field | Type | Description |
|---|---|---|
| `participant_id` | string | Anonymised |
| `session_id` | string | |
| `block_number` | int 1–4 | |
| `task_slot` | A/B | |
| `task_id` | string | medicine, tea, laundry, book, pot, umbrella, tv, coat |
| `condition` | string | LowAF_LowCB / HighAF_LowCB / LowAF_HighCB / HighAF_HighCB |
| `participant_group` | A/B/C/D | |
| `encoding_quiz_attempts` | int | |
| `reminder_played_at` | timestamp ms | |
| `reminder_text` | string | Exact text used |
| `reminder_activity_context` | string | Game skin active at reminder time |
| `trigger_fired_at` | timestamp ms | |
| `trigger_clicked_at` | timestamp ms | Null if score=0 |
| `trigger_response_time_ms` | int | trigger_fired - trigger_clicked; null if 0 |
| `mcq_option_selected` | string | A/B/C or null |
| `mcq_response_time_ms` | int | MCQ open → option click; null if 0 |
| `pm_score` | int 0/1/2 | |
| `pm_error_type` | string | null / prospective_failure / retrospective_failure |
| `ongoing_task_accuracy_retention` | float | Ongoing task accuracy during 90s retention interval |

### 5.2  Per-Block (4 rows per participant)

| Field | Type |
|---|---|
| `perceived_intrusiveness` | int 1–7 |
| `perceived_helpfulness` | int 1–7 |
| `game_a_accuracy` | float |
| `game_b_accuracy` | float |
| `open_comment` | string |

### 5.3  Per-Session (1 row per participant)

| Field | Type |
|---|---|
| `mse_pre` / `mse_post` | float |
| `strategy_use` | int 1–5 |
| `latin_square_group` | A/B/C/D |
| `session_date` | ISO date |
| `completion_flag` | boolean |
| `experimenter_notes` | string |

---

## 6  Risks & Mitigations

| Risk | Priority | Mitigation |
|---|---|---|
| Sidebar triggers not noticed (Score 0 too high) | **P0** | Non-specific "ding" sound + visual pulse; ambient icons add noise but the fired trigger is visually distinct; pilot test detection rates; adjust salience if needed |
| Ongoing task engagement too low → PM ceiling | **P0** | Semantic categorization and Go/No-Go at published difficulty levels; item rate calibrated to ~80% accuracy target; pilot verify |
| Low AF still allows correct MCQ answer (options too distinguishable) | **P0** | All 3 MCQ options designed as plausible under Low AF; pilot test: Low AF accuracy should be near chance (33%) |
| Skin-swap creates unequal cognitive load across blocks | **P0** | Pre-pilot verification: match response time and accuracy within 15% across skins |
| LLM generates non-compliant reminder | Eliminated | Pre-generated and human-validated; no runtime generation |
| Participant develops "ding = PM" meta-strategy | **P1** | Ambient icon pulses produce non-PM dings; neutral robot comments also produce audio; pilot assess |
| 90s retention insufficient | **P1** | Guynn (1998) supports; pilot confirms |
| Learning effect across blocks | **P1** | Latin Square + block_position covariate |
| Robot perceived as just sidebar icon (no "robot" feeling) | **P1** | Robot speaks in natural language; makes contextual observations; future: physical Pepper integration |
| Sims-style expectation mismatch (participants expect room navigation) | **P1** | Onboarding clearly explains: sidebar shows your day, main screen shows your current task |

---

## 7  Development Plan

### Phase 1 — Rapid Prototype (1 week)

**Goal:** One playable block proving the paradigm works.

| Component | Scope |
|---|---|
| Block timeline engine | SSE-driven; 1 full block (Game A + B + C) |
| Game A: Semantic Categorization | Email sorting skin; 50 items; 3-category |
| Game B: Go/No-Go | Grocery skin; 60 items; 70/30 ratio |
| Game C: Trivia | Podcast quiz; 10 items |
| Sidebar | Clock, mini-map (static), activity label, robot icon, trigger zone (3 icons) |
| PM task: Medicine (T1) | Encoding card + quiz + sidebar trigger + MCQ + scoring |
| Robot | Web Speech API TTS; 2 neutral comments + 1 reminder |
| Dashboard | Read-only: timeline position, PM status |

**Success criteria:**
1. Tester reports "going through a day" feeling (sidebar provides narrative)
2. Ongoing tasks absorb attention (tester cannot casually monitor sidebar)
3. Tester misses ≥1 sidebar trigger in first playthrough (confirms prospective component)
4. MCQ scoring logs correctly
5. Robot speech does not feel out of place

### Phase 2 — Full Build (2–3 weeks)

- All 4 game skins per type (email/photo/books/fridge × grocery/laundry/recycle/wardrobe)
- All 8 PM tasks with encoding cards, MCQs, and sidebar triggers
- Full 4-block session with Latin Square
- Practice block (abbreviated)
- Onboarding sequence
- All 32 pre-validated reminder texts loaded
- Ambient sidebar icon behavior (non-PM pulses)
- Questionnaire integration
- Dashboard emergency controls
- Audio upgrade for formal experiment

### Phase 3 — Pilot (1 week)

- 3–5 pilot participants
- Validate: trigger detection rate (target: 70–85% — not too easy, not too hard)
- Validate: Low AF MCQ accuracy near chance (33%)
- Validate: skin equivalence across blocks
- Adjust: trigger salience, item presentation rate, MCQ option wording

### Phase 4 — Data Collection (2 weeks)

- n = 32 participants
- ~52 min per session
- Experimenter monitors via dashboard

**Total: ~5–6 weeks to data collection completion.**

---

## 8  Open Questions

| ID | Priority | Topic | Status |
|---|---|---|---|
| **OQ-1** | 🔴 P0 | **Supervisor paradigm approval** | This PRD requests confirmation |
| **OQ-2** | 🔴 P0 | **Trigger salience calibration** | Non-specific "ding" + visual pulse enough? Or need stronger cue? Pilot will determine. |
| **OQ-3** | 🟡 P1 | **Physical Pepper integration** | Prototype: virtual only. Formal experiment: virtual sidebar icon, or physical robot in room? |
| **OQ-4** | 🟡 P1 | **MCQ time limit** | Currently: 30s window from trigger, then MCQ has unlimited time. Should MCQ also be timed? |
| **OQ-5** | 🟡 P1 | **Number of ambient (non-PM) sidebar events** | More = less meta-strategy but more distraction. Pilot calibrate. |
| **OQ-6** | 🟡 P1 | **Skin difficulty verification protocol** | How many pre-pilot testers needed? Current plan: 3–5, compare RT and accuracy. |
| **OQ-7** | 🟢 P2 | **CB preamble wording pool** | One fixed preamble per task × activity combination, or 2–3 variants for naturalness? |
| **OQ-8** | 🟢 P2 | **Device** | Laptop. iPad adaptation deferred. |
