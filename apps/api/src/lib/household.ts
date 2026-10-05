import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { dashboardSettings, families, familyInvites, familyMemberships, householdMembers } from '../db/schema';

// Mirrors ColorPicker.astro's preset palette — kept separate since that's a
// UI component's local constant, not something a lib module should import.
const MEMBER_COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
];

/** Finds or creates the householdMembers row a signed-in user is assignable
 *  through (chores/calendar events/allowance all reference householdMembers,
 *  not users) — id est, links their account into the same "assignable
 *  person" table used for kids without their own sign-in. Idempotent, so
 *  it's safe to call on every request that resolves a family. */
export async function ensureHouseholdMemberForUser(familyId: string, userId: string, name: string) {
  const existing = await db.query.householdMembers.findFirst({ where: eq(householdMembers.userId, userId) });
  if (existing) return existing;
  const memberCount = await db.$count(householdMembers, eq(householdMembers.familyId, familyId));
  const color = MEMBER_COLOR_PALETTE[memberCount % MEMBER_COLOR_PALETTE.length];
  await db.insert(householdMembers).values({ familyId, userId, name, color }).onConflictDoNothing({ target: householdMembers.userId });
  return db.query.householdMembers.findFirst({ where: eq(householdMembers.userId, userId) });
}

export async function getFamilyIdForUser(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const membership = await db.query.familyMemberships.findFirst({ where: eq(familyMemberships.userId, userId) });
  return membership?.familyId ?? null;
}

export async function ensureFamilyForUser(user: { id: string; name?: string | null }): Promise<string> {
  const existing = await getFamilyIdForUser(user.id);
  if (existing) return existing;
  const familyId = crypto.randomUUID();
  const name = user.name ? `${user.name.split(' ')[0]}'s Family` : 'My Family';
  await db.insert(families).values({ id: familyId, name, ownerUserId: user.id });
  await db.insert(familyMemberships).values({ familyId, userId: user.id, role: 'owner' });
  await db.insert(dashboardSettings).values({ id: familyId });
  return familyId;
}

export async function getFamilyContext(request: Request, userId?: string | null) {
  const familyId = await getFamilyIdForUser(userId);
  if (!familyId) return null;
  const family = await db.query.families.findFirst({ where: eq(families.id, familyId) });
  return family ? { familyId, family, request } : null;
}

export async function joinFamily(userId: string, token: string): Promise<boolean> {
  const invite = await db.query.familyInvites.findFirst({ where: eq(familyInvites.token, token) });
  if (!invite || invite.expiresAt.getTime() <= Date.now()) return false;
  await db.delete(familyMemberships).where(eq(familyMemberships.userId, userId));
  await db.insert(familyMemberships).values({ familyId: invite.familyId, userId, role: 'member' }).onConflictDoNothing();
  await db.delete(familyInvites).where(eq(familyInvites.token, token));
  return true;
}
