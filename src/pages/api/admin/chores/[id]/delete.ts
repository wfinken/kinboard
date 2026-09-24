import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { chores } from '../../../../../db/schema';

export const POST: APIRoute = async ({ params, redirect }) => {
  if (params.id) {
    await db.delete(chores).where(eq(chores.id, params.id));
  }
  return redirect('/admin/chores');
};
