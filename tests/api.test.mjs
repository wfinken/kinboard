import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createClient } from '@libsql/client';

let directory, db, server, base;
let output = '';
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kinboard-api-'));
  const url = `file:${join(directory, 'test.db')}`;
  db = createClient({ url });
  const migrations = new URL('../apps/api/drizzle/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) {
    await db.executeMultiple(await readFile(new URL(file, migrations), 'utf8'));
  }
  await db.executeMultiple(`
    INSERT INTO user (id,name,email) VALUES ('owner','Alex','alex@example.test'),('other','Other','other@example.test'),('restricted','Restricted','restricted@example.test'),('new','New','new@example.test');
    INSERT INTO family (id,name,owner_user_id,created_at) VALUES ('home','Our family','owner',0),('away','Another family','other',0);
    INSERT INTO family_membership (family_id,user_id,role,joined_at) VALUES ('home','owner','owner',0),('away','other','owner',0),('home','restricted','member',0);
    INSERT INTO session (sessionToken,userId,expires) VALUES ('owner-session','owner',4102444800000),('restricted-session','restricted',4102444800000),('new-session','new',4102444800000);
    INSERT INTO chore (id,title,family_id) VALUES ('our-chore','Feed the cat','home'),('their-chore','Private chore','away');
    INSERT INTO sticky_note (id,content,family_id,created_at) VALUES ('our-note','Hello family','home',0),('their-note','Private note','away',0);
    INSERT INTO permission (family_id,user_id,feature,can_read,can_create,can_update,can_delete) VALUES ('home','restricted','notes',0,0,0,0),('home','restricted','chores',0,0,0,0);
  `);
  const socket = createServer();
  socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['apps/api/dist/server/entry.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, DATABASE_URL: url, AUTH_SECRET: 'integration-test-secret-not-for-production', GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test', KINBOARD_APP_ORIGIN: 'https://app.kinboard.xyz', AUTH_COOKIE_DOMAIN: 'kinboard.xyz', HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { output += chunk; }); server.stderr.on('data', chunk => { output += chunk; });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try { await fetch(`${base}/app/`); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error(`Server did not start: ${output}`);
});
after(async () => { if (server && server.exitCode === null) { server.kill(); await once(server, 'exit'); } db?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });
const request = (path, { session = 'owner-session', ...init } = {}) => fetch(`${base}${path}`, { redirect: 'manual', ...init, headers: { Origin: base, ...(session ? { Cookie: `authjs.session-token=${session}` } : {}), ...init.headers } });
const write = (path, body, options = {}) => request(path, { method: 'POST', body: JSON.stringify(body), ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });

