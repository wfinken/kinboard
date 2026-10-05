# Architecture and migration

## Decision

Use npm workspaces, Astro for the backend, and Vite with plain TypeScript for the new web client. A separate frontend SSR runtime is unnecessary for a private dashboard. The web client is a static asset bundle and consumes HTTP JSON. Swift and Kotlin will consume the same versioned HTTP contract, without depending on TypeScript implementation code.

Keep Drizzle, Auth.js, Google calendar integrations, and database access inside `apps/api`. Share transport contracts only. Do not move server models into the client package: database columns include provider credentials, session tokens, and internal tenant identifiers that are not client APIs.

```text
Browser web client ─── api.kinboard.xyz/api/v1 ──┐
Future Swift / Kotlin clients ────┤
                                ▼
                    Astro + authorization + services
                                │
                      D1 / Google Calendar
```

Cloudflare deploys the static web/admin bundle and login routes on the app Worker at `app.kinboard.xyz`, and the Astro API on `api.kinboard.xyz`. Both Workers use the existing D1 database. The web client sends credentialed requests from the app origin; the API uses exact-origin CORS and an Auth.js session cookie scoped to `kinboard.xyz`. Legacy admin writes and Google OAuth callbacks stay on the app Worker. The API remains Astro, so its auth/session logic and middleware are shared with the app deployment. Local Node/SQLite and Docker builds remain supported.

## Compatibility during migration

The existing wall dashboard stays at `/` and admin screens at `/admin`. Their source moved into `apps/api` without rewriting existing workflows. The new frontend at `/app/` accesses only the typed HTTP client. Its initial features cover the family overview, event/meal reads, text notes, and chore completion. Admin and advanced wall features remain accessible through links.

Existing weather and stylesheet edits are preserved in the moved wall UI. Worker configuration now targets `app.kinboard.xyz` and `api.kinboard.xyz`; deployment and Google OAuth provider settings remain an operator action.

## Next native milestone

`packages/contracts/openapi.json` describes the implemented v1 operations. Use it to generate or validate Swift Codable/URLSession and Kotlin serialization/HTTP models. `createdAt` is an ISO timestamp, event start/end may be a date or local/offset datetime, money is integer cents, and missing household context is a JSON 409 `family_required` response.

Before native apps can sign in, add a dedicated authorization flow. Use ASWebAuthenticationSession on iOS and the system browser on Android. Keep Google credentials on the server. Add PKCE-bound, short-lived authorization codes, exact verified redirect allowlists, one-time exchange, expiring access tokens, rotated refresh tokens, and per-device revocation. Specify that flow in OpenAPI and add lifecycle/replay tests before enabling native clients. Existing Auth.js session cookies are for the web flow and are not a finished native authorization protocol.

Promote the remaining legacy operations into v1 by feature: onboarding/membership, calendar management and event writes, meal planning, chores and rewards, allowance, settings, media notes. Reuse server services, retain family/permission checks, and add integration tests for each boundary. Keep the legacy screens until feature parity is verified; then move the web app to `/` and retire the server-rendered views. Do not expose legacy form endpoints as a promised mobile contract.
