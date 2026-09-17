# World Atlas Pro

World Atlas Pro is a browser-based world map for exploring places, filtering the catalog, planning routes, and optionally synchronizing account-backed data with Supabase.

## Features

- Interactive Leaflet map with place markers, search, region and smart filters.
- Place details, route requests, and live-weather requests through local API endpoints.
- Favorites stored locally for guests and synchronized for authenticated users.
- Supabase email/password authentication plus authenticated place, review, submission, and profile workflows.
- Optional Cloudflare Worker implementation for static-hosted API handling.

## Architecture

```text
Browser (Vanilla JavaScript + Leaflet)
  |- Express server: local static hosting and /api endpoints
  |- Supabase: Auth, Postgres-backed application data, and Storage
  `- Optional Cloudflare Worker: edge API handling for static hosting
```

The browser entry point is `index.html`. `boot-app.js` loads the application modules, while `server.js` is the local Express entry point. `_worker.js` is the Cloudflare Worker entry point.

## Tech stack

- JavaScript and HTML/CSS
- Express and compression middleware
- Leaflet
- Supabase (Auth, Postgres, Storage)
- Cloudflare Workers/Pages configuration

## Project structure

```text
assets/                 Static project assets
data/places.json        Local place-data fallback/source
docs/                   Supporting schema and feature documentation
js/modules/             UI modules
supabase/               Supabase schema and incremental SQL patches
server.js               Local Express server
_worker.js              Cloudflare Worker entry point
```

## Requirements

- Node.js with npm
- A Supabase project configured with the schema and policies required by the application
- A WeatherAPI key to enable live weather in the local Express server

## Setup and local run

```bash
npm ci
copy .env.example .env
# Set WEATHER_API_KEY in .env, then load it in your shell/environment.
npm start
```

Open `http://localhost:3000`. The local server copies `data/places.json` to `places.json` before startup. Do not open `index.html` directly with `file://`.

`server.js` reads environment variables from the process environment; it does not load `.env` itself. Use your shell, an environment manager, or your editor's run configuration to load `.env` before starting the process.

## Environment

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | Local server | Express listen port; defaults to `3000`. |
| `WEATHER_API_KEY` | For live weather | Server-only | WeatherAPI credential used by `server.js` and `_worker.js`. |
| `SUPABASE_SERVICE_ROLE` | For Worker privileged operations | Server-only | Cloudflare Worker service credential. Never expose this in browser code. |
| `APP_ACCESS_COOKIE_SECRET` | For Worker signed access cookies | Server-only | Secret used by the Cloudflare Worker. |
| `SUPABASE_URL` | No | Worker configuration | Optional Worker Supabase project URL override. |
| `SUPABASE_PUBLISHABLE_KEY` | No | Worker configuration | Optional Worker publishable-key override. |

The browser initializes Supabase from `config-supabase.js`. Its project URL and publishable key are client configuration, not server credentials. Access control must be enforced by the Supabase Row Level Security policies, not by treating a publishable key as a secret.

## Supabase setup

Apply `supabase/schema.sql` to create the baseline schema, RLS policies, and storage configuration. The dated files in `supabase/` are incremental patches; inspect and apply only the patches appropriate to your database state. Supporting SQL documents are in `docs/`.

The repository contains schema and policy definitions, not database dumps. Review policies before applying them to any environment. The checked-in SQL uses `admin@example.invalid` as a safe administrator placeholder; replace it with the administrator addresses appropriate for your environment before applying the schema or the matching historical patches.

## Authentication and authorization

The client uses Supabase email/password authentication. Guest favorites use browser storage; authenticated workflows use Supabase-backed records. RLS policies in the SQL files define the intended authorization boundary for rows and storage objects.

## Map and external services

- Leaflet is loaded from the Leaflet CDN.
- Map tiles and attribution are configured in the application; OpenStreetMap attribution must remain visible where required.
- Route providers and WeatherAPI are external services. Live weather is unavailable until `WEATHER_API_KEY` is configured.

## Verification

The available npm scripts are:

```bash
npm start
npm run dev
npm run sync:places
npm run fix:places-encoding
```

This project does not define a test, lint, or build script in `package.json`.

## Security notes

- Keep `.env`, `.dev.vars`, Cloudflare secrets, and all service-role credentials out of source control.
- The Worker reads privileged credentials from its runtime environment only.
- A publishable Supabase client key is intentionally browser-visible; it is not a substitute for RLS.
- Local logs, runtime state, captures, performance artifacts, and stale copies are ignored rather than deleted.

## Limitations

- Supabase resources and external route/weather services must be configured separately.
- The repository does not include a packaged Cloudflare Pages build output or a deployment command.
- No license has been selected; none was added automatically.
