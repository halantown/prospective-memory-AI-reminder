# PM Trigger Encounter Flow

> Development reference. Last updated: 2026-05-07.

## Terminology

**Cutscene** is reserved for the fixed encoding/tutorial video sequence shown before gameplay, implemented by `CutsceneEncodingPage` and logged through `cutscene_events`.

Doorbell and phone-call PM moments during gameplay are **not cutscenes**. They are **trigger encounters**: scripted, in-world interaction flows that temporarily constrain player input while the PM pipeline runs.

Current implementation note: the backend pauses the shared `GameClock` during the PM pipeline via `BlockRuntime.pause("pm")`. Cooking, phone delivery, and time ticks therefore resume after the pipeline completes. If the experimental design changes back to "background pressure continues during encounters", update `backend/engine/block_runtime.py`, `backend/engine/pm_session.py`, and this document together.

Use these names in code and docs:

| Concept | Preferred name | Avoid |
|---------|----------------|-------|
| PM doorbell/phone scripted flow | `TriggerEncounter`, `PMTriggerFlow` | `CutsceneState`, `cutsceneMode` |
| Temporary camera focus during PM trigger | `focusZoom`, `encounterZoom` | `cutsceneZoom` |
| Click-driven dialogue sequence | `DialogueFlow`, `ClickDialogue` | auto dialogue, cutscene dialogue |
| Encoding/tutorial fixed video | `Cutscene`, `EncodingCutscene` | PM trigger cutscene |

## Scope

This flow covers:

- 4 real PM triggers: 2 doorbell, 2 phone call
- 2 fake triggers: 1 doorbell, 1 phone call
- 1 tutorial trigger: simplified doorbell encounter

## Core Requirements

- Dialogue is click-to-advance, visual-novel style.
- One dialogue line is visible at a time.
- Clicking during typewriter animation completes the current line.
- Clicking after the line is complete advances to the next line.
- Previous dialogue lines disappear.
- During dialogue, normal world interactions are disabled.
- Cooking timers are paused with the shared gameplay clock during trigger encounters.
- Phone-message delivery is paused with the shared gameplay clock during trigger encounters. The phone UI remains non-interactive unless the current encounter explicitly needs the phone call UI.
- Trigger encounter state transitions should be logged for monitoring and data export.

## Dialogue Types

```ts
interface DialogueLine {
  speaker: string
  text: string
  bubblePosition: 'left' | 'right' | 'robot' | 'phone'
}

interface DialogueSequence {
  lines: DialogueLine[]
  onComplete: () => void
}
```

## Trigger Config

All dialogue and trigger content should be data-driven.

```ts
interface TriggerConfig {
  id: string
  type: 'doorbell' | 'phone'
  isPM: boolean
  npcId: string
  npcName: string
  greetingDialogue: DialogueLine[]
  reminderEC0?: string
  reminderEC1?: string
  itemOptions?: string[]
  correctItem?: string
  fakeActionLabel?: string
  fakeDialogue?: DialogueLine[]
}
```

The participant condition selects `reminderEC0` or `reminderEC1`.

## Encounter State Machine

Use trigger-specific naming:

```text
idle
→ trigger_fired
→ navigating_to_trigger        doorbell only
→ entry_transition             doorbell only
→ encounter_focus
→ greeting_dialogue
→ robot_enter                  real PM and tutorial only
→ robot_reminder               real PM and tutorial only
→ pm_task_flow                 real PM only
→ direct_request               fake only
→ exit_transition
→ idle
```

Do not name this state machine `CutsceneState`.

## Doorbell Encounter

1. Trigger fires: doorbell sound and "Go to front door" navigation control.
2. Participant clicks navigation control.
3. Avatar pathfinds to the front door area using normal room navigation.
4. Arrival transition:
   - fade to black
   - visitor and avatar reposition indoors
   - fade back in
5. Camera enters `encounterFocus`.
6. Greeting dialogue runs via click-to-advance bubbles.
7. Real PM/tutorial:
   - visitor walks from the door to the assigned living-room pose (seated for friends, standing for courier/tutorial)
   - robot appears near the encounter
   - robot delivers reminder
   - real PM continues to reminder card, item selection, confidence, auto-action
   - tutorial uses a single action button
8. Fake trigger:
   - no robot reminder
   - visitor directly asks for a single action
9. Exit:
   - visitor fades out
   - camera returns to normal room framing
   - avatar returns to previous activity
   - normal gameplay interactions resume

## Phone Encounter

1. Trigger fires: phone ring and incoming call UI.
2. Participant answers.
3. Camera enters avatar-focused `encounterFocus`.
4. Caller appears in a cloud/thought bubble using the caller sprite or portrait.
5. Greeting dialogue runs via click-to-advance bubbles.
6. Real PM:
   - robot appears nearby
   - robot delivers reminder
   - reminder card, item selection, confidence, auto-action
7. Fake phone trigger:
   - no robot reminder
   - caller directly asks for a single action
8. Exit:
   - cloud bubble fades out
   - phone call UI closes
   - camera returns to normal room framing
   - normal gameplay interactions resume

## Tutorial Encounter

The tutorial trigger reuses the doorbell encounter with a reduced task flow:

1. Doorbell trigger
2. Navigate to front door
3. Visitor Sam is brought indoors through the entry transition
4. Two-line greeting dialogue
5. Robot says Sam is here to pick something up
6. Single action button: "Give Sam the newspaper"
7. Auto-action, visitor exit, resume gameplay

No item selection or confidence rating is shown in the tutorial encounter.

## NPC Assets

Sprites live under `frontend/public/assets/characters/`.

| NPC | Use |
|-----|-----|
| Avatar | Player character |
| Mei | PM T1 doorbell visitor |
| Sophia | PM T2 doorbell visitor |
| Benjamin | PM T3 phone caller |
| Courier | PM T4 phone caller and fake doorbell visitor |
| Sam | Tutorial doorbell visitor |

Phone-only NPCs use their sprite or portrait inside the phone/cloud bubble rather than standing in the room.

Sprite-sheet rendering note:
- Character sheets are 48×96 per frame.
- Do not animate scaled fractional background positions directly; that can sample adjacent frames and show a flickering vertical edge.
- Render the native 48×96 frame window and scale the whole element with CSS transform when a larger character is needed.

## Current Implementation Notes

- `ClickDialogueFlow` owns click-to-advance dialogue with typewriter, 30s hint, and 45s auto-advance.
- `BubbleDialogue` is the shared pixel-style action/reminder bubble used by robot reminders, item choice, and PM action controls.
- Real PM trigger configs now exist for T1-T4.
- Fake doorbell and fake phone triggers use direct-request dialogue plus a single action button.
- Phone encounters show caller dialogue as a cloud-style bubble with the caller sprite.
- Tutorial trigger reuses the same click-to-advance dialogue and pixel bubble components.
- The frontend emits `trigger_encounter_state` WebSocket messages, persisted as `InteractionLog` rows for monitoring/export.

## Implementation Priority

1. Reusable click-to-advance dialogue system
2. Generalized speech bubble component
3. Encounter focus zoom
4. Doorbell real PM vertical slice
5. Phone real PM vertical slice
6. Tutorial trigger
7. Fake trigger variants
8. Full data-driven trigger config and condition routing
