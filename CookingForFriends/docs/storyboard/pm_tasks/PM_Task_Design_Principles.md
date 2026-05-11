# PM Task Design Principles & Constraints

> Compiled from all design discussions. This is the canonical reference for evaluating any PM task design.

---

## 1. Task Structure (Must Hold for All 4 Tasks)

**1.1 Structural homogeneity across tasks**

All 4 tasks must follow the same sequential flow:

```
Encoding video (4 segments, click interaction per segment)
→ Attention check per segment
→ Explicit PM assignment screen (text-based)
→ [Delay: ongoing cooking task]
→ Trigger event (doorbell or phone call)
→ Greeting dialogue
→ Robot reminder (EE+ or EE-)
→ "Got it" dismiss
→ 3-option target selection
→ Confidence rating (1-7)
→ Auto-execute
```

Timeout: 30s robot hint, 45s force-advance.

**1.2 Task type equivalence for Latin square**

All 4 tasks must be structurally equivalent so that Latin square counterbalance is valid. "Structurally equivalent" means: participant's cognitive task at the selection screen is the same — recall the assignment screen text, match it to one of three options. The information source is always the assignment screen, regardless of whether the target is an object or an instruction.

**1.3 Trigger types**

- T1, T2: doorbell (visitor arrives)
- T3, T4: phone call (caller asks something)
- 2 fake triggers: same entry flow, no reminder

Trigger type is a fixed property of each task, not counterbalanced.

**1.4 Latin square counterbalance**

Between-subject design (EE+ vs EE-). All 4 tasks use the same condition per participant. Latin square counterbalances **task order** (not condition), preventing position effects. 4×4 Latin square = 4 order groups, each needing participant count as multiple of 4.

---

## 2. Encoding Video Design

**2.1 Function: grounding tool only**

The encoding video's sole function is to make the EE+ reminder's episode reference recognizable to participants — it is NOT fabricated context. The video is a prerequisite, not a manipulation variable.

**2.2 Three "NOT responsible for"**

1. NOT responsible for teaching the PM task (task is explicitly assigned after video on a separate screen)
2. NOT responsible for testing memory ability
3. NOT responsible for serving as retrieval material at execution time

**2.3 All participants see the same video**

Both EE+ and EE- groups watch identical encoding videos. The IV is reminder content, not encoding quality or video content.

**2.4 4-segment structure per task**

Each task has 4 cutscene segments (~10-15s each). Each segment has one click interaction target (simulating engagement with the scene). Each segment has an attention-check question afterward.

**2.5 Manipulation check**

Confirms participant watched the video (e.g., "What were you doing just now?"). Failure = data exclusion, no replay. This is NOT a memory test — it checks engagement, not recall accuracy.

---

## 3. Distractor Design (Updated 0509 — Decoupled)

**3.1 Core principle: decoupled from encoding video**

Distractors are same-category alternatives that appear ONLY on the selection screen. They do NOT need to appear in or be interacted with during the encoding video.

**3.2 Old constraint (ABANDONED)**

~~"All three options appeared in the same episode and were all interacted with."~~ This was abandoned because:
- Episode-internal distractors risk EC+ reminder activating episode memory → interfering with item discrimination → potentially reversing confidence effect
- Same-category decoupling is cleaner: participant recalls from assignment, not from episode

**3.3 New constraints**

- Same-category: all three options must be plausible alternatives within the same semantic category
- Semantic proximity: options must be close enough that common sense alone cannot eliminate any option — participant must recall the assignment text to distinguish
- No ambiguity: despite proximity, the correct answer must be unambiguous given the assignment wording
- No common-sense default: no single option should be the "obvious" answer without recalling the assignment (e.g., "front door" as a delivery location is too default without additional context)

**3.4 Per-task distractor list required**

Each task must have its own same-category distractor list designed and verified against the above constraints.

---

## 4. Reminder Design (EE+ / EE-)

**4.1 Reminder structure**