test('static web shell and assets are served without authentication', async () => {
  const response = await request('/app/', { session: null });
  assert.equal(response.status, 200);
  const html = await response.text(); assert.match(html, /KinBoard/);
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await request(asset, { session: null })).status, 200);
});
test('unauthenticated API returns JSON 401, never a login page', async () => {
  const response = await request('/api/v1/dashboard', { session: null });
  assert.equal(response.status, 401); assert.equal((await response.json()).error.code, 'unauthorized');
});
test('users without a family receive actionable JSON', async () => {
  const response = await request('/api/v1/dashboard', { session: 'new-session' });
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'family_required');
});
test('dashboard scopes every collection to the signed-in family', async () => {
  const response = await request('/api/v1/dashboard');
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('set-cookie') ?? '', /Domain=kinboard\.xyz/);
  const body = await response.json();
  assert.deepEqual(body.chores.map(c => c.id), ['our-chore']);
  assert.deepEqual(body.notes.map(n => n.id), ['our-note']);
  assert.equal(body.family.id, 'home');
  assert.equal('email' in body.user, false);
});
test('versioned API allows credentialed browser access only from the configured app origin', async () => {
  const response = await request('/api/v1/dashboard', { headers: { Origin: 'https://app.kinboard.xyz' } });
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.kinboard.xyz');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  const preflight = await request('/api/v1/dashboard', { method: 'OPTIONS', headers: { Origin: 'https://app.kinboard.xyz', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://app.kinboard.xyz');
  const denied = await request('/api/v1/dashboard', { headers: { Origin: 'https://attacker.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
test('restricted data stays out of the API and mutations are forbidden', async () => {
  const options = { session: 'restricted-session' };
  const body = await (await request('/api/v1/dashboard', options)).json();
  assert.deepEqual(body.notes, []); assert.deepEqual(body.chores, []);
  assert.equal((await write('/api/v1/notes', { content: 'no' }, options)).status, 403);
  assert.equal((await write('/api/v1/chores/our-chore/completion', { completed: true }, { ...options, method: 'PUT' })).status, 403);
});
test('JSON validation and cross-origin protections', async () => {
  assert.equal((await write('/api/v1/notes', { content: 'hello' }, { headers: { Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request('/api/v1/notes', { method: 'POST', body: 'content=hello' })).status, 415);
  for (const input of [null, [], 'text', {}, { content: ' ' }, { content: 'a'.repeat(2001) }, { content: 'hello', color: 'red' }]) assert.equal((await write('/api/v1/notes', input)).status, 400);
  assert.equal((await write('/api/v1/chores/our-chore/completion', { completed: 'false' }, { method: 'PUT' })).status, 400);
});
test('notes can be created and removed, but another family’s notes cannot', async () => {
  const response = await write('/api/v1/notes', { content: 'A new note' });
  assert.equal(response.status, 201); const note = await response.json();
  assert.equal(note.authorName, 'Alex'); assert.equal(typeof note.createdAt, 'string');
  assert.equal((await request('/api/v1/notes/their-note', { method: 'DELETE' })).status, 404);
  assert.equal((await request(`/api/v1/notes/${note.id}`, { method: 'DELETE' })).status, 204);
});
test('chore completion persists and cannot target another family', async () => {
  assert.equal((await write('/api/v1/chores/their-chore/completion', { completed: true }, { method: 'PUT' })).status, 404);
  assert.equal((await write('/api/v1/chores/our-chore/completion', { completed: true }, { method: 'PUT' })).status, 204);
  assert.equal((await (await request('/api/v1/dashboard')).json()).chores[0].completed, true);
  assert.equal((await write('/api/v1/chores/our-chore/completion', { completed: false }, { method: 'PUT' })).status, 204);
});

test('every admin URL serves the static web shell, with no private page data', async () => {
  for (const path of ['', 'calendars', 'meals', 'notes', 'layout', 'chores', 'allowance', 'family', 'permissions', 'account']) {
    const response = await request(`/admin/${path ? `${path}/` : ''}`, { session: null });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /id="app"/); assert.doesNotMatch(html, /alex@example|Hello family/);
  }
});
test('legacy singular calendar URL redirects to the web calendar admin page', async () => {
  const response = await request('/admin/calendar?view=month', { session: null });
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get('location'));
  assert.equal(`${location.pathname}${location.search}`, '/admin/calendars/?view=month');
});
test('all admin read endpoints return typed data and no provider secrets', async () => {
  for (const section of ['overview', 'calendars', 'meals', 'notes', 'layout', 'chores', 'allowance', 'family', 'permissions', 'account']) {
    const response = await request(`/api/v1/admin/${section}`);
    assert.equal(response.status, 200, `${section}: ${await response.clone().text()}`);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const data = await response.json(); assert.equal(data.section, section); assert.equal(data.family.id, 'home');
    assert.ok(data.data); assert.equal(data.owner, true);
    assert.doesNotMatch(JSON.stringify(data), /refresh_token|access_token|sessionToken|Private note|Private chore/);
  }
  assert.equal((await request('/api/v1/admin/unknown')).status, 404);
});
test('admin APIs enforce read grants, ownership, and authentication', async () => {
  for (const section of ['chores', 'notes', 'permissions']) {
    const response = await request(`/api/v1/admin/${section}`, { session: 'restricted-session' });
    assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'forbidden');
  }
  const overview = await (await request('/api/v1/admin/overview', { session: 'restricted-session' })).json();
  assert.equal(overview.data.stats.some(s => s.label === 'Notes' || s.label === 'Chores'), false);
  const denied = await request('/api/v1/admin/account', { session: null });
  assert.equal(denied.status, 401);
});
const adminForm = (action, values, options = {}) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return request(`/api/admin/${action}`, { method: 'POST', body, ...options, headers: { Accept: 'application/json', ...options.headers } });
};
test('web forms return JSON and persist account, family, chores, notes, and meals', async () => {
  const actions = [
    ['account/name', { name: 'Alex Updated' }],
    ['members', { name: 'Child', color: '#38bdf8' }],
    ['chores', { title: 'Set the table', frequency: 'daily', rewardType: 'xp', rewardPoints: '20' }],
    ['notes', { content: 'From the web admin', color: '#facc15', authorName: 'Alex' }],
    ['meals', { date: '2099-12-01', mealType: 'dinner', description: 'Pasta' }],
  ];
  for (const [action, values] of actions) {
    const response = await adminForm(action, values);
    assert.equal(response.status, 200, `${action}: ${await response.clone().text()}`);
    assert.equal((await response.json()).ok, true);
    assert.equal(response.headers.get('location'), null);
  }
  assert.equal((await (await request('/api/v1/admin/account')).json()).user.name, 'Alex Updated');
  assert.ok((await (await request('/api/v1/admin/family')).json()).data.members.some(m => m.name === 'Child'));
  assert.ok((await (await request('/api/v1/admin/chores')).json()).data.chores.some(c => c.title === 'Set the table'));
  assert.ok((await (await request('/api/v1/admin/notes')).json()).data.notes.some(n => n.content === 'From the web admin'));
  const meal = (await (await request('/api/v1/admin/meals')).json()).data.meals.find(m => m.description === 'Pasta');
  assert.ok(meal);
  await adminForm('meals', { deleteId: meal.id });
  assert.equal((await (await request('/api/v1/admin/meals')).json()).data.meals.some(m => m.id === meal.id), false);
});
test('form API failures are JSON and cannot bypass tenant or permission checks', async () => {
  await db.execute("INSERT INTO household_member (id,name,family_id) VALUES ('foreign-member','Foreign child','away')");
  const cases = [
    ['chores', { title: 'Bad assignment', memberId: 'foreign-member' }, {}, 400],
    ['notes', { content: '' }, {}, 400],
    ['members', { name: '' }, {}, 400],
    ['notes', { content: 'Denied' }, { session: 'restricted-session' }, 403],
    ['account/name', { name: 'Anonymous' }, { session: null }, 401],
  ];
  // Astro rejects cross-origin multipart requests before application middleware.
  assert.equal((await adminForm('account/name', { name: 'Attacker' }, { headers: { Origin: 'https://attacker.example' } })).status, 403);
  for (const [action, values, options, status] of cases) {
    const response = await adminForm(action, values, options);
    assert.equal(response.status, status, action); assert.ok((await response.json()).error.message);
  }
});
test('display settings can disable widgets, retain time zone, and change order', async () => {
  let response = await adminForm('settings/widgets', { widget_clock: 'on', widget_chores: 'on', size_clock: '2x1', theme: 'light', timezone: 'America/Chicago', refreshSeconds: '60' });
  assert.equal(response.status, 200);
  let settings = (await (await request('/api/v1/admin/layout')).json()).settings;
  assert.deepEqual(settings.widgetOrder, ['clock', 'chores']); assert.equal(settings.timezone, 'America/Chicago');
  await adminForm('settings/widgets/move', { widgetId: 'chores', direction: 'up' });
  settings = (await (await request('/api/v1/admin/layout')).json()).settings;
  assert.deepEqual(settings.widgetOrder, ['chores', 'clock']);
});
test('permissions editor remains owner-only and saves grants', async () => {
  assert.equal((await adminForm('permissions/owner', {}, { session: 'restricted-session' })).status, 403);
  assert.equal((await adminForm('permissions/other', {})).status, 404);
  const response = await adminForm('permissions/restricted', { 'notes.read': 'on' });
  assert.equal(response.status, 200);
  const page = await request('/api/v1/admin/notes', { session: 'restricted-session' });
  assert.equal(page.status, 200);
  assert.equal((await adminForm('notes', { content: 'Still denied' }, { session: 'restricted-session' })).status, 403);
});
test('calendar writes, XP goals, and allowance funding still work from web forms', async () => {
  assert.equal((await adminForm('events', { title: 'Family picnic', start: '2099-12-01', end: '2099-12-01', allDay: 'on', calendarId: 'local' })).status, 200);
  assert.equal((await db.execute("SELECT title FROM calendar_event WHERE family_id='home'")).rows[0].title, 'Family picnic');
  assert.equal((await adminForm('xp-goals', { title: 'Movie night', targetPoints: '100' })).status, 200);
  assert.ok((await (await request('/api/v1/admin/chores')).json()).data.goals.some(g => g.title === 'Movie night'));
  assert.equal((await adminForm('allowance/fund', { amount: '10.50', note: 'Weekly pool' })).status, 200);
  assert.equal((await (await request('/api/v1/admin/allowance')).json()).data.balanceCents, 1050);
});
test('family invitations are JSON; QR rendering belongs to the web app', async () => {
  const response = await request('/api/family/invite', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 201);
  const invite = await response.json(); assert.match(invite.token, /^[A-Za-z0-9]{10}$/); assert.ok(new URL(invite.url).hostname.endsWith('.invite.kinboard.xyz'));
  assert.ok(Date.parse(invite.expiresAt) > Date.now()); assert.equal('html' in invite, false);
  assert.equal(new URL(invite.directUrl).origin, 'https://app.kinboard.xyz');
});
