# Content Asset Checklist — Generated Items (0503)

---

## 1. Welcome / Cover Story Text

```
This study investigates how people manage multiple household tasks simultaneously 
in a simulated home environment. You will be asked to prepare dinner for friends 
while handling various everyday interruptions.

The experiment takes approximately 30–35 minutes. You will receive a brief 
training session before the main task begins.
```

---

## 2. Story Intro Script

Scene: Bedroom. Avatar wakes up in bed. Galgame-style text boxes.

```
[AVATAR wakes up]
NARRATOR: "Saturday morning. Tonight you're hosting a dinner party for some friends."

[ROBOT fades in beside avatar]
ROBOT: "Good morning! I'm your household assistant. I'll help keep track of 
things today — reminders, schedules, that sort of thing."

[AVATAR stands up]
AVATAR: "Before I start preparing, let me tell you about some things that 
happened recently..."

→ Transition to ENCODING_VIDEO_1
```

---

## 3. Encoding Phase — Transition Lines Between Videos

```
After video 1 → assign 1:
  AVATAR: "There's something else that happened..."

After video 2 → assign 2:
  AVATAR: "Oh, and also..."

After video 3 → assign 3:
  AVATAR: "One more thing..."

After video 4 → assign 4:
  (no transition needed — goes to recap)
```

---

## 4. Assign Popup Texts (4 tasks)

System-level overlay, centered popup, [OK] button.

```
T1 (Mei / doorbell):
  "Tonight, remember to give Mei the book when she visits."

T2 (Anna-Lina / doorbell):
  "Tonight, remember to give Anna-Lina the chocolate when she visits."

T3 (Tom / phone call):
  "Tonight, remember to give Tom the apple juice when he calls."

T4 (Delivery person / phone call):
  "Tonight, remember to give the delivery person the trash bags when they call."
```

Note: Wording deliberately does NOT include episode details or item-discriminating
features (e.g., no "baking book", just "book"). This prevents assign text from
functioning as an EE1 or AF cue.

---

## 5. Encoding Manipulation Check Questions (4 tasks)

3-option multiple choice. 1 correct + 2 wrong. Wrong answer → exclusion flag,
no feedback, continue to assign.

```
T1 — Mei episode (baking together):
  Q: "What were you and Mei doing in the video?"
  A: "Baking together" ✓
  B: "Watching a movie"
  C: "Cleaning the kitchen"

T2 — Anna-Lina episode (studying together):
  Q: "What were you and Anna-Lina doing in the video?"
  A: "Going for a walk"
  B: "Studying together" ✓
  C: "Playing a board game"

T3 — Tom episode (having a picnic):
  Q: "What were you and Tom doing in the video?"
  A: "Having a picnic" ✓
  B: "Shopping for groceries"
  C: "Fixing a bike"

T4 — Delivery person episode (receiving a package):
  Q: "What happened with the delivery person in the video?"
  A: "They delivered furniture"
  B: "They asked for directions"
  C: "They dropped off a package" ✓
```

⚠️ IMPORTANT: These are placeholder episode descriptions. The actual correct
answers must match whatever the encoding videos actually depict. Update these
after videos are finalized.

---

## 6. Recap Text (Robot, 4 tasks)

Popup window + robot sprite. Typewriter animation, line by line. [Got it] button.

```
ROBOT: "Alright, let me go over tonight's to-do list:"

1. "Give Mei the book when she visits"
2. "Give Anna-Lina the chocolate when she visits"  
3. "Give Tom the apple juice when he calls"
4. "Give the delivery person the trash bags when they call"

ROBOT: "I'll remind you when the time comes!"
```

Note: Recap order follows the participant's latin square task_order, not the
fixed T1-T4 order above.

---

## 7. Avatar Post-Encoding Line

```
AVATAR: "That's everything. Remember to remind me tonight, okay?"
```

This line gives robot the narrative authorization to deliver reminders later.

---

## 8. Tutorial — Phone Demo

One chat message, 2 reply options.

```
[Phone notification sound]
[Chat interface opens]

FRIEND (Sophie): "Hey! Quick question — how many days are in a week?"

  Option A: "7"  ✓
  Option B: "5"

[After selection, brief delay 2-3s]
SOPHIE: "Thanks! 😊"
```

---

## 9. Tutorial — Fried Egg Recipe

Recipe name: Fried Egg
Steps with 2 options each (1 correct + 1 distractor). Participant must check
recipe via press-and-hold to know correct answer.

