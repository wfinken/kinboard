# KinBoard

A self-hosted, low-resource family dashboard — a software alternative to
proprietary wall-mounted displays (Skylight, Echo Show). Built to run
comfortably on old tablets and smart TV browsers.

See [PRD.md](./PRD.md) for the full product spec and roadmap.

## Stack

- **Astro** (SSR) — the public kiosk dashboard ships close to zero client JS;
  the only islands are the live clock and the chore checkboxes.
- **Auth.js core** (`@auth/core`) — Google OAuth, wired directly rather than
  through the `auth-astro` community package, which is pinned to an
  `@auth/core` release with known CVEs (including an OAuth state/nonce/PKCE
  binding issue). See `src/lib/auth.ts` and `src/pages/api/auth/[...auth].ts`.
- **Drizzle ORM** over SQLite — `src/db/schema.ts`.
- **Tailwind CSS v4** (via `@tailwindcss/vite`, no separate config file).

KinBoard builds for two deployment targets from the same codebase:

| | Self-hosted (Docker/Node) | Cloudflare Workers |
|---|---|---|
| Astro adapter | `@astrojs/node` (`astro.config.mjs`) | `@astrojs/cloudflare` (`astro.config.cloudflare.mjs`) |
| Database | SQLite file via `@libsql/client` | Cloudflare D1 |
| Migrations | `drizzle-kit migrate` / `docker-entrypoint.sh` | `wrangler d1 migrations apply` |
| Secrets | `.env` | `wrangler secret put` / `wrangler.jsonc` `vars` |

Every `db/client` import is a plain relative import (`'../db/client'`); a Vite
alias in `astro.config.cloudflare.mjs` swaps it for `src/db/client.cloudflare.ts`
(D1) at build time, so none of the ~20 files that read/write the database
needed to change — see the note at the top of that file for why capturing the
D1 binding as a module-level singleton is safe under Workers.

## Local development

```bash
cp .env.example .env      # fill in AUTH_SECRET at minimum to run locally
npm install
npm run db:migrate        # applies drizzle/*.sql to ./data/kinboard.db
npm run dev
```

Generate `AUTH_SECRET` with `openssl rand -base64 33`.

The dashboard at `/` works immediately with no login. `/admin` requires
Google sign-in — without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set, the
sign-in button will redirect to Google with an empty client id and fail,
which is expected until you add real credentials (see below).

## Google OAuth setup

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   project and enable the **Google Calendar API**.
2. Under *APIs & Services → Credentials*, create an **OAuth 2.0 Client ID**
   (Web application).
3. Add an authorized redirect URI:
   `http(s)://<your-domain>/api/auth/callback/google`
4. Put the client ID/secret in `.env`.

Phase 1 is single-household self-hosting: whichever Google account signs in
first becomes the household's calendar owner (see
`src/lib/household.ts`). Multi-household support is a Phase 3 SaaS concern.

## Architecture notes

- **Public dashboard (`/`)** is unauthenticated by design — it's meant to be
  glanced at from a shared living-room screen, and the auto-refresh is a
  plain `<meta http-equiv="refresh">` tag so it works even on very old smart
  TV browsers with no JS. Chore checkboxes are the one interactive bit,
  posting to `/api/dashboard/chores/:id/toggle`, also unauthenticated —
  intended for use only within the trusted home network.
- **Admin routes (`/admin/*`, `/api/admin/*`)** require the household Google
  session (enforced in `src/middleware.ts`) and manage calendars, chores,
  meals, notes, and household members. Admin forms are plain HTML `<form>`
  POSTs with server-side redirects, so they work without JS too.
- **Chore "reset"** isn't a cron job — completions are keyed by the current
  day (`YYYY-MM-DD`) or ISO week (`YYYY-Www`), so a new period simply has no
  completion row yet. See `src/lib/chores.ts`.

## Docker deployment

```bash
cp .env.example .env   # fill in AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, location
docker compose up -d --build
```

The SQLite database lives in the `kinboard-data` named volume (mounted at
`/app/data`), and migrations run automatically on container start
(`docker-entrypoint.sh`). Update `KINBOARD_LAT`/`KINBOARD_LON` in `.env` to
your location for the weather widget (defaults to New York City), and
`KINBOARD_TIMEZONE` to your IANA timezone (defaults to `America/New_York`) so
chores/meals/the calendar agree on what day it is - the server's own clock
runs in UTC regardless of where the household actually is.

## Cloudflare Workers deployment

**Live at https://app.kinboard.xyz** (also reachable at
https://kinboard.wfinken.workers.dev — attaching a custom domain doesn't
disable the `workers.dev` one).

An alternative to self-hosting: deploy KinBoard to Cloudflare's free tier
(Workers + D1). No server, Docker, or Raspberry Pi to maintain — Cloudflare
runs it. This uses [D1](https://developers.cloudflare.com/d1/) (Cloudflare's
SQLite-compatible database) instead of a local SQLite file, since Workers
have no filesystem.

