import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// Every `db/client` import (all relative, e.g. '../db/client',
// '../../../../db/client') resolves to this D1-backed client instead of the
// libsql one, which pulls in native bindings that don't exist in workerd.
const cloudflareDbClient = fileURLToPath(new URL('./src/db/client.cloudflare.ts', import.meta.url));

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: [{ find: /^(\.\.\/)+db\/client$/, replacement: cloudflareDbClient }],
    },
  },
});
