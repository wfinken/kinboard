# KinBoard

A family dashboard with an Astro API, a lightweight web client, and room for native Swift and Kotlin apps. This repository uses npm workspaces and one lockfile.

| Workspace | Responsibility |
| --- | --- |
| `apps/api` | Astro API, Auth.js Google login, authorization, Drizzle, D1/SQLite, and existing wall/login routes |
| `apps/web` | Static Vite + TypeScript web app; no UI framework, database access, or secrets |
| `packages/contracts` | Transport types, typed web client, and [OpenAPI contract](packages/contracts/openapi.json) |
| `apps/ios`, `apps/android` | Documented homes for future native projects; no native apps implemented yet |

## Run locally

Use Node 22.12+ and npm. All commands below run from the repository root.

```sh
npm ci
cp apps/api/.env.example apps/api/.env
# Fill in AUTH_SECRET and Google OAuth credentials.
npm run db:migrate
npm run dev
```

Open `http://localhost:4321/app/` for the new API-driven app, `/` for the existing wall dashboard, or `/admin` for all management features. Sign-in is required to access family data. The static `/app/` shell contains no private information.

`npm run dev` builds and stages the web app before starting Astro. For frontend hot reload, keep Astro running and start `npm run dev:web` in another terminal; open `http://localhost:5173/app/`. Its `/api` requests proxy to Astro; login, setup, and admin pages redirect to port 4321 so OAuth stays on its registered origin. After signing in, return to port 5173 (localhost cookies are shared across ports). Register `http://localhost:4321/api/auth/callback/google` in Google Cloud.

Database defaults to `apps/api/data/kinboard.db`. Existing `.env`, `.dev.vars`, local data, and `.wrangler` state were moved with the API during conversion. Existing absolute `DATABASE_URL` values remain valid. Local relative database URLs resolve from `apps/api`.

## Build and verify

```sh
npm run check
npm run build            # web assets + Astro Node server
npm test                 # integration tests against that built Node server, isolated temporary SQLite
npm run build:cloudflare # web assets + Astro Cloudflare server (replaces apps/api/dist)
```

The tests seed two separate families and verify authentication, permissions, tenant isolation, input validation, note creation/deletion, chore completion, and static asset delivery. Rebuild with `npm run build` before testing if the last build used Cloudflare.

## Cloudflare

Production uses an app Worker (`kinboard`, serving `app.kinboard.xyz`) and an API Worker (`kinboard-api`, serving `api.kinboard.xyz`) over the same D1 database. Astro continues to own Google login, sessions, authorization, and API routes. The static Vite web and admin bundles are staged under `/app/` and `/admin/` on the app Worker. The web client sends versioned `/api/v1` requests to the API domain with credentials; the API allows only the app origin. Auth.js sets its session cookie for `kinboard.xyz` so both subdomains can validate the same server-side session. Login and legacy admin form writes remain on the app origin. The Astro adapter also supplies its default SESSION KV and IMAGES bindings.

Configuration lives in `apps/api/wrangler.jsonc`; `apps/api/wrangler.api.jsonc` describes the API Worker and its custom domain. Both bind the existing D1 database ID. The API custom domain requires `api.kinboard.xyz` to be active in the same Cloudflare zone. Local builds do not change remote resources or data. See [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/) and the [Astro guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/).

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Fill in local secrets.
npm run cf:db:migrate:local
npm run cf:dev
```

Deployment, when desired:

```sh
npm exec --workspace @kinboard/api -- wrangler login
# Set secrets on the intended Worker, if not already configured:
npm exec --workspace @kinboard/api -- wrangler secret put AUTH_SECRET
npm exec --workspace @kinboard/api -- wrangler secret put GOOGLE_CLIENT_ID
npm exec --workspace @kinboard/api -- wrangler secret put GOOGLE_CLIENT_SECRET
npm run cf:db:migrate:remote
npm run cf:deploy
npm run cf:deploy:api
```

Set the same `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` secrets on both Workers. Register `https://app.kinboard.xyz/api/auth/callback/google` as the Google OAuth redirect URI. `npm run build:cloudflare:api` builds the web bundle with `https://api.kinboard.xyz` as its API base; ordinary local/dev builds continue to use the same-origin proxy. Deploy both Workers after the app domain, API custom domain, and Google redirect are configured.

Only use `npm run cf:db:create` when provisioning a new deployment, then replace its database ID in `apps/api/wrangler.jsonc`. Existing deployments keep their current database. Google OAuth's authorized redirect remains `https://<your-domain>/api/auth/callback/google`.

D1 migrations remain under `apps/api/drizzle`. No schema migration is required for the monorepo conversion. The existing migration history includes hand-written SQL without complete Drizzle snapshots; inspect generated SQL before applying schema changes.

## API and native roadmap

The initial `/api/v1` contract provides:

- `GET /api/v1/dashboard`: viewer, family, permissions, settings, members, chores, meals, notes, and upcoming events.
- `POST /api/v1/notes`: create a text note.
- `DELETE /api/v1/notes/{id}`: remove a note within your family.
- `PUT /api/v1/chores/{id}/completion`: set chore completion.

Responses use JSON with ISO date strings and integer cents. Errors use `{ "error": { "code": "…", "message": "…" } }`. Family data is private and never cacheable. Each collection is permission-filtered; mutations check authorization on the server.

This is an incremental migration. The full wall dashboard and existing admin forms are preserved in `apps/api`; settings, calendar management, family onboarding, allowance actions, media notes, and other legacy mutations have not yet moved into the versioned contract. The new web app links to those screens. The API remains the only workspace with database access.

Native authentication is **not yet implemented**. Auth.js currently uses browser session cookies. Before shipping native clients, implement a system-browser authorization flow with PKCE, verified app links, single-use code exchange, scoped/expiring tokens, and revocation. Do not copy Google refresh tokens, embed OAuth client secrets, or pass session cookies in deep links. See [architecture and migration plan](docs/architecture.md).

## Docker

```sh
docker compose up -d --build
```

Docker reads `apps/api/.env`, builds both workspaces, and serves from port 4321. The existing `kinboard-data` volume remains mounted at `/app/data`, with migrations applied on startup. Docker packaging has been updated for the monorepo; use the Node/Cloudflare build checks separately from a Docker runtime check.
