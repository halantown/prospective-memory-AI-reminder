# Missing Materials

Known gaps in the current participant-facing materials. Keep this file short and
remove items as soon as they are replaced by real content.

## Encoding Videos

- `frontend/public/assets/encoding/t1/` has four segment videos.
- `frontend/public/assets/encoding/t2/`, `t3/`, and `t4/` do not yet contain
  segment videos.

## Questionnaire Content

- `POST_NASA_TLX`, `POST_MSE`, and `POST_RETRO_CHECK` still use placeholder
  progression UI in `frontend/src/pages/game/PostTestFlowPage.tsx`.
- Placeholder constants remain in `frontend/src/constants/placeholders.ts` for
  fallback rendering.

## Visual Assets

- Kitchen station PNGs under `frontend/public/assets/kitchen/` are optional and
  mostly absent; the current UI falls back to labelled station graphics.
- Dish PNGs under `frontend/public/assets/dishes/` are optional and currently
  absent.

## Audio

- Trigger and UI feedback use synthesized browser tones.
- Robot reminders are visual/text bubbles, not TTS or recorded speech.
