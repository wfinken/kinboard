import type { APIRoute } from 'astro';
import { ADMIN_SECTIONS, type AdminContext, type AdminResources, type AdminSection, type Feature } from '@kinboard/contracts';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { accounts, familyMemberships, users } from '../../../../db/schema';
import { apiError, json } from '../../../../lib/api';
import { getPermissions, isOwner } from '../../../../lib/permissions';
import { getDashboardSettings } from '../../../../lib/settings';
import { householdTimezone, zonedDateKey } from '../../../../lib/dates';
import { listWritableFamilyCalendars } from '../../../../lib/google-calendar';

const gated: Partial<Record<AdminSection, Feature>> = { calendars: 'calendars', meals: 'meals', notes: 'notes', chores: 'chores', allowance: 'allowance', family: 'family' };
export const GET: APIRoute = async ({ params, locals }) => {
  const section = params.section as AdminSection;
  if (!ADMIN_SECTIONS.includes(section)) return apiError(404, 'not_found', 'Admin page not found.');
  const familyId = locals.familyId!, user = locals.session!.user!;
  const [permissions, owner, settings] = await Promise.all([getPermissions(familyId, user.id), isOwner(familyId, user.id), getDashboardSettings(familyId)]);
  const feature = gated[section];
  if ((feature && !permissions[feature].read) || (section === 'permissions' && !owner)) return apiError(403, 'forbidden', 'You do not have access to this page.');
  const context: AdminContext = { user: { id: user.id, name: user.name ?? null, email: user.email ?? null, image: user.image ?? null }, family: { id: familyId, name: locals.family!.name }, permissions, owner, settings };
  function page<S extends AdminSection>(section: S, data: AdminResources[S]) { return json({ ...context, section, data }); }
  const timezone = settings.timezone === 'auto' ? householdTimezone() : settings.timezone;
  const members = () => db.query.householdMembers.findMany({ columns: { id: true, name: true, color: true, userId: true }, where: (m, { eq }) => eq(m.familyId, familyId), orderBy: (m, { asc }) => asc(m.sortOrder) });
  const chores = () => db.query.chores.findMany({ columns: { id: true, title: true, category: true, memberId: true, rotationMemberId: true, frequency: true, rewardType: true, rewardPoints: true, rewardCents: true, bounty: true, allowanceEnabled: true, maxBidCents: true }, where: (c, { eq }) => eq(c.familyId, familyId), orderBy: (c, { asc }) => asc(c.sortOrder) });
  switch (section) {
    case 'layout': return page(section, {});
    case 'account': {
      const google = await db.query.accounts.findFirst({ columns: { provider: true }, where: and(eq(accounts.userId, user.id), eq(accounts.provider, 'google')) });
      return page(section, { googleConnected: Boolean(google) });
    }
    case 'calendars': {
      const [calendars, people, writable, google] = await Promise.all([
        db.query.calendars.findMany({ columns: { id: true, name: true, color: true, enabled: true }, where: (c, { and, eq }) => and(eq(c.familyId, familyId), eq(c.userId, user.id)) }),
        members(), listWritableFamilyCalendars(familyId),
        db.query.accounts.findFirst({ columns: { scope: true }, where: and(eq(accounts.userId, user.id), eq(accounts.provider, 'google')) }),
      ]);
      return page(section, { calendars, members: people, writableCalendars: writable.map(c => ({ id: c.id, name: c.name })), hasEventWriteScope: google?.scope?.split(/\s+/).includes('https://www.googleapis.com/auth/calendar.events') ?? false, timezone });
    }
    case 'meals': {
      const today = zonedDateKey(new Date(), timezone);
      const meals = await db.query.meals.findMany({ columns: { id: true, date: true, mealType: true, description: true }, where: (m, { and, eq, gte }) => and(eq(m.familyId, familyId), gte(m.date, today)), orderBy: (m, { asc }) => [asc(m.date), asc(m.mealType)] });
      return page(section, { meals });
    }
    case 'notes': {
      const notes = await db.query.stickyNotes.findMany({ columns: { id: true, content: true, color: true, authorName: true, mediaUrl: true, mediaType: true, createdAt: true }, where: (n, { eq }) => eq(n.familyId, familyId), orderBy: (n, { desc }) => desc(n.createdAt) });
      return page(section, { notes: notes.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })) });
    }
    case 'chores': {
      const [items, people, goals, completions] = await Promise.all([chores(), members(),
        db.query.xpGoals.findMany({ where: (g, { eq }) => eq(g.familyId, familyId), orderBy: (g, { asc }) => asc(g.createdAt) }),
        db.query.choreCompletions.findMany({ where: (c, { eq }) => eq(c.familyId, familyId) }),
      ]);
      let total = 0; const xp = new Map<string, number>();
      for (const completion of completions) {
        const chore = items.find(c => c.id === completion.choreId);
        if (!chore || chore.rewardType !== 'xp') continue;
        total += chore.rewardPoints;
        const member = completion.memberId ?? chore.memberId;
        if (member) xp.set(member, (xp.get(member) ?? 0) + chore.rewardPoints);
      }
      return page(section, { chores: items, members: people, goals: goals.map(g => ({ id: g.id, title: g.title, memberId: g.memberId, targetPoints: g.targetPoints, earnedPoints: g.memberId ? xp.get(g.memberId) ?? 0 : total })) });
    }
    case 'allowance': {
      const [ledger, bids, items, people] = await Promise.all([
        db.query.allowanceLedger.findMany({ where: (l, { eq }) => eq(l.familyId, familyId), orderBy: (l, { desc }) => desc(l.createdAt) }),
        db.query.allowanceBids.findMany({ where: (b, { eq }) => eq(b.familyId, familyId), orderBy: (b, { desc }) => desc(b.createdAt) }), chores(), members(),
      ]);
      const balanceCents = ledger.reduce((sum, row) => sum + (row.kind === 'deposit' ? row.amountCents : -row.amountCents), 0);
      const reservedCents = bids.filter(b => b.status === 'approved').reduce((sum, b) => sum + b.amountCents, 0);
      return page(section, { balanceCents, reservedCents, availableCents: balanceCents - reservedCents,
        bids: bids.map(b => ({ id: b.id, choreTitle: items.find(c => c.id === b.choreId)?.title ?? 'Removed chore', memberName: people.find(m => m.id === b.memberId)?.name ?? 'Family member', amountCents: b.amountCents, status: b.status, createdAt: b.createdAt.toISOString() })),
        ledger: ledger.map(l => ({ id: l.id, kind: l.kind, amountCents: l.amountCents, memberName: people.find(m => m.id === l.memberId)?.name ?? null, note: l.note, createdAt: l.createdAt.toISOString() })), chores: items.filter(c => c.allowanceEnabled),
      });
    }
    case 'family': {
      const [people, household] = await Promise.all([
        db.select({ userId: familyMemberships.userId, name: users.name, email: users.email, role: familyMemberships.role }).from(familyMemberships).innerJoin(users, eq(users.id, familyMemberships.userId)).where(eq(familyMemberships.familyId, familyId)), members(),
      ]);
      return page(section, { people, members: household });
    }
    case 'permissions': {
      const people = await db.select({ userId: familyMemberships.userId, name: users.name, email: users.email }).from(familyMemberships).innerJoin(users, eq(users.id, familyMemberships.userId)).where(and(eq(familyMemberships.familyId, familyId), ne(familyMemberships.role, 'owner')));
      return page(section, { people: await Promise.all(people.map(async person => ({ ...person, permissions: await getPermissions(familyId, person.userId) }))) });
    }
    case 'overview': {
      const stats: AdminResources['overview']['stats'] = [], attention: AdminResources['overview']['attention'] = [];
      // Never fetch or return feature summaries the viewer cannot read.
      if (permissions.calendars.read) {
        const list = await db.query.calendars.findMany({ columns: { enabled: true }, where: (c, { eq }) => eq(c.familyId, familyId) });
        stats.push({ label: 'Calendars enabled', value: list.filter(c => c.enabled).length });
        if (!list.length) attention.push({ label: 'Connect your calendars', section: 'calendars' });
      }
      if (permissions.chores.read) stats.push({ label: 'Chores', value: (await chores()).length });
      if (permissions.notes.read) stats.push({ label: 'Notes', value: (await db.query.stickyNotes.findMany({ columns: { id: true }, where: (n, { eq }) => eq(n.familyId, familyId) })).length });
      if (permissions.meals.read) {
        const from = zonedDateKey(new Date(), timezone), to = zonedDateKey(new Date(Date.now() + 7 * 86400000), timezone);
        stats.push({ label: 'Meals this week', value: (await db.query.meals.findMany({ columns: { id: true }, where: (m, { and, eq, gte, lt }) => and(eq(m.familyId, familyId), gte(m.date, from), lt(m.date, to)) })).length });
      }
      if (permissions.family.read) stats.push({ label: 'Family members', value: (await members()).length });
      if (permissions.allowance.read) {
        const [ledger, bids] = await Promise.all([
          db.query.allowanceLedger.findMany({ columns: { kind: true, amountCents: true }, where: (l, { eq }) => eq(l.familyId, familyId) }),
          db.query.allowanceBids.findMany({ columns: { id: true }, where: (b, { and, eq }) => and(eq(b.familyId, familyId), eq(b.status, 'pending')) }),
        ]);
        stats.push({ label: 'Allowance pool', value: `$${(ledger.reduce((s, l) => s + (l.kind === 'deposit' ? l.amountCents : -l.amountCents), 0) / 100).toFixed(2)}` }, { label: 'Bids to review', value: bids.length });
        if (bids.length) attention.push({ label: `${bids.length} allowance bids need review`, section: 'allowance' });
      }
      return page(section, { stats, attention });
    }
  }
};
