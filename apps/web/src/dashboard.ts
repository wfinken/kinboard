import { ApiClientError, createClient, type Dashboard } from '@kinboard/contracts';
import './style.css';

const api = createClient(__KINBOARD_API_BASE_URL__);
const root = document.querySelector<HTMLDivElement>('#app')!;
let data: Dashboard | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
// All user-provided strings are escaped before rendering; no trusted HTML from the API.
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const empty = (message: string) => `<p class="empty">${message}</p>`;
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const eventTime = (value: string, timezone: string) => /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone }) : value.slice(11, 16);
const memberName = (id: string | null) => data?.members.find(m => m.id === id)?.name ?? 'Household';
function render(board: Dashboard) {
  data = board;
  document.documentElement.dataset.theme = board.settings.theme;
  const done = board.chores.filter(c => c.completed).length;
  const name = board.user.name?.split(' ')[0] ?? 'there';
  root.innerHTML = `
    <header><a class="brand" href="/app/" aria-label="KinBoard home"><b>K.</b> KinBoard</a><nav aria-label="Main navigation"><a href="/">Wall dashboard</a><a href="/admin">Settings</a><a href="/api/auth/signout">Sign out</a></nav></header>
    <main><section class="intro"><div><p class="eyebrow">${escape(board.family.name)} / FAMILY BOARD</p><h1>Welcome home, ${escape(name)}.</h1><p>A little less coordinating. A little more together.</p></div><time>${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: board.settings.timezone })}</time></section>
    <div id="notice" role="status" aria-live="polite"></div>
    ${board.members.length ? `<section class="people" aria-label="Your household">${board.members.map(m => `<div class="person"><span class="avatar">${escape(m.name.slice(0, 1))}</span><div><strong>${escape(m.name)}</strong><small>${escape(m.status)}</small></div></div>`).join('')}</section>` : ''}
    <div class="grid">
    ${board.permissions.calendars.read ? `<section class="card schedule"><div class="card-title"><h2>Coming up</h2><a href="/admin/calendars">Calendars ↗</a></div>${board.events.length ? `<ul>${board.events.slice(0, 12).map(e => `<li class="event"><time>${escape(dateLabel(e.start))}<small>${e.allDay ? 'All day' : escape(eventTime(e.start, board.settings.timezone))}</small></time><div><strong>${escape(e.title)}</strong><small>${escape(e.location || e.memberName || 'Family calendar')}</small></div></li>`).join('')}</ul>` : empty('A little breathing room. No events in the next seven days.')}</section>` : ''}
    ${board.permissions.chores.read ? `<section class="card"><div class="card-title"><h2>Teamwork</h2><span class="pill">${done} / ${board.chores.length} done</span></div>${board.chores.length ? `<ul class="chores">${board.chores.map(c => `<li><label><input type="checkbox" data-chore="${escape(c.id)}" ${c.completed ? 'checked' : ''} ${!board.permissions.chores.update ? 'disabled' : ''}><span><strong class="${c.completed ? 'done' : ''}">${escape(c.title)}</strong><small>${escape(memberName(c.memberId))} · ${c.rewardType === 'xp' ? `${c.rewardPoints} XP` : `$${(c.rewardCents / 100).toFixed(2)}`}</small></span></label>${c.bounty && board.permissions.chores.update ? `<select data-member-for="${escape(c.id)}" aria-label="Who completed ${escape(c.title)}"><option value="">Choose a member</option>${board.members.map(m => `<option value="${escape(m.id)}">${escape(m.name)}</option>`).join('')}</select>` : ''}</li>`).join('')}</ul>` : empty('No chores yet. Build a routine that works for your family.')}<a class="text-link" href="/admin/chores">Manage chores →</a></section>` : ''}
    ${board.permissions.meals.read ? `<section class="card"><div class="card-title"><h2>At the table</h2><a href="/admin/meals">Meal plan ↗</a></div>${board.meals.length ? `<ul>${board.meals.map(m => `<li class="meal"><span class="meal-icon" aria-hidden="true">${m.mealType === 'breakfast' ? '☀' : m.mealType === 'lunch' ? '◐' : '☾'}</span><div><strong>${escape(m.description)}</strong><small>${escape(dateLabel(m.date))} · ${escape(m.mealType)}</small></div></li>`).join('')}</ul>` : empty('What’s for dinner? Add something everyone can look forward to.')}</section>` : ''}
    ${board.permissions.notes.read ? `<section class="card notes-card"><div class="card-title"><h2>On the fridge</h2><span class="eyebrow">LITTLE THINGS, SHARED</span></div><div class="notes">${board.notes.map(n => `<article class="note"><p>${escape(n.content)}</p><div><small>${escape(n.authorName || 'Family')}</small>${board.permissions.notes.delete ? `<button class="delete" data-delete="${escape(n.id)}" aria-label="Delete note: ${escape(n.content.slice(0, 50))}">Remove</button>` : ''}</div></article>`).join('') || empty('Leave a reminder, a thank you, or a little love.')}</div>${board.permissions.notes.create ? `<form id="note-form"><label for="note">Leave a note</label><div class="compose"><textarea id="note" name="content" rows="2" maxlength="2000" required placeholder="Something for the family…"></textarea><button class="primary" type="submit">Post note</button></div></form>` : ''}</section>` : ''}
    </div><footer>Your family, in sync. <a href="/">Open the full wall dashboard →</a></footer></main>`;
}
function notice(message: string) { const node = document.querySelector('#notice'); if (node) node.textContent = message; }
async function load(initial = false) {
  clearTimeout(timer);
  try { render(await api.dashboard()); }
  catch (error) {
    if (error instanceof ApiClientError && (error.status === 401 || error.code === 'family_required')) {
      const href = error.status === 401 ? '/login?callbackUrl=%2Fapp%2F' : '/welcome';
      root.innerHTML = `<main class="gate"><a class="brand" href="/">KinBoard</a><h1>${error.status === 401 ? 'Welcome home.' : 'Find your people.'}</h1><p>${error.status === 401 ? 'Sign in to your private family board.' : 'Create or join a family to get started.'}</p><a class="primary" href="${href}">${error.status === 401 ? 'Sign in with Google' : 'Set up your family'}</a></main>`;
      return;
    }
    if (initial) root.innerHTML = '<main class="gate"><h1>Couldn’t open your board.</h1><p>Please try again in a moment.</p><button id="retry" class="primary">Try again</button></main>';
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
  try { await action(); await load(); }
  catch (error) {
    if (data) render(data);
    const note = root.querySelector<HTMLTextAreaElement>('#note');
    if (note) note.value = draft;
    notice(error instanceof Error ? error.message : 'Could not save. Please try again.');
  }
  finally { busy = false; }
}
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
void load(true);
