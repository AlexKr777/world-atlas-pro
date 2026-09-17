# Popup Feedback Module

## What is included

The place popup now contains:

1. `Your status`
- `Want` and `Visited` glass buttons.
- Toggle behavior with active state.
- Saved per place in local storage.

2. `Rating`
- 5-star control with hover preview and click select.
- Compact review textarea (`max-height` constrained).
- `Save` button with soft pulse animation.
- Review form is available only for authenticated users.
- Guest state shows: `Sign in to leave review`.

3. `Community rating`
- Average score (large number).
- Review count line (`N reviews`).
- Latest review cards (glass style).

## Storage and Source of Truth

- Local storage key: `worldAtlasPro.placeFeedback.v1`
- Local storage keeps personal UI entry state (`userEntries[placeId]`).
- Supabase tables are source of truth for shared reviews:
  - `public.reviews` for UUID places (synced Supabase places),
  - `public.reviews_by_slug` for local seed places with string IDs.
- Shared source of truth stores:
  - community reviews list,
  - average rating and reviews count,
  - current user review (one review per place).

## Data behavior

- Authenticated user:
  - reads/writes review from/to `public.reviews`,
  - community block loads newest reviews from Supabase.
- Guest:
  - can see popup feedback block,
  - cannot submit review,
  - receives `Sign in to leave review`.
- `Want/Visited` state remains local and is saved immediately.

## Integration points

- `index.html`: popup markup section for feedback.
- `styles.css`: popup feedback and review card styling.
- `app.js`:
  - `createPlaceFeedbackStore(...)`
  - `createPopupController(...)` feedback handlers and rendering.
