import 'dotenv/config';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from './client.ts';

await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });

console.log('Migrations applied');
