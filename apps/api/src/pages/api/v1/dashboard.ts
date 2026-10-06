import type { APIRoute } from 'astro';
import type { Dashboard } from '@kinboard/contracts';
import { db } from '../../../db/client';
import { getPermissions } from '../../../lib/permissions';
import { getDashboardSettings } from '../../../lib/settings';
import { currentPeriodKey } from '../../../lib/chores';
import { fetchUpcomingEvents } from '../../../lib/google-calendar';
import { householdTimezone, zonedDateKey } from '../../../lib/dates';
import { json } from '../../../lib/api';
import { fetchWeather } from '../../../lib/weather';
import { getUserDashboardLayout } from '../../../lib/settings';
import { allowanceBids } from '../../../db/schema';
import { desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  const familyId = locals.familyId!;
  const user = locals.session!.user!;
  const [permissions, settings] = await Promise.all([getPermissions(familyId, user.id), getDashboardSettings(familyId)]);
  const personalLayout = await getUserDashboardLayout(user.id, familyId, settings);
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400000);
  const timezone = settings.timezone === 'auto' ? householdTimezone() : settings.timezone;
  const from = zonedDateKey(now, timezone), to = zonedDateKey(end, timezone);
  // Each collection is independently authorized; hiding controls is not authorization.
  const [members, statuses, chores, completions, meals, notes, events, weather, ledger, bids] = await Promise.all([
    permissions.family.read || permissions.chores.read ? db.query.householdMembers.findMany({ where: (m, { eq }) => eq(m.familyId, familyId), orderBy: (m, { asc }) => asc(m.sortOrder) }) : [],
    permissions.chores.read ? db.query.memberStatuses.findMany({ where: (s, { eq }) => eq(s.familyId, familyId) }) : [],
    permissions.chores.read ? db.query.chores.findMany({ where: (c, { eq }) => eq(c.familyId, familyId), orderBy: (c, { asc }) => asc(c.sortOrder) }) : [],
    permissions.chores.read ? db.query.choreCompletions.findMany({ where: (c, { eq }) => eq(c.familyId, familyId) }) : [],
    permissions.meals.read ? db.query.meals.findMany({ where: (m, { and, eq, gte, lt }) => and(eq(m.familyId, familyId), gte(m.date, from), lt(m.date, to)), orderBy: (m, { asc }) => asc(m.date) }) : [],
    permissions.notes.read ? db.query.stickyNotes.findMany({ where: (n, { eq }) => eq(n.familyId, familyId), orderBy: (n, { desc }) => desc(n.createdAt), limit: 30 }) : [],
    permissions.calendars.read ? fetchUpcomingEvents(familyId, now, end) : [],
    fetchWeather(),
    permissions.allowance.read ? db.query.allowanceLedger.findMany({ where: (row, { eq }) => eq(row.familyId, familyId) }) : [],
    permissions.allowance.read ? db.query.allowanceBids.findMany({ where: (row, { eq }) => eq(row.familyId, familyId), orderBy: desc(allowanceBids.createdAt) }) : [],
  ]);
  const completed = new Set(completions.map(c => `${c.choreId}:${c.periodKey}`));
  const completedChoreIds = [...new Set(completions.map(item => item.choreId))];
  const [completedChores, completionMembers] = await Promise.all([
    completedChoreIds.length ? db.query.chores.findMany({ where: (c, { and, eq, inArray }) => and(eq(c.familyId, familyId), inArray(c.id, completedChoreIds)) }) : [],
    [...new Set(completions.map(item => item.memberId).filter((id): id is string => Boolean(id)))].length
      ? db.query.householdMembers.findMany({ where: (m, { and, eq, inArray }) => and(eq(m.familyId, familyId), inArray(m.id, [...new Set(completions.map(item => item.memberId).filter((id): id is string => Boolean(id)))])) }) : [],
  ]);
  const latest = [
    ...events.map(item => ({ kind: 'Calendar', title: item.title, detail: 'Upcoming family event', at: item.start, icon: '📅' })),
    ...completions.map(item => ({ kind: 'Chore completed', title: completedChores.find(chore => chore.id === item.choreId)?.title ?? 'Chore', detail: completionMembers.find(member => member.id === item.memberId)?.name ?? 'Family member', at: item.completedAt.toISOString(), icon: '✅' })),
    ...notes.map(item => ({ kind: 'Fridge note', title: item.content, detail: item.authorName || 'Added to the family board', at: item.createdAt.toISOString(), icon: '📌' })),
    ...meals.map(item => ({ kind: 'Meal plan', title: item.description, detail: `${item.mealType} · ${item.date}`, at: `${item.date}T12:00:00.000Z`, icon: '🍽️' })),
    ...chores.map(item => ({ kind: 'Chore', title: item.title, detail: 'On the family chore list', at: now.toISOString(), icon: '🧹' })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const body: Dashboard = {
    user: { id: user.id, name: user.name ?? null, image: user.image ?? null },
    family: { id: familyId, name: locals.family!.name }, permissions,
    settings: { theme: settings.theme, timezone, refreshSeconds: settings.refreshSeconds, widgetOrder: personalLayout.widgetOrder.filter(id => settings.widgetOrder.includes(id)), widgetSizes: personalLayout.widgetSizes },
    members: members.map(m => ({ id: m.id, name: m.name, color: m.color, status: statuses.find(s => s.memberId === m.id)?.status ?? 'Available' })),
    chores: chores.map(c => ({ id: c.id, title: c.title, memberId: c.rotationMemberId && Number(from.slice(-2)) % 2 === 0 ? c.rotationMemberId : c.memberId, frequency: c.frequency, completed: completed.has(`${c.id}:${currentPeriodKey(c.frequency)}`), bounty: c.bounty, allowanceEnabled: c.allowanceEnabled, maxBidCents: c.maxBidCents, rewardType: c.rewardType, rewardPoints: c.rewardPoints, rewardCents: c.rewardCents })),
    meals: meals.map(m => ({ id: m.id, date: m.date, mealType: m.mealType, description: m.description })),
    notes: notes.map(n => ({ id: n.id, content: n.content, color: n.color, authorName: n.authorName, createdAt: n.createdAt.toISOString() })),
    events,
    weather,
    allowance: { balanceCents: Math.max(0, ledger.reduce((sum, row) => sum + (row.kind === 'deposit' ? row.amountCents : -row.amountCents), 0) - bids.filter(bid => bid.status === 'approved').reduce((sum, bid) => sum + bid.amountCents, 0)), bids: bids.map(bid => ({ id: bid.id, choreId: bid.choreId, memberId: bid.memberId, amountCents: bid.amountCents, status: bid.status })) },
    latest,
  };
  return json(body);
};
