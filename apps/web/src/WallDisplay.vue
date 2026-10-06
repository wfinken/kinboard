<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ApiClientError, createClient, type Dashboard } from '@kinboard/contracts';
import { displayTimezone } from './timezone';
import './wall.css';

const api = createClient(__KINBOARD_API_BASE_URL__);
const board = ref<Dashboard>();
const error = ref('');
const now = ref(new Date());
const noteDraft = ref('');
const saving = ref(false);
const customize = ref(false);
const currentTheme = ref<'light' | 'dark'>('dark');
let clockTimer: ReturnType<typeof setInterval>;
let refreshTimer: ReturnType<typeof setTimeout>;
const completed = computed(() => board.value?.chores.filter(chore => chore.completed).length ?? 0);
const allowanceChores = computed(() => board.value?.chores.filter(item => item.allowanceEnabled && !board.value?.allowance.bids.some(bid => bid.choreId === item.id && bid.status === 'approved')) ?? []);
const firstName = computed(() => board.value?.user.name?.split(' ')[0] ?? 'Family');

async function load() {
  try {
    board.value = await api.dashboard();
    document.documentElement.dataset.theme = board.value.settings.theme;
    currentTheme.value = board.value.settings.theme;
    error.value = '';
  } catch (cause) {
    if (cause instanceof ApiClientError && cause.status === 401) {
      location.href = '/login?callbackUrl=%2F';
      return;
    }
    if (cause instanceof ApiClientError && cause.code === 'family_required') {
      location.href = '/welcome';
      return;
    }
    error.value = 'The family display could not refresh. Check your connection and try again.';
  } finally {
    window.dispatchEvent(new Event('kinboard:ready'));
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { if (document.visibilityState === 'visible') void load(); }, Math.max(30, board.value?.settings.refreshSeconds ?? 300) * 1000);
  }
}

async function toggleChore(id: string, checked: boolean) {
  if (!board.value) return;
  const chore = board.value.chores.find(item => item.id === id);
  if (!chore) return;
  chore.completed = !checked;
  try {
    await api.completeChore(id, { completed: checked, ...(chore.memberId ? { memberId: chore.memberId } : {}) });
    chore.completed = checked;
  } catch { error.value = 'Could not update that chore. Please try again.'; }
}

