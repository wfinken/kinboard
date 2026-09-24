import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { householdMembers } from '../../../../../db/schema';

export const POST: APIRoute = async ({ params, redirect }) => {
  if (params.id) {
    await db.delete(householdMembers).where(eq(householdMembers.id, params.id));
  }
  return redirect('/admin');
};
