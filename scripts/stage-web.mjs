import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
const publicDir = new URL('../apps/api/public/', import.meta.url);
const web = new URL('app/', publicDir);
// These directories contain only generated web assets, never source files.
await rm(web, { recursive: true, force: true });
await mkdir(web, { recursive: true });
await cp(new URL('../apps/web/dist/', import.meta.url), web, { recursive: true });
const html = await readFile(new URL('index.html', web), 'utf8');
const admin = new URL('admin/', publicDir);
await rm(admin, { recursive: true, force: true });
for (const route of ['', 'calendars', 'meals', 'notes', 'layout', 'chores', 'allowance', 'family', 'permissions', 'account']) {
  const directory = new URL(`${route ? `${route}/` : ''}`, admin);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('index.html', directory), html);
}
