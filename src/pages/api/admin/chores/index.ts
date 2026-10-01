import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { chores } from '../../../../db/schema';
import { requirePermission } from '../../../../lib/permissions';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const denied = await requirePermission(locals, 'chores', 'create');
  if (denied) return denied;
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const category = String(form.get('category') ?? 'General').trim() || 'General';
  const memberId = String(form.get('memberId') ?? '') || null;
  const frequency = form.get('frequency') === 'weekly' ? 'weekly' : 'daily';
  const rotationMemberId = String(form.get('rotationMemberId') ?? '') || null;
  const rewardType = form.get('rewardType') === 'allowance' ? 'allowance' : 'xp';
  const rewardPoints = rewardType === 'xp' ? Math.max(1, Math.min(100000, Math.floor(Number(form.get('rewardPoints')) || 10))) : 0;
  const rewardCents = rewardType === 'allowance' ? Math.max(0, Math.round((Number(form.get('rewardAmount')) || 0) * 100)) : 0;
  const bounty = form.get('bounty') === 'on';
  const allowanceEnabled = rewardType === 'allowance' && form.get('allowanceEnabled') === 'on';
  const maxBidCents = Math.max(0, Math.round((Number(form.get('maxBid')) || 0) * 100));

  if (title) {
    await db.insert(chores).values({ familyId: locals.familyId!, title, category, memberId, frequency, rotationMemberId, rewardType, rewardPoints, rewardCents, bounty, allowanceEnabled, maxBidCents });
  }

  return redirect(String(form.get('returnTo') ?? '/admin/chores'));
};
