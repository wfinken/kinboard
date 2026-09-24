import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.ts';

const url = process.env.DATABASE_URL ?? 'file:./data/kinboard.db';

const client = createClient({ url });

export const db = drizzle(client, { schema });
