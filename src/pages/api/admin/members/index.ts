import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { householdMembers } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const color = String(form.get('color') ?? '#38bdf8');

  if (name) {
    await db.insert(householdMembers).values({ name, color });
  }

  return redirect('/admin');
};
