import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { stickyNotes } from '../../../../../db/schema';

export const POST: APIRoute = async ({ params, redirect }) => {
  if (params.id) {
    await db.delete(stickyNotes).where(eq(stickyNotes.id, params.id));
  }
  return redirect('/admin/notes');
};
