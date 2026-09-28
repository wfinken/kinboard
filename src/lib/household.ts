import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db/client';
import { dashboardSettings, families, familyInvites, familyMemberships } from '../db/schema';

export const DASHBOARD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function newDashboardToken() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12);
}

export async function rotateDashboardToken(familyId: string, expectedToken?: string | null) {
  const current = await db.query.families.findFirst({ where: eq(families.id, familyId) });
  if (!current) return null;
  if (expectedToken !== undefined && current.dashboardToken !== expectedToken) return current;
  const now = Date.now();
  if (expectedToken !== undefined && current.dashboardTokenExpiresAt && current.dashboardTokenExpiresAt.getTime() > now) return current;

  const dashboardToken = newDashboardToken();
  const dashboardTokenExpiresAt = new Date(now + DASHBOARD_TOKEN_TTL_MS);
  await db.update(families).set({ dashboardToken, dashboardTokenExpiresAt }).where(eq(families.id, familyId));
  return { ...current, dashboardToken, dashboardTokenExpiresAt };
}

export async function getActiveDashboardToken(familyId: string) {
  const current = await db.query.families.findFirst({ where: eq(families.id, familyId) });
  if (!current) return null;
  if (current.dashboardToken && current.dashboardTokenExpiresAt && current.dashboardTokenExpiresAt.getTime() > Date.now()) return current;
  return rotateDashboardToken(familyId);
}

export async function getFamilyContextByDashboardToken(token?: string | null) {
  if (!token) return null;
  const now = new Date();
  const family = await db.query.families.findFirst({
    where: and(eq(families.dashboardToken, token), gt(families.dashboardTokenExpiresAt, now)),
  });
  if (!family || !family.dashboardTokenExpiresAt) return null;
  return { familyId: family.id, family };
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

export async function getFamilyContextById(familyId?: string | null) {
  if (!familyId) return null;
  const family = await db.query.families.findFirst({ where: eq(families.id, familyId) });
  return family ? { familyId, family } : null;
}

export async function joinFamily(userId: string, token: string): Promise<boolean> {
  const invite = await db.query.familyInvites.findFirst({ where: eq(familyInvites.token, token) });
  if (!invite || invite.expiresAt.getTime() <= Date.now()) return false;
  await db.delete(familyMemberships).where(eq(familyMemberships.userId, userId));
  await db.insert(familyMemberships).values({ familyId: invite.familyId, userId, role: 'member' }).onConflictDoNothing();
  await db.delete(familyInvites).where(eq(familyInvites.token, token));
  return true;
}
