import type { APIRoute } from 'astro';
import type { Dashboard } from '@kinboard/contracts';
import { db } from '../../../db/client';
import { getPermissions } from '../../../lib/permissions';
import { getDashboardSettings } from '../../../lib/settings';
import { currentPeriodKey } from '../../../lib/chores';
import { fetchUpcomingEvents } from '../../../lib/google-calendar';
import { householdTimezone, zonedDateKey } from '../../../lib/dates';
import { json } from '../../../lib/api';

export const GET: APIRoute = async ({ locals }) => {
  const familyId = locals.familyId!;
  const user = locals.session!.user!;
  const [permissions, settings] = await Promise.all([getPermissions(familyId, user.id), getDashboardSettings(familyId)]);
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400000);
  const timezone = settings.timezone === 'auto' ? householdTimezone() : settings.timezone;
  const from = zonedDateKey(now, timezone), to = zonedDateKey(end, timezone);
  // Each collection is independently authorized; hiding controls is not authorization.
  const [members, statuses, chores, completions, meals, notes, events] = await Promise.all([
    permissions.family.read || permissions.chores.read ? db.query.householdMembers.findMany({ where: (m, { eq }) => eq(m.familyId, familyId), orderBy: (m, { asc }) => asc(m.sortOrder) }) : [],
    permissions.chores.read ? db.query.memberStatuses.findMany({ where: (s, { eq }) => eq(s.familyId, familyId) }) : [],
    permissions.chores.read ? db.query.chores.findMany({ where: (c, { eq }) => eq(c.familyId, familyId), orderBy: (c, { asc }) => asc(c.sortOrder) }) : [],
    permissions.chores.read ? db.query.choreCompletions.findMany({ where: (c, { eq }) => eq(c.familyId, familyId) }) : [],
    permissions.meals.read ? db.query.meals.findMany({ where: (m, { and, eq, gte, lt }) => and(eq(m.familyId, familyId), gte(m.date, from), lt(m.date, to)), orderBy: (m, { asc }) => asc(m.date) }) : [],
    permissions.notes.read ? db.query.stickyNotes.findMany({ where: (n, { eq }) => eq(n.familyId, familyId), orderBy: (n, { desc }) => desc(n.createdAt), limit: 30 }) : [],
    permissions.calendars.read ? fetchUpcomingEvents(familyId, now, end) : [],
  ]);
  const completed = new Set(completions.map(c => `${c.choreId}:${c.periodKey}`));
  const body: Dashboard = {
    user: { id: user.id, name: user.name ?? null, image: user.image ?? null },
    family: { id: familyId, name: locals.family!.name }, permissions,
    settings: { theme: settings.theme, timezone, refreshSeconds: settings.refreshSeconds },
    members: members.map(m => ({ id: m.id, name: m.name, color: m.color, status: statuses.find(s => s.memberId === m.id)?.status ?? 'Available' })),
    chores: chores.map(c => ({ id: c.id, title: c.title, memberId: c.rotationMemberId && Number(from.slice(-2)) % 2 === 0 ? c.rotationMemberId : c.memberId, frequency: c.frequency, completed: completed.has(`${c.id}:${currentPeriodKey(c.frequency)}`), bounty: c.bounty, rewardType: c.rewardType, rewardPoints: c.rewardPoints, rewardCents: c.rewardCents })),
    meals: meals.map(m => ({ id: m.id, date: m.date, mealType: m.mealType, description: m.description })),
    notes: notes.map(n => ({ id: n.id, content: n.content, color: n.color, authorName: n.authorName, createdAt: n.createdAt.toISOString() })),
    events,
  };
  return json(body);
};
