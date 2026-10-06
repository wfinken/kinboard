import { ApiClientError, createClient, type Dashboard } from '@kinboard/contracts';
import './style.css';
import { displayTimezone } from './timezone';

const api = createClient(__KINBOARD_API_BASE_URL__);
const root = document.querySelector<HTMLDivElement>('#kinboard-page')!;
let data: Dashboard | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let active = false;
let loadGeneration = 0;
// All user-provided strings are escaped before rendering; no trusted HTML from the API.
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const empty = (message: string) => `<p class="empty">${message}</p>`;
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const eventTime = (value: string, timezone: string) => /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...(displayTimezone(timezone) ? { timeZone: displayTimezone(timezone) } : {}) }) : value.slice(11, 16);
const memberName = (id: string | null) => data?.members.find(m => m.id === id)?.name ?? 'Household';
function render(board: Dashboard) {
  data = board;
  document.documentElement.dataset.theme = board.settings.theme;
  const done = board.chores.filter(c => c.completed).length;
  const name = board.user.name?.split(' ')[0] ?? 'there';
  root.innerHTML = `
    <div class="family-layout">
    <aside class="family-sidebar"><a class="brand" href="/app/" aria-label="KinBoard home"><b>K.</b><span>KinBoard<small>YOUR FAMILY SPACE</small></span></a><div class="family-switcher"><span class="family-switcher-icon">⌂</span><span><small>YOUR HOUSEHOLD</small><strong>${escape(board.family.name)}</strong></span><span class="switcher-chevron">⌄</span></div><p class="side-label">FAMILY BOARD</p><nav class="family-nav" aria-label="Family board"><a class="active" href="/app/"><span>▦</span>Overview</a>${board.permissions.calendars.read ? '<a href="/admin/calendars/"><span>▣</span>Calendar</a>' : ''}${board.permissions.chores.read ? '<a href="/admin/chores/"><span>✓</span>Chores</a>' : ''}${board.permissions.notes.read ? '<a href="#fridge-notes"><span>▤</span>Fridge notes</a>' : ''}</nav><div class="sidebar-family"><div class="side-label">AT HOME</div><div class="sidebar-members">${board.members.map(m => `<div class="sidebar-member"><span class="avatar">${escape(m.name.slice(0, 1))}<i></i></span><span><strong>${escape(m.name)}</strong><small>${escape(m.status)}</small></span></div>`).join('') || '<p class="sidebar-empty">Add your family members in settings.</p>'}</div></div><div class="sidebar-bottom"><a href="/admin/">⚙ <span>Family settings</span></a><a href="/api/auth/signout">↪ <span>Sign out</span></a></div></aside>
    <main class="family-main"><header class="family-topbar"><div class="mobile-brand"><b>K.</b> KinBoard</div><div class="topbar-date"><span>Today</span><strong>${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(displayTimezone(board.settings.timezone) ? { timeZone: displayTimezone(board.settings.timezone) } : {}) })}</strong></div><div class="topbar-actions"><a href="/" class="wall-link">Open wall display <span>↗</span></a><a href="/admin/account/" class="user-avatar" aria-label="Account settings">${escape(name.slice(0, 1).toUpperCase())}</a></div></header>
    <div class="family-content"><section class="intro"><div><p class="eyebrow">${escape(board.family.name)} <span>·</span> FAMILY BOARD</p><h1>Welcome home, ${escape(name)}.</h1><p>A little less coordinating. A little more together.</p></div><span class="welcome-mark" aria-hidden="true">✦</span></section>
    <div id="notice" role="status" aria-live="polite"></div>
    <section class="metric-row" aria-label="Household summary"><article class="metric-card"><div><div class="metric-kicker"><i class="status-dot emerald"></i> HOUSEHOLD STATUS</div><h2>${board.members.length} ${board.members.length === 1 ? 'member' : 'members'}</h2><p>Your family space is ready</p></div><span class="metric-icon emerald-icon">⌂</span></article><article class="metric-card"><div><div class="metric-kicker"><i class="status-dot amber"></i> CHORES TODAY</div><h2>${done} <small>/ ${board.chores.length} complete</small></h2><p>${board.chores.length - done ? `${board.chores.length - done} still to do together` : 'All caught up for today'}</p></div><span class="metric-icon amber-icon">✓</span></article><article class="metric-card"><div><div class="metric-kicker"><i class="status-dot blue"></i> ON THE CALENDAR</div><h2>${board.events.length} <small>${board.events.length === 1 ? 'upcoming event' : 'upcoming events'}</small></h2><p>${board.events[0] ? `${escape(dateLabel(board.events[0].start))} · ${escape(board.events[0].title)}` : 'A little breathing room'}</p></div><span class="metric-icon blue-icon">▣</span></article></section>
    <div class="grid">
    ${board.permissions.calendars.read ? `<section class="card schedule"><div class="card-title"><h2>Coming up</h2><a href="/admin/calendars">Calendars ↗</a></div>${board.events.length ? `<ul>${board.events.slice(0, 12).map(e => `<li class="event"><time>${escape(dateLabel(e.start))}<small>${e.allDay ? 'All day' : escape(eventTime(e.start, board.settings.timezone))}</small></time><div><strong>${escape(e.title)}</strong><small>${escape(e.location || e.memberName || 'Family calendar')}</small></div></li>`).join('')}</ul>` : empty('A little breathing room. No events in the next seven days.')}</section>` : ''}
    ${board.permissions.chores.read ? `<section class="card"><div class="card-title"><h2>Teamwork</h2><span class="pill">${done} / ${board.chores.length} done</span></div>${board.chores.length ? `<ul class="chores">${board.chores.map(c => `<li><label><input type="checkbox" data-chore="${escape(c.id)}" ${c.completed ? 'checked' : ''} ${!board.permissions.chores.update ? 'disabled' : ''}><span><strong class="${c.completed ? 'done' : ''}">${escape(c.title)}</strong><small>${escape(memberName(c.memberId))} · ${c.rewardType === 'xp' ? `${c.rewardPoints} XP` : `$${(c.rewardCents / 100).toFixed(2)}`}</small></span></label>${c.bounty && board.permissions.chores.update ? `<select data-member-for="${escape(c.id)}" aria-label="Who completed ${escape(c.title)}"><option value="">Choose a member</option>${board.members.map(m => `<option value="${escape(m.id)}">${escape(m.name)}</option>`).join('')}</select>` : ''}</li>`).join('')}</ul>` : empty('No chores yet. Build a routine that works for your family.')}<a class="text-link" href="/admin/chores">Manage chores →</a></section>` : ''}
    ${board.permissions.meals.read ? `<section class="card"><div class="card-title"><h2>At the table</h2><a href="/admin/meals">Meal plan ↗</a></div>${board.meals.length ? `<ul>${board.meals.map(m => `<li class="meal"><span class="meal-icon" aria-hidden="true">${m.mealType === 'breakfast' ? '☀' : m.mealType === 'lunch' ? '◐' : '☾'}</span><div><strong>${escape(m.description)}</strong><small>${escape(dateLabel(m.date))} · ${escape(m.mealType)}</small></div></li>`).join('')}</ul>` : empty('What’s for dinner? Add something everyone can look forward to.')}</section>` : ''}
    ${board.permissions.notes.read ? `<section class="card notes-card" id="fridge-notes"><div class="card-title"><div><h2>Fridge notes</h2><p>Little things, shared with love.</p></div><span class="note-heading-icon">✎</span></div><div class="notes">${board.notes.map(n => `<article class="note"><p>${escape(n.content)}</p><div><small>${escape(n.authorName || 'Family')}</small>${board.permissions.notes.delete ? `<button class="delete" data-delete="${escape(n.id)}" aria-label="Delete note: ${escape(n.content.slice(0, 50))}">Remove</button>` : ''}</div></article>`).join('') || empty('Leave a reminder, a thank you, or a little love.')}</div>${board.permissions.notes.create ? `<form id="note-form"><label for="note">Leave a note</label><div class="compose"><textarea id="note" name="content" rows="2" maxlength="2000" required placeholder="Something for the family…"></textarea><button class="primary" type="submit">Post note</button></div></form>` : ''}</section>` : ''}
    </div><footer>Your family, in sync. <a href="/">Open the full wall dashboard →</a></footer></div></main></div>`;
  window.dispatchEvent(new Event('kinboard:ready'));
}
function ready() { window.dispatchEvent(new Event('kinboard:ready')); }
function notice(message: string) { const node = document.querySelector('#notice'); if (node) node.textContent = message; }
async function load(initial = false) {
  if (!active) return;
  const generation = ++loadGeneration;
  clearTimeout(timer);
  try {
    const board = await api.dashboard();
    if (!active || generation !== loadGeneration) return;
    render(board);
  }
  catch (error) {
    if (!active || generation !== loadGeneration) return;
    if (error instanceof ApiClientError && (error.status === 401 || error.code === 'family_required')) {
      const href = error.status === 401 ? '/login?callbackUrl=%2Fapp%2F' : '/welcome';
      root.innerHTML = `<main class="gate"><a class="brand" href="/">KinBoard</a><h1>${error.status === 401 ? 'Welcome home.' : 'Find your people.'}</h1><p>${error.status === 401 ? 'Sign in to your private family board.' : 'Create or join a family to get started.'}</p><a class="primary" href="${href}">${error.status === 401 ? 'Sign in with Google' : 'Set up your family'}</a></main>`;
      ready();
      return;
    }
    if (initial) { root.innerHTML = '<main class="gate"><h1>Couldn’t open your board.</h1><p>Please try again in a moment.</p><button id="retry" class="primary">Try again</button></main>'; ready(); }
    else notice('Couldn’t refresh the board. Your last loaded information is still shown.');
  }
  timer = setTimeout(() => {
    // Do not erase a draft or move focus while somebody is interacting.
    if (!busy && document.visibilityState === 'visible' && !root.contains(document.activeElement)) void load();
    else scheduleRefresh();
  }, Math.max(30, data?.settings.refreshSeconds ?? 300) * 1000);
}
function scheduleRefresh() { timer = setTimeout(() => { if (!busy && !root.contains(document.activeElement)) void load(); else scheduleRefresh(); }, 30000); }
async function mutate(action: () => Promise<unknown>) {
  if (busy) return;
  busy = true;
  const draft = root.querySelector<HTMLTextAreaElement>('#note')?.value ?? '';
  root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input[type="checkbox"]').forEach(el => el.disabled = true);
  try { await action(); if (active) await load(); }
  catch (error) {
    if (!active) return;
    if (data) render(data);
    const note = root.querySelector<HTMLTextAreaElement>('#note');
    if (note) note.value = draft;
    notice(error instanceof Error ? error.message : 'Could not save. Please try again.');
  }
  finally { busy = false; }
}
function bindEvents() { if (root.dataset.bound) return; root.dataset.bound = 'true';
root.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'note-form') return;
  event.preventDefault();
  const content = String(new FormData(form).get('content') ?? '').trim();
  if (content) void mutate(() => api.createNote({ content }));
});
root.addEventListener('change', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.dataset.chore) return;
  const id = input.dataset.chore;
  const member = Array.from(root.querySelectorAll<HTMLSelectElement>('[data-member-for]')).find(el => el.dataset.memberFor === id)?.value;
  if (input.checked && data?.chores.find(c => c.id === id)?.bounty && !member) { input.checked = false; notice('Choose the family member who completed this bounty.'); return; }
  void mutate(() => api.completeChore(id, { completed: input.checked, ...(member ? { memberId: member } : {}) }));
});
root.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
  if (target?.id === 'retry') void load(true);
  if (target?.dataset.delete) { const id = target.dataset.delete; void mutate(() => api.deleteNote(id)); }
});
}
export async function startDashboard() { active = true; bindEvents(); await load(true); }
export function stopDashboard() { active = false; loadGeneration++; clearTimeout(timer); }
