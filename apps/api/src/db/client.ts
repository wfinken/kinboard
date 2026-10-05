import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.ts';

const url = process.env.DATABASE_URL ?? 'file:./data/kinboard.db';

// libsql won't create the parent directory for a local db file itself.
if (url.startsWith('file:')) {
  mkdirSync(dirname(resolve(process.cwd(), url.slice('file:'.length))), { recursive: true });
}

const client = createClient({ url });

export const db = drizzle(client, { schema });
