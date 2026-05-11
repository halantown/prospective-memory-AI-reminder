# PM Task Design Review and Current Spec

> Reviewed on 2026-05-09 against
> `CookingForFriends/docs/storyboard/pm_tasks/PM_Task_Design_Principles.md`.
> This file replaces the older PM task summary and aligns the storyboard scripts
> with the current decoupled same-category selection design.

---

## Review Status

Overall verdict: the four task storyboards are usable for pilot preparation, with
one watch item.

| Area | Verdict | Notes |
|------|---------|-------|
| 4-segment encoding structure | Pass | All four tasks use 4 short cutscene segments with one click target per segment. |
| Standard PM flow | Pass | Encoding video -> checks -> assignment -> delay -> trigger -> greeting -> reminder -> dismiss -> 3-option selection -> confidence -> auto-execute. |
| Latin-square equivalence | Pass after option update | All tasks now use the same cognitive operation: recall the assignment text and choose one of three same-category options. |
| Distractor design | Updated | Final options are no longer episode-internal objects. They are same-category alternatives shown only at selection time. |
| Reminder leakage | Pass with wording constraints | EE+ anchors must use only episode context and must not include target, causal reason, or intention wording. |
| Attention checks | Needs implementation care | Checks should confirm viewing, not rehearse the target-action mapping. |
| Encoding script phrasing | Keep brief | Current scripts include natural request/promise lines for episode coherence. Do not turn those lines into repeated checks or recaps. |
| T4 front-door target | Pilot watch | "Front door" is a plausible common-sense default. Keep alternatives close and monitor pilot accuracy/confidence. |

Important update: `game controller`, `snack box`, `gift bag`, `postcard`,
`Bluetooth speaker`, `barbecue grill`, `neighbor`, `mailbox`, and `delivery
boxes` are encoding-video grounding/click objects. They are not final selection
distractors.

---

## Canonical Flow

Each real PM task follows this sequence:

```text
Encoding video, 4 segments with one click interaction each
-> attention check after each segment
-> explicit PM assignment screen
-> delay during ongoing cooking task
-> trigger event, doorbell or phone call
-> greeting dialogue
-> robot reminder, EE+ / EE-
-> "Got it" dismiss
-> 3-option target selection
-> confidence rating, 1-7
-> auto-execute selected action
```

Timeout behavior remains:

- 30s: Pepper hint.
- 45s: force-advance according to real/fake trigger rules.

Terminology:

- `EE+` in design notes corresponds to backend/runtime label `EE1`.
- `EE-` in design notes corresponds to backend/runtime label `EE0`.
- Encoding videos are grounding material only. The explicit assignment screen is
  the authoritative PM task instruction.

### Interactive Encoding Video State Machine

Each `ENCODING_VIDEO_N` phase contains one four-segment interactive episode.
The backend phase sequence stays unchanged:

```text
ENCODING_VIDEO_N -> MANIP_CHECK_N -> ASSIGN_N
```

Inside the frontend video phase, the local state machine is:

```text
segment1_playing
-> segment1_wait_interaction1_click
-> segment2_playing
-> segment2_wait_interaction2_click
-> segment3_playing
-> segment3_wait_interaction3_click
-> segment4_playing
-> segment4_wait_continue_click
-> MANIP_CHECK_N
```

All four tasks use four separate segment video files. At the end of each
segment, playback pauses on the final frame, one hotspot is highlighted, and the
participant must click that hotspot to continue. The task instruction card is
not part of the video; it remains the existing `ASSIGN_N` screen after the
video and manipulation check.

Hotspot targets are engagement anchors, not final target-selection distractors.
They should make the episode visually traceable without turning the video into
the source of PM-task instruction.

---

## Current Task Inventory

