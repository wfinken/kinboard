import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { householdMembers } from '../../../../../db/schema';
import { requirePermission } from '../../../../../lib/permissions';

export const POST: APIRoute = async ({ params, redirect, locals }) => {
  const denied = await requirePermission(locals, 'family', 'delete');
  if (denied) return denied;
  if (params.id) {
    await db.delete(householdMembers).where(and(eq(householdMembers.id, params.id), eq(householdMembers.familyId, locals.familyId!)));
  }
  return redirect('/admin/family');
};
