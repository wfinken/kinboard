// Used only in the Cloudflare Workers build (astro.config.cloudflare.mjs
// aliases every `db/client` import here instead of ./client.ts, which pulls
// in @libsql/client's native bindings that don't exist in workerd).
//
// `env` from `cloudflare:workers` resolves per-request even though it's read
// once here at module scope — Cloudflare docs confirm this is the supported
// pattern for capturing a binding-backed client (like a Drizzle instance) as
// a module-level singleton: https://developers.cloudflare.com/workers/runtime-apis/bindings/
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

export const db = drizzle(env.DB, { schema });