| Task | Trigger | Target | Final 3-option selection set | Encoding click targets |
|------|---------|--------|------------------------------|------------------------|
| T1 Mei | Doorbell | Baking book | Baking book; cookbook; novel | Game controller; snack box; baking book bubble; Continue/Mei |
| T2 Anna/Sophia | Doorbell, Sophia arrives | Chocolate | Chocolate; cookies; candy | Gift bag; postcard; chocolate; Continue/postcard/gift bag |
| T3 Benjamin | Phone call | Apple juice | Apple juice; orange juice; iced tea | Bluetooth speaker; apple juice; cooler box; Continue/Benjamin |
| T4 Delivery | Phone call | Leave package by front door | Leave it by the front door; leave it by the side gate; leave it on the porch bench | Neighbor; delivery boxes; front door; Continue/hallway |

Selection option IDs recommended for implementation:

| Task | Target ID | Distractor IDs |
|------|-----------|----------------|
| T1 | `baking_book` | `cookbook`, `novel` |
| T2 | `chocolate` | `cookies`, `candy` |
| T3 | `apple_juice` | `orange_juice`, `iced_tea` |
| T4 | `front_door` | `side_gate`, `porch_bench` |

All option order should be randomized per trigger. No correctness feedback is
shown before confidence rating.

---

## Design Rules Kept After Review

1. Final distractors are decoupled from the encoding episode.
2. Final distractors are same-category alternatives.
3. The trigger-time reminder may cue the task category but must not reveal the
   target option.
4. The EE+ increment is an episode anchor only: social, activity, spatial, or
   temporal context. It must not add causality, intention, or target wording.
5. Attention checks should avoid repeating "who should receive what" or "what
   should you do later" questions.
6. Target-in-video exposure is accepted as symmetric noise across conditions,
   not as the intended mechanism.
7. If a production script includes a request or promise for narrative coherence,
   keep it short and do not use recap/quiz screens to rehearse the same mapping.

---

## Task 1: Mei - Baking Book

Source files:

- `Mei/Mei_script.md`
- `Mei/Mei_interact.md`

### Design Summary

The participant previously visited Mei at her home. They played a game and
shared snacks. Mei became interested in the baking book mentioned by the
participant. Later, Mei arrives by doorbell.

### Assignment Screen

> Later, when Mei arrives, remember to give her the baking book.

### Final Selection Options

| Option | Role | Notes |
|--------|------|-------|
| Baking book | Target | Exact assignment target. |
| Cooking magazine | Distractor | Same reading/recipe category; not shown in encoding video. |
| Recipe notebook | Distractor | Same recipe-learning category; not shown in encoding video. |

### Reminder Wording

EE-:

> Mei is here. Remember to choose the correct item for her.

EE+:

> Earlier in Mei's living room, you spent time playing a game with her. Mei is here. Remember to choose the correct item for her.

EE+ excluded words/phrases:

- baking
- book
- recipe
- cookbook
- snack / cake / dessert
- give her the book

Leakage check: the approved EE+ anchor points to Mei, living room, and game
activity. It does not semantically favor baking book over cookbook or novel.

### Attention Check Direction

Use shallow scene checks:

- S1: who was present or what activity they were doing.
- S2: what object was on the coffee table.
- S3: how Mei reacted to the snacks, not what should happen later.
- S4: what they continued doing.

Avoid: "What should you give Mei later?"

---

## Task 2: Anna/Sophia - Chocolate

Source files:

- `Anna-Sophia/Anna-Sophia_script.md`
- `Anna-Sophia/Anna-Sophia_interact.md`

### Design Summary

The participant met Anna at a school cafe after Anna returned from a trip. Anna
showed a gift bag and postcard. During the episode, chocolate for Sophia is
introduced. Later, Sophia arrives by doorbell.

This task intentionally separates encoding person (`Anna`) from trigger person
(`Sophia`), but the trigger-time cognitive task remains equivalent: recall the
assignment and choose the correct same-category option.

### Assignment Screen

> Later, when Sophia arrives, remember to give her the chocolate.

### Final Selection Options

| Option | Role | Notes |
|--------|------|-------|
| Chocolate box | Target | Exact assignment target. |
| Cookie tin | Distractor | Same sweets/snacks category; not shown in encoding video. |
| Candy bag | Distractor | Same sweets/snacks category; not shown in encoding video. |

