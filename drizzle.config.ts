import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'file:./data/kinboard.db';

// drizzle-kit won't create the parent directory for a local db file itself.
if (url.startsWith('file:')) {
  mkdirSync(dirname(resolve(process.cwd(), url.slice('file:'.length))), { recursive: true });
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url },
});
