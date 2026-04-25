"""Game time freeze/unfreeze helpers.

The server tracks "game time" which pauses whenever a PM pipeline is active.
All TRIGGER_SCHEDULE delay calculations and PM event log timestamps use game
time, not wall time, so the experiment clock does not advance during pipeline
interactions (decoy selection, confidence rating, avatar action).

Participant fields managed here (see models/experiment.py):
  game_time_elapsed_s  — accumulated game-time seconds (frozen intervals excluded)
  frozen_since         — epoch-seconds wall time when current freeze started, or None
  last_unfreeze_at     — epoch-seconds wall time of the most recent unfreeze
"""

import time


def freeze_game_time(participant) -> None:
    """Snapshot accumulated game time and mark session as frozen.

    Call when a PM pipeline fires (real or fake trigger).
    No-op if the session is already frozen.
    The caller is responsible for persisting the participant to the DB.
    """
    if participant.frozen_since is not None:
        return  # already frozen
    now = time.time()
    if participant.last_unfreeze_at is not None:
        participant.game_time_elapsed_s += now - participant.last_unfreeze_at
    participant.frozen_since = now


def unfreeze_game_time(participant) -> None:
    """Resume game time and record the wall-time reference for the next accumulation.

    Call when a PM pipeline ends:
      - real trigger: after pm_action_complete
      - fake trigger: after fake_trigger_ack ("I know" click)
    No-op if the session is not currently frozen.
    The caller is responsible for persisting the participant to the DB.
    """
    if participant.frozen_since is None:
        return  # already running
    participant.last_unfreeze_at = time.time()
    participant.frozen_since = None


def get_current_game_time(participant) -> float:
    """Return the current accumulated game time in seconds.

    If frozen: returns the snapshot stored in game_time_elapsed_s.
    If running: adds the elapsed wall time since last_unfreeze_at.
    Returns 0.0 for brand-new sessions where no unfreeze has occurred yet.
    """
    if participant.frozen_since is not None:
        return participant.game_time_elapsed_s
    if participant.last_unfreeze_at is not None:
        return participant.game_time_elapsed_s + (time.time() - participant.last_unfreeze_at)
    return participant.game_time_elapsed_s
