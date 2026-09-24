import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { chores } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const category = String(form.get('category') ?? 'General').trim() || 'General';
  const memberId = String(form.get('memberId') ?? '') || null;
  const frequency = form.get('frequency') === 'weekly' ? 'weekly' : 'daily';

  if (title) {
    await db.insert(chores).values({ title, category, memberId, frequency });
  }

  return redirect('/admin/chores');
};