- EE-: States the action without episode reference, without revealing the target. E.g., "Remember to give the correct delivery instruction."
- EE+: Adds an episode anchor (activity + temporal context) before the action. E.g., "Yesterday morning, while tidying the hallway before dinner preparation, you decided on a delivery instruction. Remember to give the correct delivery instruction."

**4.2 EE+ increment = episode anchor**

The EE+ addition provides three dimensions from the Situation Model framework (Zwaan & Radvansky, 1998):
- Social context (who was involved)
- Activity context (what they were doing)
- Spatial context (where it happened)

Temporal context is secondary. Causality and intentionality are EXCLUDED (they overlap with task content and would confound the IV).

**4.3 Target NOT revealed in reminder**

Neither EE+ nor EE- reveals the target. The participant must recall the assignment to select correctly.

**4.4 EE1 leakage check (critical)**

The EE+ episode anchor must NOT differentially point to any of the three options. Each task must have:
- An explicit list of excluded words/phrases in the EE+ reminder
- A check that the episode description does not create a semantic path to the target that bypasses assignment recall
- Verification that the anchor is equally (non-)associated with all three options

---

## 5. Target-in-Video Defense

**5.1 The issue**

The PM target necessarily appears in the encoding video (e.g., participant clicks the front door in the video, and the target is "leave package by front door"). Participant could use visual memory from the video to select the target, rather than recalling the assignment.

**5.2 Why this is not fatal**

1. Not a new problem — existed in all prior distractor designs
2. Both groups symmetric — both watch the same video, so this is noise, not confound
3. Accuracy is not the core DV — even if both groups ceiling on accuracy, confidence differences can still exist
4. Theoretical position: EC+ makes the task feel grounded, not help item retrieval

**5.3 Defense strategy**

- Theory: the claim is EC+ makes the task feel grounded and credible, not that it aids item retrieval
- Data: if accuracy ceilings but confidence differs, this supports the hypothesis
- Discussion: acknowledge inability to fully rule out episode memory activation pathway as a limitation

---

## 6. Assignment Screen Design

**6.1 Explicit text-based assignment**

PM task knowledge comes from the assignment screen, NOT from the encoding video. The assignment screen appears AFTER the encoding video ends.

**6.2 Assignment is the sole source of target information**

Participant's basis for selecting the correct option is their memory of the assignment text. This is what makes the task cognitive demand uniform across all 4 tasks, regardless of whether the target is an object or an instruction.

---

## 7. Current Task Inventory

Reviewed 2026-05-09. The distractors below are same-category selection-screen
options, not episode-internal click objects.

| Task | Person/Entity | Target | Trigger | Distractors (same-category) |
|------|--------------|--------|---------|---------------------------|
| T1 | Mei | 烘焙书 (baking book) | Doorbell | Cookbook; novel |
| T2 | Anna / Sophia | 巧克力 (chocolate) | Doorbell | Cookies; candy |
| T3 | Benjamin | 苹果汁 (apple juice) | Phone | Orange juice; iced tea |
| T4 | 快递员 (delivery person) | Front door instruction | Phone | Leave by side gate; leave on porch bench |

Note: T4 remains a pilot-watch item because "front door" can be a common-sense
delivery default. If pilot accuracy is at ceiling, switch to a less-default
delivery instruction before formal data collection.

---

## 8. Checklist for Evaluating Any New/Modified Task

- [ ] Follows the standard flow (§1.1)?
- [ ] Structurally equivalent to other tasks for Latin square (§1.2)?
- [ ] Encoding video serves as grounding tool only, not memory test (§2.1, §2.2)?
- [ ] 4-segment cutscene with click interaction per segment (§2.4)?
- [ ] Attention check per segment (§2.5)?
- [ ] Distractors are same-category, decoupled from video (§3.1, §3.3)?
- [ ] No common-sense default among options (§3.3)?
- [ ] Reminder does not reveal target (§4.3)?
- [ ] EE1 leakage check passed — excluded words listed (§4.4)?
- [ ] EE1 anchor does not differentially point to any option (§4.4)?
- [ ] Target-in-video exposure is symmetric across conditions (§5.2)?
- [ ] Assignment screen is the sole source of target info (§6.1)?
