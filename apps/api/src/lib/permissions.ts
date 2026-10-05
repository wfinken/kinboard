import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { familyMemberships, permissions, PERMISSION_FEATURES, type PermissionFeature } from '../db/schema';

export type CrudAction = 'create' | 'read' | 'update' | 'delete';

const ACTION_COLUMN = {
  create: 'canCreate',
  read: 'canRead',
  update: 'canUpdate',
  delete: 'canDelete',
} as const;

const FULL_ACCESS = { create: true, read: true, update: true, delete: true };

export async function isOwner(familyId: string, userId: string): Promise<boolean> {
  const membership = await db.query.familyMemberships.findFirst({
    where: and(eq(familyMemberships.familyId, familyId), eq(familyMemberships.userId, userId)),
  });
  return membership?.role === 'owner';
}

/** A user+feature pair with no saved row has full access — permissions only
 *  need to be written when the owner actually restricts someone, so
 *  existing members need no backfill when a new feature is added. */
export async function hasPermission(familyId: string, userId: string, feature: PermissionFeature, action: CrudAction): Promise<boolean> {
  if (await isOwner(familyId, userId)) return true;
  const row = await db.query.permissions.findFirst({ where: and(eq(permissions.userId, userId), eq(permissions.feature, feature)) });
  if (!row) return true;
  return row[ACTION_COLUMN[action]];
}

/** All six features' CRUD grants for a user in one query — for gating nav
 *  items and buttons rather than individual API actions. */
export async function getPermissions(familyId: string, userId: string): Promise<Record<PermissionFeature, typeof FULL_ACCESS>> {
  const result = Object.fromEntries(PERMISSION_FEATURES.map((feature) => [feature, FULL_ACCESS])) as Record<PermissionFeature, typeof FULL_ACCESS>;
  if (await isOwner(familyId, userId)) return result;
  const rows = await db.query.permissions.findMany({ where: eq(permissions.userId, userId) });
  for (const row of rows) {
    result[row.feature] = { create: row.canCreate, read: row.canRead, update: row.canUpdate, delete: row.canDelete };
  }
  return result;
}

/** API-route guard: returns a Response to return immediately if the request
 *  should be blocked, or null to continue — mirrors the
 *  `if (!familyId) return redirect(...)` early-return style used throughout
 *  the admin API routes. */
export async function requirePermission(
  locals: App.Locals,
  feature: PermissionFeature,
  action: CrudAction,
): Promise<Response | null> {
  const familyId = locals.familyId;
  const userId = locals.session?.user?.id;
  if (!familyId || !userId) return new Response('Unauthorized', { status: 401 });
  const allowed = await hasPermission(familyId, userId, feature, action);
  return allowed ? null : new Response('Forbidden', { status: 403 });
}