### Reminder Wording

EE-:

> Sophia is here. Remember to choose the correct item for her.

EE+:

> Earlier at the school cafe, Anna talked with you about her trip. Sophia is here. Remember to choose the correct item for her.

EE+ excluded words/phrases:

- chocolate
- sweet / candy / cookie
- gift
- bag
- postcard
- pass it to Sophia
- Anna asked you

Leakage check: the approved EE+ anchor gives Anna + trip + school cafe as
episode context. It does not reveal the transfer request or point uniquely to
chocolate among the sweets options.

### Attention Check Direction

Use shallow scene checks:

- S1: where the meeting happened or who was present.
- S2: what Anna gave to the participant.
- S3: whether Anna could attend dinner tonight, not who should receive what.
- S4: what Anna continued talking about.

Avoid: "What should you give Sophia?"

---

## Task 3: Benjamin - Apple Juice

Source files:

- `Benjamin/Benjamin_script.md`
- `Benjamin/Benjamin_interact.md`

### Design Summary

The participant previously went camping and barbecuing with Benjamin. Benjamin
drank apple juice from a cooler and found it too cold. Later, Benjamin calls to
say he is almost there.

The current script already notes that final choice distractors are decoupled
from the encoding video. Keep that principle.

### Assignment Screen

Recommended concise version:

> Later, when Benjamin calls to say he is almost there, remember to take the apple juice out of the fridge so it can warm up before he arrives.

### Final Selection Options

| Option | Role | Notes |
|--------|------|-------|
| Apple juice | Target | Exact assignment target. |
| Orange juice | Distractor | Same drink category; not shown in encoding video. |
| Iced tea | Distractor | Same drink category; not shown in encoding video. |

### Reminder Wording

EE-:

> Benjamin is calling. Remember to choose the correct drink to prepare before he arrives.

EE+:

> Earlier at the campsite, you were barbecuing and listening to music with Benjamin. Benjamin is calling. Remember to choose the correct drink to prepare before he arrives.

EE+ excluded words/phrases:

- apple
- juice
- drink label
- cooler
- fridge
- cold / warm / warm up
- take it out

Leakage check: the approved EE+ anchor uses campsite, barbecue, music, and
Benjamin. It should not mention temperature or storage, because those would cue
the action too directly. Since all selection options are drinks, the word
"drink" in the shared EE-/EE+ action cue does not reveal the target.

### Attention Check Direction

Use shallow scene checks:

- S1: where they were or what activity they were doing.
- S2: where Benjamin got the bottle from or how he reacted, not the drink name.
- S3: what object he pointed to or what the tone of the exchange was.
- S4: what activity continued after the drink was set aside.

Avoid: "What did Benjamin drink?" and "What should you take out later?"

---

## Task 4: Delivery Person — Front Door Instruction

### Narrative Summary

Yesterday morning, you were tidying the hallway at home before dinner preparation. You briefly talked with your neighbor near the entrance, then returned home and checked the hallway. You noticed the mailbox on the wall and some delivery boxes near the front door. After clearing enough space beside the front door, you decided it would be the best place for today's delivery. Later today, the delivery person calls ahead to ask how you'd like the package delivered.

### Encoding Video Storyboard

| Seg | Content | Key Objects | Interaction / Click Target | Attention-check Direction |
| --- | ------- | ----------- | -------------------------- | ------------------------- |
| S1 | Yesterday morning, you briefly talk with your neighbor near the entrance while tidying the hallway. | Neighbor | Click the neighbor | Ask who you talked with near the entrance. |
| S2 | You return to the hallway and notice the mailbox on the wall, then move some delivery boxes away from the front door area. | Mailbox, delivery boxes | Click the delivery boxes | Ask what objects were near the front door. |
| S3 | You check the front door area and see that there is now enough clear space for the package. You decide this is the best delivery spot. | Front door (target) | Click the front door | Ask which area was checked for the delivery. |
| S4 | You finish tidying the hallway and continue preparing for the dinner. | Hallway / continue button | Click Continue or hallway area | Ask what activity you were doing yesterday morning. |

