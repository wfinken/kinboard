import { ADMIN_SECTIONS, WIDGETS, ApiClientError, createClient, type AdminSection, type AdminPage, type AdminContext, type AdminMember, type Feature } from '@kinboard/contracts';
import './admin.css';
import { displayTimezone } from './timezone';

const api = createClient(__KINBOARD_API_BASE_URL__);
const root = document.querySelector<HTMLDivElement>('#kinboard-page')!;
const titles: Record<AdminSection, string> = { overview: 'Overview', calendars: 'Calendars', meals: 'Meals', notes: 'Bulletin board', layout: 'Display', chores: 'Chores', allowance: 'Allowance', family: 'Family', permissions: 'Permissions', account: 'Account' };
const features: Partial<Record<AdminSection, Feature>> = { calendars: 'calendars', meals: 'meals', notes: 'notes', chores: 'chores', allowance: 'allowance', family: 'family' };
const widgetLabels = { clock: 'Clock', weather: 'Weather', latest: 'Latest activity', calendar: 'Calendar', meals: 'Meal plan', chores: 'Chores', availability: 'Availability', allowance: 'Allowance', notes: 'Bulletin board' };
const timezones = ['auto', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'];
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const path = (section: AdminSection) => `/admin/${section === 'overview' ? '' : `${section}/`}`;
const idPath = (id: string) => encodeURIComponent(id);
const hidden = (name: string, value: string) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`;
const input = (label: string, name: string, value = '', attributes = '') => `<label>${escape(label)}<input name="${escape(name)}" value="${escape(value)}" ${attributes}></label>`;
const option = (value: string, label: string, selected = '') => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(label)}</option>`;
const select = (label: string, name: string, options: string, attributes = '') => `<label>${escape(label)}<select name="${escape(name)}" ${attributes}>${options}</select></label>`;
const check = (label: string, name: string, checked = false, attributes = '') => `<label class="check"><input type="checkbox" name="${escape(name)}" ${checked ? 'checked' : ''} ${attributes}>${escape(label)}</label>`;
const form = (action: string, fields: string, label = 'Save', attributes = '') => `<form data-admin-form action="/api/admin/${action}" method="post" ${attributes}><div class="fields">${fields}</div><button class="primary" type="submit">${escape(label)}</button></form>`;
const remove = (action: string, fields = '') => form(action, fields, 'Remove', 'class="inline-form"');
const card = (title: string, content: string, description = '') => `<section class="card"><h2>${escape(title)}</h2>${description ? `<p class="description">${escape(description)}</p>` : ''}${content}</section>`;
const empty = (label: string) => `<p class="empty">${escape(label)}</p>`;
const memberOptions = (members: AdminMember[], value = '') => option('', 'Everyone', value) + members.map(m => option(m.id, m.name, value)).join('');
const timezoneField = (value: string) => select('Household time zone', 'timezone', [...new Set([...timezones, value])].map(t => option(t, t === 'auto' ? 'Server default' : t.replaceAll('_', ' '), value)).join(''));
const visible = (page: AdminContext, section: AdminSection) => section === 'permissions' ? page.owner : !features[section] || page.permissions[features[section]!].read;
let busy = false;
let section: AdminSection = 'overview';
let active = false;
let loadGeneration = 0;

function overview(page: AdminPage<'overview'>) {
  return `<div class="stats">${page.data.stats.map(s => `<div><strong>${escape(s.value)}</strong><span>${escape(s.label)}</span></div>`).join('')}</div>` +
    (page.data.attention.length ? card('Needs a little attention', `<ul class="rows">${page.data.attention.map(a => `<li><a href="${path(a.section)}">${escape(a.label)} →</a></li>`).join('')}</ul>`) : '') +
    `<div class="admin-quicklinks">${ADMIN_SECTIONS.filter(s => s !== 'overview' && visible(page, s)).map(s => `<a class="card" href="${path(s)}"><h2>${titles[s]}</h2><span>Open ${titles[s].toLowerCase()} →</span></a>`).join('')}</div>`;
}
function calendars(page: AdminPage<'calendars'>) {
  const { data, permissions: p, settings } = page;
  const calendarOptions = option('local', 'KinBoard only', settings.defaultEventCalendarId) + data.writableCalendars.map(c => option(c.id, `Google: ${c.name}`, settings.defaultEventCalendarId)).join('');
  return (p.calendars.update ? card('Default event destination', form('settings/default-event-calendar', select('Calendar', 'defaultEventCalendarId', calendarOptions))) : '') +
    (p.calendars.create ? card('Add a family event',
      (!data.hasEventWriteScope ? `<p><a class="text-link" href="/api/admin/calendars/connect?returnTo=%2Fadmin%2Fcalendars%2F">Connect Google event access →</a></p>` : '') +
      form('events', hidden('returnTo', '/admin/calendars/') + input('Event title', 'title', '', 'required maxlength="200"') + select('Family member', 'memberId', memberOptions(data.members)) + check('All day', 'allDay', false, 'data-all-day') + input('Starts', 'start', '', 'type="datetime-local" required data-event-date') + input('Ends', 'end', '', 'type="datetime-local" required data-event-date') + input('Location', 'location', '', 'maxlength="500"') + `<label>Description<textarea name="description" rows="3" maxlength="5000"></textarea></label>` + select('Add to', 'calendarId', calendarOptions), 'Add event'), `Times use ${data.timezone}. Events can be saved to KinBoard or a connected Google calendar.`) : '') +
    card('Your Google calendars', (p.calendars.create ? form('calendars/sync', '', 'Sync from Google') : '') + (data.calendars.length ? `<ul class="rows">${data.calendars.map(c => `<li><div><strong>${escape(c.name)}</strong><small>${c.enabled ? 'Shown on dashboard' : 'Hidden'}</small></div>${p.calendars.update ? form(`calendars/${idPath(c.id)}`, input('Color', 'color', c.color, 'type="color"') + check('Show on dashboard', 'enabled', c.enabled)) : ''}</li>`).join('')}</ul>` : empty('No calendars synced yet.')));
}
function meals(page: AdminPage<'meals'>) {
  const { meals } = page.data, p = page.permissions.meals;
  const fields = input('Date', 'date', '', 'type="date" required') + select('Meal', 'mealType', ['breakfast', 'lunch', 'dinner'].map(t => option(t, t)).join('')) + input('What’s on the menu?', 'description', '', 'required maxlength="240"');
  return ((p.create || p.update) ? card('Plan a meal', form('meals', fields, 'Save meal'), 'One meal per date and type. Saving an existing slot updates it when you have permission.') : '') +
    card('Upcoming meals', meals.length ? `<ul class="rows">${meals.map(m => `<li><div><strong>${escape(m.description)}</strong><small>${escape(m.date)} · ${m.mealType}</small></div>${p.delete ? remove('meals', hidden('deleteId', m.id)) : ''}</li>`).join('')}</ul>` : empty('No meals planned yet.'));
}
function media(url: string | null, type: string | null) {
  if (!url || !/^(https?:\/\/|data:(image|audio)\/)/i.test(url)) return '';
  return type === 'audio' ? `<audio controls src="${escape(url)}"></audio>` : `<img class="note-media" src="${escape(url)}" alt="Note attachment" loading="lazy">`;
}
function notes(page: AdminPage<'notes'>) {
  const p = page.permissions.notes;
  return (p.create ? card('Leave something for the family', form('notes', input('Note', 'content', '', 'required maxlength="2000"') + input('From', 'authorName', page.user.name ?? '', 'maxlength="100"') + input('Color', 'color', '#facc15', 'type="color"') + input('Photo or audio (up to 2 MB)', 'media', '', 'type="file" accept="image/*,audio/*"'), 'Add note')) : '') +
    `<div class="admin-notes">${page.data.notes.map(n => `<article class="note" style="background:${/^#[0-9a-f]{6}$/i.test(n.color) ? n.color : '#facc15'}">${media(n.mediaUrl, n.mediaType)}<p>${escape(n.content)}</p><div><small>${escape(n.authorName)}</small>${p.delete ? remove(`notes/${idPath(n.id)}/delete`) : ''}</div></article>`).join('') || empty('No notes yet.')}</div>`;
}
function chores(page: AdminPage<'chores'>) {
  const { chores, members, goals } = page.data, p = page.permissions.chores;
  const name = (id: string | null) => members.find(m => m.id === id)?.name ?? 'Everyone';
  const fields = input('Chore', 'title', '', 'required maxlength="200"') + select('Assign to', 'memberId', memberOptions(members)) + select('Resets', 'frequency', option('daily', 'Every day') + option('weekly', 'Every week')) + select('Reward', 'rewardType', option('xp', 'XP') + option('allowance', 'Allowance'), 'data-reward-type') + `<div data-xp-field>${input('XP points', 'rewardPoints', '10', 'type="number" min="1" max="100000"')}</div><div data-allowance-field hidden>${input('Allowance ($)', 'rewardAmount', '1', 'type="number" min="0" step="0.01"')}${check('Allow bids', 'allowanceEnabled')}${input('Maximum bid ($)', 'maxBid', '2', 'type="number" min="0.01" step="0.01"')}</div>` + input('Category', 'category', 'General') + select('Rotate with', 'rotationMemberId', option('', 'No rotation') + members.map(m => option(m.id, m.name)).join('')) + check('Household bounty', 'bounty');
  return (p.create ? card('Add a chore', form('chores', fields, 'Add chore')) : '') +
    card('Household chores', chores.length ? `<ul class="rows">${chores.map(c => `<li><div><strong>${escape(c.title)}</strong><small>${escape(name(c.memberId))}${c.rotationMemberId ? ` / ${escape(name(c.rotationMemberId))}` : ''} · ${escape(c.category)} · ${c.frequency} · ${c.rewardType === 'xp' ? `${c.rewardPoints} XP` : money(c.rewardCents)}${c.bounty ? ' · bounty' : ''}${c.allowanceEnabled ? ` · bids up to ${money(c.maxBidCents)}` : ''}</small></div>${p.delete ? remove(`chores/${idPath(c.id)}/delete`) : ''}</li>`).join('')}</ul>` : empty('No chores yet.')) +
    card('XP goals', (p.create ? form('xp-goals', input('Goal', 'title', '', 'required maxlength="80"') + select('Who', 'memberId', memberOptions(members)) + input('XP target', 'targetPoints', '100', 'type="number" required min="1" max="1000000"'), 'Add goal') : '') + (goals.length ? `<ul class="rows">${goals.map(g => `<li><div><strong>${escape(g.title)}</strong><small>${escape(name(g.memberId))} · ${g.earnedPoints} / ${g.targetPoints} XP</small><progress max="${g.targetPoints}" value="${Math.min(g.targetPoints, g.earnedPoints)}" aria-label="${escape(g.title)} progress"></progress></div>${p.delete ? remove('xp-goals', hidden('intent', 'delete') + hidden('id', g.id)) : ''}</li>`).join('')}</ul>` : empty('Add a goal to work toward together.')));
}
function allowance(page: AdminPage<'allowance'>) {
  const d = page.data, p = page.permissions.allowance;
  const status = { pending: 'Awaiting approval', approved: 'Approved · awaiting completion', rejected: 'Declined', paid: 'Paid' };
  return `<div class="stats">${[['Pool balance', d.balanceCents], ['Reserved', d.reservedCents], ['Available', d.availableCents]].map(([label, cents]) => `<div><strong>${money(Number(cents))}</strong><span>${label}</span></div>`).join('')}</div>` +
    (p.create ? card('Add to the allowance pool', form('allowance/fund', input('Amount ($)', 'amount', '', 'type="number" required min="0.01" max="10000" step="0.01"') + input('Note', 'note', '', 'maxlength="160"'), 'Add funds')) : '') +
    card('Bids', d.bids.length ? `<ul class="rows">${d.bids.map(b => `<li><div><strong>${escape(b.choreTitle)} · ${money(b.amountCents)}</strong><small>${escape(b.memberName)} · ${status[b.status]}</small></div>${b.status === 'pending' && p.update ? `<div class="row-actions">${form(`allowance/bids/${idPath(b.id)}`, hidden('decision', 'approve'), 'Approve', 'class="inline-form"')}${form(`allowance/bids/${idPath(b.id)}`, hidden('decision', 'reject'), 'Decline', 'class="inline-form"')}</div>` : ''}</li>`).join('')}</ul>` : empty('No bids yet.')) +
    card('Chores open for bids', d.chores.length ? `<ul class="rows">${d.chores.map(c => `<li><strong>${escape(c.title)}</strong><span>Up to ${money(c.maxBidCents)}</span></li>`).join('')}</ul>` : empty('Enable allowance bidding when adding a chore.')) +
    card('Pool history', d.ledger.length ? `<ul class="rows">${d.ledger.map(l => `<li><div><strong>${escape(l.note)}</strong><small>${escape(l.memberName ?? '')} ${escape(new Date(l.createdAt).toLocaleString())}</small></div><span>${l.kind === 'deposit' ? '+' : '−'}${money(l.amountCents)}</span></li>`).join('')}</ul>` : empty('No transactions yet.'));
}
function family(page: AdminPage<'family'>) {
  const p = page.permissions.family;
  return card(page.family.name, `<ul class="rows">${page.data.people.map(person => `<li><div><strong>${escape(person.name || person.email)}</strong><small>${person.role} · signs in</small></div>${page.owner && person.role !== 'owner' ? `<a class="text-link" href="/admin/permissions/#${encodeURIComponent(person.userId)}">Permissions →</a>` : ''}</li>`).join('')}${page.data.members.filter(m => !m.userId).map(m => `<li><div><strong>${escape(m.name)}</strong><small>No sign-in</small></div>${p.delete ? remove(`members/${idPath(m.id)}/delete`) : ''}</li>`).join('')}</ul>`, 'Signed-in family members and people who only need chores and a calendar color.') +
    (p.create ? card('Add a household member', form('members', input('Name', 'name', '', 'required maxlength="100"') + input('Color', 'color', '#38bdf8', 'type="color"'), 'Add member'), 'No Google account required. Useful for young children.') + card('Invite someone to sign in', '<button class="primary" data-invite>Create QR invite</button><div id="invite-result" aria-live="polite"></div>', 'Invite links are single-use and expire after 15 minutes.') : '');
}
function permissions(page: AdminPage<'permissions'>) {
  return page.data.people.map(person => `<section class="card" id="${escape(person.userId)}"><h2>${escape(person.name || person.email)}</h2><p class="description">${escape(person.email)}</p>${form(`permissions/${idPath(person.userId)}`, `<div class="permission-table"><table><thead><tr><th scope="col">Feature</th>${['Create', 'Read', 'Update', 'Delete'].map(a => `<th scope="col">${a}</th>`).join('')}</tr></thead><tbody>${Object.entries(person.permissions).map(([feature, grant]) => `<tr><th scope="row">${escape(feature)}</th>${(['create', 'read', 'update', 'delete'] as const).map(action => `<td>${check(`${feature}: ${action}`, `${feature}.${action}`, grant[action], 'class="grant-checkbox"')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, 'Save permissions')}</section>`).join('') || card('Member permissions', empty('The owner always has full access. Invite another signed-in member to manage their permissions.'));
}
function layout(page: AdminPage<'layout'>) {
  const s = page.settings;
  const order = [...s.widgetOrder, ...WIDGETS.filter(w => !s.widgetOrder.includes(w))];
  const sizes = [['1x1', 'Small · single'], ['2x1', 'Medium · single'], ['3x1', 'Large · single'], ['1x2', 'Small · double'], ['2x2', 'Medium · double']];
  return card('Widget order', `<ul class="rows">${s.widgetOrder.map((w, i) => `<li><strong>${widgetLabels[w]}</strong><div class="row-actions">${i > 0 ? form('settings/widgets/move', hidden('widgetId', w) + hidden('direction', 'up'), 'Move up', 'class="inline-form"') : ''}${i < s.widgetOrder.length - 1 ? form('settings/widgets/move', hidden('widgetId', w) + hidden('direction', 'down'), 'Move down', 'class="inline-form"') : ''}</div></li>`).join('') || empty('No widgets enabled.')}</ul>`) +
    card('Widgets and display', form('settings/widgets', `<div class="widget-settings">${order.map(w => `<div>${check(widgetLabels[w], `widget_${w}`, s.widgetOrder.includes(w))}${select(`${widgetLabels[w]} size`, `size_${w}`, sizes.map(([value, label]) => option(value, label, s.widgetSizes[w] ?? '1x1')).join(''))}</div>`).join('')}</div>` + timezoneField(s.timezone) + input('Refresh interval (seconds)', 'refreshSeconds', String(s.refreshSeconds), 'type="number" required min="30" max="86400" step="30"') + select('Household theme', 'theme', option('light', 'Light', s.theme) + option('dark', 'Dark', s.theme)), 'Save display settings'), 'Changes apply to the shared wall dashboard. Your personal layout is managed on the wall display.');
}
function account(page: AdminPage<'account'>) {
  return card('Sign-in profile', `<p>${escape(page.user.email || 'No email available')}</p>` + form('account/name', input('Display name', 'name', page.user.name ?? '', 'required maxlength="100"'))) +
    card('Household time zone', form('settings/timezone', timezoneField(page.settings.timezone))) +
    card('Connected services', `<p>Google Calendar: <strong>${page.data.googleConnected ? 'Connected' : 'Not connected'}</strong></p><a class="text-link" href="/admin/calendars/">Manage calendars →</a>`) +
    card('Sign out', '<p>End this session on the current device.</p><a class="primary" href="/api/auth/signout">Sign out</a>');
}
function content(page: AdminPage): string {
  switch (page.section) {
    case 'overview': return overview(page);
    case 'calendars': return calendars(page);
    case 'meals': return meals(page);
    case 'notes': return notes(page);
    case 'chores': return chores(page);
    case 'allowance': return allowance(page);
    case 'family': return family(page);
    case 'permissions': return permissions(page);
    case 'layout': return layout(page);
    case 'account': return account(page);
  }
}
function render(page: AdminPage) {
  document.title = `${titles[page.section]} · KinBoard`;
  document.documentElement.dataset.theme = page.settings.theme;
  root.innerHTML = `<div class="family-layout admin-layout"><aside class="family-sidebar"><a class="brand" href="/app/" aria-label="KinBoard home"><b>K.</b><span>KinBoard<small>YOUR FAMILY SPACE</small></span></a><div class="family-switcher"><span class="family-switcher-icon">⌂</span><span><small>YOUR HOUSEHOLD</small><strong>${escape(page.family.name)}</strong></span><span class="switcher-chevron">⌄</span></div><p class="side-label">FAMILY SETTINGS</p><nav class="family-nav admin-navigation" aria-label="Family settings">${ADMIN_SECTIONS.filter(s => visible(page, s)).map(s => `<a href="${path(s)}" class="${s === page.section ? 'active' : ''}" ${s === page.section ? 'aria-current="page"' : ''}>${titles[s]}</a>`).join('')}</nav><div class="sidebar-bottom"><a href="/app/">▦ <span>Back to family board</span></a><a href="/api/auth/signout">↪ <span>Sign out</span></a><small>${escape(page.user.email)}</small></div></aside><main class="family-main"><header class="family-topbar"><div class="mobile-brand"><b>K.</b> KinBoard</div><div class="topbar-date"><span>Today</span><strong>${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(displayTimezone(page.settings.timezone) ? { timeZone: displayTimezone(page.settings.timezone) } : {}) })}</strong></div><div class="topbar-actions"><a href="/" class="wall-link">Open wall display <span>↗</span></a><a href="/admin/account/" class="user-avatar" aria-label="Account settings">${escape((page.user.name || page.user.email || 'K').slice(0, 1).toUpperCase())}</a></div></header><div class="admin-main"><div class="admin-heading"><div><p class="eyebrow">FAMILY SETTINGS</p><h1>${titles[page.section]}</h1></div><a href="/">Open wall display ↗</a></div><div id="admin-notice" role="status" aria-live="polite" tabindex="-1"></div>${content(page)}</div></main></div>`;
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  window.dispatchEvent(new Event('kinboard:ready'));
}
function notice(message: string, error = false) {
  const node = root.querySelector<HTMLElement>('#admin-notice');
  if (node) { node.textContent = message; node.dataset.error = String(error); node.focus({ preventScroll: true }); }
}
function gate(error: unknown) {
  const auth = error instanceof ApiClientError && error.status === 401;
  const family = error instanceof ApiClientError && error.code === 'family_required';
  const forbidden = error instanceof ApiClientError && error.status === 403;
  const callback = encodeURIComponent(location.pathname + location.search);
  root.innerHTML = `<main class="gate"><a class="brand" href="/app/">KinBoard</a><h1>${auth ? 'Welcome home.' : family ? 'Find your people.' : forbidden ? 'This page is restricted.' : 'Couldn’t load settings.'}</h1><p>${escape(error instanceof Error ? error.message : 'Please try again.')}</p>${auth || family ? `<a class="primary" href="${auth ? `/login?callbackUrl=${callback}` : '/welcome'}">${auth ? 'Sign in with Google' : 'Set up your family'}</a>` : `<a class="primary" href="/admin/">Back to overview</a> <button data-retry>Try again</button>`}</main>`;
  window.dispatchEvent(new Event('kinboard:ready'));
}
async function load(message?: string) {
  if (!active) return;
  const generation = ++loadGeneration;
  try {
    const page = await api.admin(section);
    if (!active || generation !== loadGeneration) return;
    render(page);
    const query = new URLSearchParams(location.search);
    const error = query.get('error') || query.get('eventError');
    if (message || error) notice(message || error!, Boolean(error));
  } catch (error) { if (active && generation === loadGeneration) gate(error); }
}
async function submit(form: HTMLFormElement) {
  if (busy) return;
  const body = new FormData(form);
  const file = body.get('media');
  if (file instanceof File && file.size > 2_000_000) { notice('Choose a photo or audio file smaller than 2 MB.', true); return; }
  busy = true;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  buttons.forEach(b => b.disabled = true);
  try { const result = await api.adminForm(new URL(form.action).pathname, body); await load(result.message); }
  catch (error) {
    if (!active) return;
    if (error instanceof ApiClientError && error.status === 401) gate(error);
    else notice(error instanceof Error ? error.message : 'Could not save. Your entries are still here.', true);
  } finally { busy = false; buttons.forEach(b => b.disabled = false); }
}
async function invite() {
  if (busy) return;
  busy = true;
  const button = root.querySelector<HTMLButtonElement>('[data-invite]');
  if (button) button.disabled = true;
  try {
    const invitation = await api.invite();
    const { default: qrcode } = await import('qrcode-generator');
    const qr = qrcode(0, 'M'); qr.addData(invitation.url); qr.make();
    const output = root.querySelector('#invite-result');
    if (output) output.innerHTML = `<div class="invite-qr" role="img" aria-label="Family invitation QR code">${qr.createSvgTag(5, 4)}</div><p><a href="${escape(invitation.url)}">${escape(invitation.url)}</a></p><p>Code: <strong>${escape(invitation.token)}</strong> · Expires ${escape(new Date(invitation.expiresAt).toLocaleTimeString())}</p><a href="${escape(invitation.directUrl)}">Direct invite link</a>`;
  } catch (error) { if (active) notice(error instanceof Error ? error.message : 'Could not create invite.', true); }
  finally { busy = false; if (button) button.disabled = false; }
}
export async function startAdmin() {
  active = true;
  const requested = location.pathname.replace(/^\/admin\/?/, '').replace(/\/$/, '') || 'overview';
  if (!ADMIN_SECTIONS.includes(requested as AdminSection)) { gate(new Error('Page not found.')); return; }
  section = requested as AdminSection;
  document.body.classList.add('admin-body');
  if (!root.dataset.bound) {
  root.dataset.bound = 'true';
  root.addEventListener('submit', event => {
    if (event.target instanceof HTMLFormElement && event.target.matches('[data-admin-form]')) { event.preventDefault(); void submit(event.target); }
  });
  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (button?.hasAttribute('data-invite')) void invite();
    if (button?.hasAttribute('data-retry')) void load();
  });
  root.addEventListener('change', event => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return;
    if (control instanceof HTMLInputElement && control.hasAttribute('data-all-day')) {
      control.form?.querySelectorAll<HTMLInputElement>('[data-event-date]').forEach(input => { input.type = control.checked ? 'date' : 'datetime-local'; });
    }
    if (control.hasAttribute('data-reward-type')) {
      control.form?.querySelectorAll<HTMLElement>('[data-xp-field]').forEach(el => el.hidden = control.value === 'allowance');
      control.form?.querySelectorAll<HTMLElement>('[data-allowance-field]').forEach(el => el.hidden = control.value !== 'allowance');
    }
  });
  }
  await load();
}
export function stopAdmin() { active = false; loadGeneration++; }
