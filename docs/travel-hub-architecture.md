# Travel Hub Architecture

## Goal
Add new product-style UI features without overloading `app.js`, while keeping the same glass/frosted visual language.

## Modules

1. `js/modules/ui-state-store.js`
- Isolated UI state store for:
  - `mode`: `catalog | guide | planner`
  - places summary metrics
  - social metrics (favorites/auth/selected place)
  - planner metrics (distance/duration/mode/provider)
- Listens to app-level events:
  - `worldatlas:places-updated`
  - `worldatlas:selection-changed`
  - `worldatlas:favorites-synced`
  - `worldatlas:auth-changed`
  - `worldatlas:route-metrics-updated`

2. `js/modules/travel-shell.js`
- Presentation layer for Travel Hub UI:
  - mode switch
  - compact KPI cards
  - collapse/expand state with persistence
- Consumes only `WorldAtlasUiStateStore` API (`getState`, `subscribe`, `setMode`).

## Integration Pattern

- `app.js` remains core map/domain logic.
- `app.js` emits small custom events with minimal payload.
- UI modules subscribe and render independently.

This keeps feature growth modular and limits coupling.
