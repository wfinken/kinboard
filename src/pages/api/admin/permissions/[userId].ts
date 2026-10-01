import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { familyMemberships, permissions, PERMISSION_FEATURES } from '../../../../db/schema';
import { isOwner } from '../../../../lib/permissions';

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const familyId = locals.familyId;
  const ownerId = locals.session?.user?.id;
  const targetUserId = params.userId;
  if (!familyId || !ownerId || !targetUserId) return new Response('Bad request', { status: 400 });

  // Only the owner may change permissions, and this is checked directly
  // rather than via requirePermission — gating it by the 'family' feature
  // permission would let a member granted family/update grant themselves
  // (or anyone) everything else too.
  if (!(await isOwner(familyId, ownerId))) return new Response('Forbidden', { status: 403 });

  const membership = await db.query.familyMemberships.findFirst({
    where: and(eq(familyMemberships.familyId, familyId), eq(familyMemberships.userId, targetUserId)),
  });
  if (!membership || membership.role === 'owner') return new Response('Not found', { status: 404 });

  const form = await request.formData();
  for (const feature of PERMISSION_FEATURES) {
    const canCreate = form.has(`${feature}.create`);
    const canRead = form.has(`${feature}.read`);
    const canUpdate = form.has(`${feature}.update`);
    const canDelete = form.has(`${feature}.delete`);
    await db
      .insert(permissions)
      .values({ familyId, userId: targetUserId, feature, canCreate, canRead, canUpdate, canDelete })
      .onConflictDoUpdate({ target: [permissions.userId, permissions.feature], set: { canCreate, canRead, canUpdate, canDelete } });
  }

  return redirect(`/admin/permissions#${targetUserId}`);
};
