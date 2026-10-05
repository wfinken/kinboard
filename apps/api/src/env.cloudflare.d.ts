/// <reference types="@cloudflare/workers-types" />

// Extends the ambient `Cloudflare.Env` (declaration-merged by
// @cloudflare/workers-types) with the bindings declared in wrangler.jsonc.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }
}
