# CookingForFriends Docs

This directory is organized as a small project wiki. Start here instead of
opening date-stamped notes directly.

## Read First

| Need | Document |
|------|----------|
| Current system shape | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Local setup and runtime knobs | [CONFIGURATION.md](CONFIGURATION.md) |
| Manual QA and test flow | [TEST_GUIDE.md](TEST_GUIDE.md) |
| PM doorbell / phone-call flow | [PM_TRIGGER_FLOW.md](PM_TRIGGER_FLOW.md) |
| Cooking ongoing task and kitchen assets | [COOKING.md](COOKING.md) |
| Backend incidents and bug post-mortems | [INCIDENTS.md](INCIDENTS.md) |

## Domain References

| Area | Document |
|------|----------|
| PM task storyboards and pilot script assets | [storyboard/pm_tasks/pm_tasks_design.md](storyboard/pm_tasks/pm_tasks_design.md) |

## Archive

Historical plans, migration reports, reviews, and older incident logs live under
[archive/](archive/). Use them for context and traceability, not as current
implementation guidance.

Useful archive entries:

| Topic | Archived document |
|-------|-------------------|
| Older full architecture long-form notes | [archive/architecture/ARCHITECTURE_legacy.md](archive/architecture/ARCHITECTURE_legacy.md) |
| GameClock / BlockRuntime migration | [archive/migrations/GAME_CLOCK_MIGRATION_REPORT_2026-05-03.md](archive/migrations/GAME_CLOCK_MIGRATION_REPORT_2026-05-03.md) |
| 2026-05-08 architecture review | [archive/reviews/ARCHITECTURE_REVIEW_2026-05-08.md](archive/reviews/ARCHITECTURE_REVIEW_2026-05-08.md) |
| Old implementation patch plan | [archive/plans/experiment_plan_v3.md](archive/plans/experiment_plan_v3.md) |
| Old ongoing-task redesign spec | [archive/plans/ongoing_task_dev_doc_2026-04-08.md](archive/plans/ongoing_task_dev_doc_2026-04-08.md) |
| Legacy incident log with divergent numbering | [archive/incidents/INCIDENT_LOG_legacy.md](archive/incidents/INCIDENT_LOG_legacy.md) |

## Maintenance Rules

- Keep current operational docs at the top level.
- Put dated plans, one-off prompts, migration reports, and obsolete specs in
  `archive/<category>/`.
- Prefer updating [ARCHITECTURE.md](ARCHITECTURE.md) or
  [CONFIGURATION.md](CONFIGURATION.md) over adding another standalone note.
- Record backend incidents in [INCIDENTS.md](INCIDENTS.md). If numbering
  conflicts with legacy files, keep the current file authoritative and mention
  the legacy source only in archive notes.
