import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { stickyNotes } from '../../../../../db/schema';
import { requirePermission } from '../../../../../lib/permissions';

export const POST: APIRoute = async ({ params, redirect, locals }) => {
  const denied = await requirePermission(locals, 'notes', 'delete');
  if (denied) return denied;
  if (params.id) {
    await db.delete(stickyNotes).where(and(eq(stickyNotes.id, params.id), eq(stickyNotes.familyId, locals.familyId!)));
  }
  return redirect('/admin/notes');
};
