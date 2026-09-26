import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { chores } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const category = String(form.get('category') ?? 'General').trim() || 'General';
  const memberId = String(form.get('memberId') ?? '') || null;
  const frequency = form.get('frequency') === 'weekly' ? 'weekly' : 'daily';
  const rotationMemberId = String(form.get('rotationMemberId') ?? '') || null;
  const rewardPoints = Math.max(0, Number(form.get('rewardPoints')) || 1);
  const rewardCents = Math.max(0, Math.round((Number(form.get('rewardAmount')) || 0) * 100));
  const bounty = form.get('bounty') === 'on';

  if (title) {
    await db.insert(chores).values({ title, category, memberId, frequency, rotationMemberId, rewardPoints, rewardCents, bounty });
  }

  return redirect(String(form.get('returnTo') ?? '/admin/chores'));
};