### 1. Prerequisites

```bash
npm install                    # picks up @astrojs/cloudflare and wrangler
npx wrangler login              # opens a browser to authorize the CLI
```

### 2. Create the D1 database

```bash
npm run cf:db:create
```

This prints a `database_id`. Open `wrangler.jsonc` and paste it in place of
`REPLACE_WITH_YOUR_D1_DATABASE_ID` under `d1_databases`.

### 3. Apply migrations to the new database

```bash
npm run cf:db:migrate:remote
```

This runs the same SQL files under `./drizzle/` (generated by
`drizzle-kit generate`) that the Docker/Node build uses — `wrangler.jsonc`
points D1's migration runner at that folder (`migrations_dir: "drizzle"`)
instead of duplicating migrations. Whenever you change `src/db/schema.ts` and
run `npm run db:generate`, re-run this command to apply the new migration to
D1 too.

### 4. Configure Google OAuth for your Workers domain

Follow [Google OAuth setup](#google-oauth-setup) above, but set the redirect
URI to match where this will be deployed. The production instance uses:

```
https://app.kinboard.xyz/api/auth/callback/google
```

Add one redirect URI per domain the app is actually reachable at — the OAuth
client can list more than one. If you're forking this for your own
deployment before attaching a custom domain, use your `workers.dev` URL
instead: `https://<worker-name>.<your-subdomain>.workers.dev/api/auth/callback/google`.

### 5. Set secrets

`AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are secrets, not
plain vars, so they're pushed individually rather than committed to
`wrangler.jsonc`:

```bash
npx wrangler secret put AUTH_SECRET          # paste output of: openssl rand -base64 33
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

The weather widget's location (`KINBOARD_LAT`/`KINBOARD_LON`/`KINBOARD_TEMP_UNIT`)
and the household's `KINBOARD_TIMEZONE` aren't sensitive — they're already
set as plain `vars` in `wrangler.jsonc`; edit the values there directly for
your location.

### 6. Deploy

```bash
npm run cf:deploy
```

This builds with the Cloudflare adapter and runs `wrangler deploy`. Re-run it
for every future update.

### 7. (Optional) Attach a custom domain

The default `<worker-name>.<subdomain>.workers.dev` URL always keeps working.
To serve from your own domain instead (or as well — production uses
`app.kinboard.xyz` on top of the `workers.dev` URL), add it from the
Cloudflare dashboard: **Workers & Pages → kinboard → Settings → Domains &
Routes → Add → Custom Domain**. Cloudflare provisions the DNS record and TLS
certificate automatically if the domain's zone is already on your Cloudflare
account. See [Custom
Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Once attached, add the new domain's redirect URI to the Google OAuth client
(step 4) — sign-in will fail with `redirect_uri_mismatch` on any domain that
isn't listed there.

### Local development against Cloudflare's runtime

`npm run dev` (the default) still runs the Node build for day-to-day work.
To test against a local, fully-emulated Workers + D1 environment instead
(closer to production, no real Cloudflare account needed):

```bash
cp .dev.vars.example .dev.vars     # fill in AUTH_SECRET at minimum
npm run cf:db:migrate:local        # applies drizzle/*.sql to a local D1 instance
npm run cf:dev                     # astro dev --config astro.config.cloudflare.mjs
```

`npm run cf:dev` uses `@astrojs/cloudflare`'s Vite plugin, which runs your
actual Worker code against `workerd` (the real Cloudflare runtime, not a
Node polyfill) with local D1 storage under `.wrangler/`.

### Type-checking the Cloudflare build

`npm run build` / `astro check` type-check against `tsconfig.json`, which
deliberately excludes `src/db/client.cloudflare.ts` — mixing
`@cloudflare/workers-types` globals into the same TypeScript project as
Node's ambient types causes spurious conflicts. Use
`npm run check:cloudflare` (backed by `tsconfig.cloudflare.json`) to
type-check the Cloudflare-specific file instead; `npm run build:cloudflare`
runs this automatically before building.

## Known trade-offs

- `npm audit` reports one moderate, dev-only advisory in an old `esbuild`
  pulled in transitively by `drizzle-kit`'s config loader. It only affects
  running `drizzle-kit` locally (not the built app or Docker image) and the
  only fix is a major `drizzle-kit` downgrade, which isn't worth it for a
  dev-time-only tool.
- `wrangler deploy` reports two bindings we never asked for: `env.SESSION`
  (a KV namespace) and `env.IMAGES`. `@astrojs/cloudflare` provisions these
  automatically for Astro's own built-in sessions/image-processing features;
  KinBoard doesn't use either, so they're inert, but they'll show up in the
  Cloudflare dashboard.
