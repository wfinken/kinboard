# KinBoard

A self-hosted, low-resource family dashboard — a software alternative to
proprietary wall-mounted displays (Skylight, Echo Show). Built to run
comfortably on old tablets and smart TV browsers.

See [PRD.md](./PRD.md) for the full product spec and roadmap.

## Stack

- **Astro** (SSR, Node adapter) — the public kiosk dashboard ships close to
  zero client JS; the only islands are the live clock and the chore
  checkboxes.
- **Auth.js core** (`@auth/core`) — Google OAuth, wired directly rather than
  through the `auth-astro` community package, which is pinned to an
  `@auth/core` release with known CVEs (including an OAuth state/nonce/PKCE
  binding issue). See `src/lib/auth.ts` and `src/pages/api/auth/[...auth].ts`.
- **Drizzle ORM + libSQL** (SQLite) — `src/db/schema.ts`.
- **Tailwind CSS v4** (via `@tailwindcss/vite`, no separate config file).

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
your location for the weather widget (defaults to New York City).

## Known trade-offs

- `npm audit` reports one moderate, dev-only advisory in an old `esbuild`
  pulled in transitively by `drizzle-kit`'s config loader. It only affects
  running `drizzle-kit` locally (not the built app or Docker image) and the
  only fix is a major `drizzle-kit` downgrade, which isn't worth it for a
  dev-time-only tool.