### Explicit PM Assignment Screen

> Later today, a delivery person will call to ask how you'd like the package delivered. Remember to ask them to leave the package by the front door.

### Task Parameters

| Field | Value |
| ----- | ----- |
| **Trigger** | Phone call, delivery person asks how to deliver |
| **Action** | Tell the delivery person to leave the package by the front door |
| **Target** | Front door delivery instruction |
| **Distractors, same-category** | Put it in the mailbox; Call when arriving |
| **EE1 wording direction** | Refer to yesterday morning tidying the hallway before dinner preparation. Do not mention the front door, mailbox, boxes, neighbor, or delivery spot. |
| **EE0 wording direction** | State only that there is a delivery instruction to give, without episode reference and without target. |
| **EE1 leakage check** | "Yesterday morning tidying the hallway before dinner preparation" should anchor the prior episode but should not directly reveal "front door." Avoid "front door," "entrance," "mailbox," "boxes," "neighbor," "cleared space," or "delivery spot" in the EE1 reminder. |

### Candidate Reminder Wording

| Condition | Reminder |
| --------- | ------- |
| **EE0** | The delivery person is calling. Remember to give the correct delivery instruction. |
| **EE1** | Yesterday morning, while tidying the hallway before dinner preparation, you decided on a delivery instruction. Remember to give the correct delivery instruction. |

### Final Choice Options

* Leave it by the front door
* Put it in the mailbox
* Call when arriving

### Notes

* Delivery person calls ahead to ask delivery preference — all three options are equally plausible responses. No common sense default.
* Mailbox is visible in encoding video (S2) as a scene element but is not the target. This is consistent with the decoupled distractor principle: distractors appear in the option interface, and the mailbox's presence in the video is a narrative element, not a retrieval cue for the target.
* Target-in-video: front door appears in S3 as the clicked interaction object. Same symmetric exposure as T1-T3 (both groups see same video). Covered by the existing target-in-video defense.
* Secondary DV: target selection accuracy (instruction, not item).
* EE1 reminder anchors episode without revealing target — "tidying the hallway before dinner preparation" does not differentially point to any of the three options.

---

## Attention Check Rules

Checks must verify attention to the video without training the PM answer.

Good question types:

- who was present;
- where the scene happened;
- what ordinary activity was happening;
- what non-target object was visible;
- how someone reacted.

Avoid question types:

- "What should you remember to give/do later?"
- "Who should receive which item?"
- "What exact item is needed when the trigger happens?"
- "What delivery instruction should you give?"

Failure handling:

- Log failed checks.
- Consider exclusion or sensitivity analysis for repeated failures.
- Do not replay the video in the main experiment unless pilot data show that
  comprehension is too low without replay.

---

## Implementation Sync Checklist

The storyboard design is ahead of some implementation materials. Before running
the pilot, sync these places:

- `backend/data/experiment_materials/pm_tasks.json`: update people, assignment
  text, reminder text, and 3-option selection sets.
- `backend/engine/pm_tasks.py`: update comments that still describe
  "episode-internal distractors".
- `CookingForFriends/README.md`: update the PM task list that still mentions
  older names and `trash bags`.
- Frontend/admin material views: confirm that the final three options are
  loaded from the updated material file and randomized.
- Assets: prepare final selection option art or text labels for same-category
  alternatives that are not shown in the encoding videos.

No backend/runtime files were changed as part of this storyboard review.

---

## Pilot Checks

During pilot, record and inspect:

- per-task accuracy by condition;
- confidence distribution by task and condition;
- T4 front-door selection rate in EE-;
- attention-check failure rate per segment;
- whether participants confuse Anna and Sophia in T2;
- whether participants report using common-sense guessing rather than the
  assignment text.

Keep the current IV/DV structure unless pilot data show a concrete failure.
