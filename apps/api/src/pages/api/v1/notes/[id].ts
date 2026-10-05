import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { stickyNotes } from '../../../../db/schema';
import { hasPermission } from '../../../../lib/permissions';
import { apiError } from '../../../../lib/api';
export const DELETE: APIRoute = async ({ params, locals }) => {
  const familyId = locals.familyId!, user = locals.session!.user!;
  if (!await hasPermission(familyId, user.id, 'notes', 'delete')) return apiError(403, 'forbidden', 'You cannot delete notes.');
  const rows = await db.delete(stickyNotes).where(and(eq(stickyNotes.id, params.id!), eq(stickyNotes.familyId, familyId))).returning({ id: stickyNotes.id });
  return rows.length ? new Response(null, { status: 204 }) : apiError(404, 'not_found', 'Note not found.');
};