```
Step 1: Choose ingredient from fridge
  Recipe says: "Take out 2 eggs"
  Option A: "Butter" (distractor)
  Option B: "Eggs" ✓

Step 2: Choose what to put on the pan
  Recipe says: "Add a little cooking oil to the pan"
  Option A: "Cooking oil" ✓
  Option B: "Water" (distractor)

Step 3: Cooking action
  Recipe says: "Crack the eggs into the pan"
  Option A: "Crack the eggs into the pan" ✓
  Option B: "Stir the eggs in a bowl first" (distractor)

Step 4: Seasoning
  Recipe says: "Add a pinch of salt"
  Option A: "Sugar" (distractor)
  Option B: "Salt" ✓

Step 5: Finish
  Recipe says: "When the edges turn golden, slide onto a plate"
  [Timer: 15 seconds]
  [After timer or manual confirm → egg slides onto plate]
```

Note: Step 5 demonstrates the Kitchen Timer mechanic. Timer appears as banner,
stays until step completes.

---

## 10. Tutorial — Trigger Demo

```
[Doorbell sound]
[Visitor sprite fades in at front door]

VISITOR (Sam): "Hey! Good morning!"

ROBOT (bubble): "Sam is here to pick something up."

[Single button appears]
  [Give Sam the newspaper] 

[Avatar walks to door, gives newspaper]
[Sam leaves, fade out]
```

Note: "Sam" and "newspaper" are arbitrary — not related to any of the 4 real
PM tasks. Visitor name must not overlap with PM task names (Mei, Anna-Lina,
Tom, delivery person).

---

## 11. Evening Transition

```
[Screen fades to black, 2 seconds]

TEXT: "It's now evening. Time to prepare dinner for your friends."

[Fade into kitchen scene]

→ MAIN_EXPERIMENT begins
```

---

## 12. Debrief Text

```
Thank you for completing the study!

We'd like to let you know that the true purpose of this experiment was not 
only to study multitasking performance, but specifically to investigate how 
different types of robot reminders affect your experience with remembering tasks.

The robot's reminder messages were designed to either include or exclude details 
about how the tasks originally came up. Your cooking performance was not the 
main focus of measurement.

If you have any questions about this study, please contact: [EMAIL_PLACEHOLDER]

Thank you for your participation!
```

---

## 13. Post-test — Manipulation Check

```
Q: "In your own words, please describe what the robot's reminders typically 
contained when it reminded you about your tasks."

[Open text field, no word limit]
```

---

## 14. Post-test — Retrospective Memory Check

Multiple-choice, per task. Order follows participant's task_order.

```
For each PM task, 3 questions:

T1 — Mei:
  Q1: "Who asked you to bring them something?"
    A: "Tom"  B: "Mei" ✓  C: "Sophie"
  Q2: "How did they arrive / contact you?"
    A: "Phone call"  B: "Text message"  C: "Doorbell" ✓
  Q3: "What were you supposed to give them?"
    A: "Chocolate"  B: "Book" ✓  C: "Apple juice"

T2 — Anna-Lina:
  Q1: "Who asked you to bring them something?"
    A: "Anna-Lina" ✓  B: "Mei"  C: "Sam"
  Q2: "How did they arrive / contact you?"
    A: "Doorbell" ✓  B: "Phone call"  C: "Text message"
  Q3: "What were you supposed to give them?"
    A: "Book"  B: "Trash bags"  C: "Chocolate" ✓

T3 — Tom:
  Q1: "Who asked you to bring them something?"
    A: "Anna-Lina"  B: "Delivery person"  C: "Tom" ✓
  Q2: "How did they arrive / contact you?"
    A: "Doorbell"  B: "Phone call" ✓  C: "Text message"
  Q3: "What were you supposed to give them?"
    A: "Apple juice" ✓  B: "Book"  C: "Chocolate"

T4 — Delivery person:
  Q1: "Who asked you to bring them something?"
    A: "Tom"  B: "Sophie"  C: "Delivery person" ✓
  Q2: "How did they arrive / contact you?"
    A: "Text message"  B: "Phone call" ✓  C: "Doorbell"
  Q3: "What were you supposed to give them?"
    A: "Trash bags" ✓  B: "Apple juice"  C: "Newspaper"
```

Note: Distractor options cross-reference other PM tasks to test whether
participant correctly binds person-trigger-item associations.

---

## 15. Debrief contact email

```
h.tang-6@student.tudelft.nl
```

## Items NOT included (require researcher / supervisor input)

- [ ] Consent PDF (HREC document)
- [ ] 4 encoding videos / cutscene assets (pixel art production)
- [ ] MSE scale items (check with Mark)
- [ ] Confidence scale items and anchors (literature search needed)
- [ ] Trust scale items (literature search needed)
- [ ] Perceived usefulness scale items (literature search needed)
- [ ] NASA-TLX version selection (standard 6-item vs. Raw TLX)
- [ ] EE1 / EE0 reminder texts (finalize post-pilot)
- [ ] Main experiment phone questions (28 items — already in phone_messages_v3.json)
- [ ] Real/fake PM trigger dialogue lines (main experiment)
