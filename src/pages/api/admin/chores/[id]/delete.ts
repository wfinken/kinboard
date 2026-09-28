import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { chores } from '../../../../../db/schema';

export const POST: APIRoute = async ({ params, redirect, locals }) => {
  if (params.id) {
    await db.delete(chores).where(and(eq(chores.id, params.id), eq(chores.familyId, locals.familyId!)));
  }
  return redirect('/admin/chores');
};