async function postNote() {
  const content = noteDraft.value.trim();
  if (!content || saving.value) return;
  saving.value = true;
  try { await api.createNote({ content }); noteDraft.value = ''; await load(); }
  catch { error.value = 'Could not post your note. Please try again.'; }
  finally { saving.value = false; }
}
async function removeNote(id: string) {
  try { await api.deleteNote(id); await load(); }
  catch { error.value = 'Could not remove that note. Please try again.'; }
}
async function setStatus(memberId: string, status: string) {
  const response = await fetch('/api/dashboard/members/status', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, status }) });
  if (!response.ok) error.value = 'Could not update availability. Please try again.';
  else { const member = board.value?.members.find(item => item.id === memberId); if (member) member.status = status; }
}
async function placeBid(choreId: string, memberId: string, amount: number) {
  if (!board.value || !(amount > 0)) return;
  const response = await fetch(`/api/dashboard/allowance/bid?family=${encodeURIComponent(board.value.family.id)}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choreId, memberId, amount }) });
  if (!response.ok) { error.value = 'Could not place that allowance bid.'; return; }
  await load();
}
function submitBid(event: SubmitEvent, choreId: string) {
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  void placeBid(choreId, String(data.get('memberId') ?? ''), Number(data.get('amount')));
}
async function saveLayout() {
  if (!board.value) return;
  const response = await fetch('/api/dashboard/layout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ widgetOrder: board.value.settings.widgetOrder, widgetSizes: board.value.settings.widgetSizes }) });
  if (!response.ok) error.value = 'Could not save your display layout.';
}
function moveWidget(id: string, delta: number) {
  if (!board.value) return;
  const order = board.value.settings.widgetOrder;
  const index = order.indexOf(id), next = index + delta;
  if (index < 0 || next < 0 || next >= order.length) return;
  [order[index], order[next]] = [order[next], order[index]];
  void saveLayout();
}
function widgetStyle(id: string) {
  const settings = board.value?.settings;
  if (!settings) return {};
  const size = settings.widgetSizes[id] ?? '1x1';
  const columns = Number(size.split('x')[0]) || 1;
  return { order: settings.widgetOrder.indexOf(id), gridColumn: `span ${Math.min(columns, 3)} / span ${Math.min(columns, 3)}` };
}
function toggleTheme() {
  currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = currentTheme.value;
  try { localStorage.setItem('kinboard-theme', currentTheme.value); } catch {}
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { error.value = 'Full screen is unavailable in this browser.'; }
}
const dateText = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const eventTime = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...(displayTimezone(board.value?.settings.timezone ?? 'auto') ? { timeZone: displayTimezone(board.value?.settings.timezone ?? 'auto') } : {}) }) : value.slice(11, 16);
const weatherIcon = (code: number) => ({ 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '🌨️', 73: '🌨️', 75: '🌨️', 80: '🌦️', 81: '🌦️', 82: '⛈️', 95: '⛈️', 96: '⛈️', 99: '⛈️' } as Record<number, string>)[code] ?? '❓';
const weatherLabel = (code: number) => ({ 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail' } as Record<number, string>)[code] ?? 'Unknown';

onMounted(() => {
  currentTheme.value = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  clockTimer = setInterval(() => { now.value = new Date(); }, 1000);
  void load();
});
onBeforeUnmount(() => { clearInterval(clockTimer); clearTimeout(refreshTimer); });
</script>

<template>
  <main class="wall-view">
    <header class="wall-view-header">
      <a href="/" class="wall-view-brand"><span class="wall-view-mark">K.</span><span><small>YOUR FAMILY, IN SYNC</small><strong>KinBoard</strong></span></a>
      <div class="wall-view-date"><time>{{ now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}</time><span>{{ now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) }}</span></div>
      <nav class="wall-view-actions" aria-label="Wall display controls">
        <a href="/app/" aria-label="Open family portal" title="Family portal">▦</a>
        <a href="/admin/" aria-label="Family settings" title="Family settings">⚙</a>
        <button type="button" @click="toggleTheme" :aria-label="`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} theme`">{{ currentTheme === 'dark' ? '☼' : '☾' }}</button>
        <button type="button" @click="toggleFullscreen" aria-label="Toggle full screen">⛶</button>
        <a href="/api/auth/signout" aria-label="Sign out" title="Sign out">↪</a>
      </nav>
    </header>
    <section v-if="!board && !error" class="wall-loading" role="status">Getting the family display ready…</section>
    <section v-else-if="error && !board" class="wall-error" role="alert"><p>{{ error }}</p><button @click="load">Try again</button></section>
    <template v-else-if="board">
      <div class="wall-greeting"><div><p>{{ board.family.name }} · FAMILY DISPLAY</p><h1>Welcome home, {{ firstName }}.</h1></div><div class="wall-summary"><span>{{ board.members.length }} at home</span><span>{{ completed }}/{{ board.chores.length }} chores done</span><span>{{ board.events.length }} upcoming</span><button type="button" @click="customize = !customize">{{ customize ? 'Done' : 'Customize' }}</button></div></div>
      <p v-if="customize" class="wall-customize-hint">Reorder widgets and choose their size. Your display preferences are saved to your account.</p>
      <p v-if="error" class="wall-notice" role="status">{{ error }}</p>
      <div class="wall-view-grid">
        <section v-if="board.settings.widgetOrder.includes('clock')" class="wall-card wall-clock" :style="widgetStyle('clock')"><p class="wall-card-label">RIGHT NOW</p><time>{{ now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}</time><p>{{ now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) }}</p></section>
        <section v-if="board.settings.widgetOrder.includes('weather')" class="wall-card wall-weather" :style="widgetStyle('weather')"><p class="wall-card-label">WEATHER NEAR HOME</p><template v-if="board.weather"><div class="wall-weather-current"><span>{{ weatherIcon(board.weather.currentCode) }}</span><strong>{{ board.weather.currentTemp }}°</strong><span>{{ weatherLabel(board.weather.currentCode) }}</span></div><p>Feels like {{ board.weather.feelsLike }}° · H {{ board.weather.today.high }}° / L {{ board.weather.today.low }}°</p><ul class="wall-forecast"><li v-for="day in board.weather.forecast" :key="day.date">{{ dateText(day.date) }} {{ weatherIcon(day.code) }} {{ day.high }}° / {{ day.low }}°</li></ul></template><p v-else class="wall-empty">Weather unavailable.</p></section>
        <section v-if="board.settings.widgetOrder.includes('latest')" class="wall-card" :style="widgetStyle('latest')"><div class="wall-card-heading"><h2>Latest</h2><span>Family activity</span></div><ul class="wall-event-list"><li v-for="item in board.latest.slice(0, 5)" :key="`${item.kind}-${item.at}-${item.title}`"><span class="wall-latest-icon">{{ item.icon }}</span><span><strong>{{ item.title }}</strong><small>{{ item.kind }} · {{ item.detail }}</small></span></li><li v-if="!board.latest.length" class="wall-empty">New family activity will show up here.</li></ul></section>
        <section v-if="board.settings.widgetOrder.includes('availability') && board.permissions.chores.read" class="wall-card" :style="widgetStyle('availability')"><div class="wall-card-heading"><h2>Availability</h2></div><ul><li v-for="member in board.members" :key="member.id" class="wall-member-row"><span class="wall-avatar" :style="{ background: member.color }">{{ member.name.slice(0, 1) }}</span><strong>{{ member.name }}</strong><select :value="member.status" aria-label="Availability" @change="setStatus(member.id, ($event.target as HTMLSelectElement).value)"><option>Available</option><option>Busy</option><option>On my way home</option><option>At practice</option><option>Working late</option></select></li></ul></section>
        <section v-if="board.settings.widgetOrder.includes('calendar') && board.permissions.calendars.read" class="wall-card" :style="widgetStyle('calendar')"><div class="wall-card-heading"><h2>Coming up</h2><a href="/admin/calendars/">Calendar →</a></div><ul class="wall-event-list"><li v-for="event in board.events.slice(0, 6)" :key="event.id"><time>{{ dateText(event.start) }}<small>{{ event.allDay ? 'All day' : eventTime(event.start) }}</small></time><span><strong>{{ event.title }}</strong><small>{{ event.location || event.memberName || 'Family calendar' }}</small></span></li><li v-if="!board.events.length" class="wall-empty">A little breathing room. No events soon.</li></ul></section>
        <section v-if="board.settings.widgetOrder.includes('chores') && board.permissions.chores.read" class="wall-card" :style="widgetStyle('chores')"><div class="wall-card-heading"><h2>Teamwork</h2><a href="/admin/chores/">Manage →</a></div><ul class="wall-chore-list"><li v-for="chore in board.chores" :key="chore.id"><label><input type="checkbox" :checked="chore.completed" :disabled="!board.permissions.chores.update" @change="toggleChore(chore.id, ($event.target as HTMLInputElement).checked)"><span :class="{ done: chore.completed }">{{ chore.title }}</span></label><small>{{ chore.rewardType === 'xp' ? `${chore.rewardPoints} XP` : `$${(chore.rewardCents / 100).toFixed(2)}` }}</small></li><li v-if="!board.chores.length" class="wall-empty">No chores to show.</li></ul></section>
        <section v-if="board.settings.widgetOrder.includes('meals') && board.permissions.meals.read" class="wall-card" :style="widgetStyle('meals')"><div class="wall-card-heading"><h2>At the table</h2><a href="/admin/meals/">Meal plan →</a></div><ul class="wall-meal-list"><li v-for="meal in board.meals" :key="meal.id"><span>{{ meal.mealType === 'breakfast' ? '☀' : meal.mealType === 'lunch' ? '◐' : '☾' }}</span><strong>{{ meal.description }}</strong><small>{{ dateText(meal.date) }}</small></li><li v-if="!board.meals.length" class="wall-empty">Nothing planned yet.</li></ul></section>
        <section v-if="board.settings.widgetOrder.includes('allowance') && board.permissions.allowance.read" class="wall-card" :style="widgetStyle('allowance')"><div class="wall-card-heading"><h2>Allowance</h2><a href="/admin/allowance/">${{ (board.allowance.balanceCents / 100).toFixed(2) }} available</a></div><ul class="wall-chore-list"><li v-for="chore in allowanceChores" :key="chore.id"><span>{{ chore.title }}</span><form class="wall-bid-form" @submit.prevent="submitBid($event, chore.id)"><select name="memberId" aria-label="Family member"><option v-for="member in board.members" :key="member.id" :value="member.id">{{ member.name }}</option></select><input name="amount" type="number" min="0.01" step="0.01" value="1.00" aria-label="Bid amount"><button>Bid</button></form></li></ul></section>
        <section v-if="board.settings.widgetOrder.includes('notes') && board.permissions.notes.read" class="wall-card wall-notes" :style="widgetStyle('notes')"><div class="wall-card-heading"><div><h2>Fridge notes</h2><p>Little things, shared with love.</p></div><a href="/admin/notes/">Board →</a></div><div class="wall-note-list"><article v-for="note in board.notes" :key="note.id"><p>{{ note.content }}</p><small>{{ note.authorName || 'Family' }}</small><button v-if="board.permissions.notes.delete" @click="removeNote(note.id)" :aria-label="`Remove note from ${note.authorName || 'Family'}`">×</button></article><p v-if="!board.notes.length" class="wall-empty">Leave a reminder, a thank you, or a little love.</p></div><form v-if="board.permissions.notes.create" class="wall-note-form" @submit.prevent="postNote"><input v-model="noteDraft" maxlength="2000" placeholder="Leave a note for your family…" aria-label="Note content"><button :disabled="saving">Post note</button></form></section>
        <div v-if="customize" class="wall-card wall-layout-controls"><h2>Arrange widgets</h2><div v-for="id in board.settings.widgetOrder" :key="id" class="wall-layout-row"><strong>{{ id }}</strong><button @click="moveWidget(id, -1)" :aria-label="`Move ${id} earlier`">↑</button><button @click="moveWidget(id, 1)" :aria-label="`Move ${id} later`">↓</button><select v-model="board.settings.widgetSizes[id]" @change="saveLayout" :aria-label="`${id} size`"><option value="1x1">Small</option><option value="2x1">Medium</option><option value="3x1">Large</option><option value="2x2">Double</option></select></div></div>
      </div>
      <footer class="wall-view-footer">Your family, in sync. <a href="/app/">Open family portal ↗</a></footer>
    </template>
  </main>
</template>
