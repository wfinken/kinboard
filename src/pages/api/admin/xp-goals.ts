import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { householdMembers, xpGoals } from '../../../db/schema';
import { requirePermission } from '../../../lib/permissions';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  if (form.get('intent') === 'delete') {
    const denied = await requirePermission(locals, 'chores', 'delete');
    if (denied) return denied;
    const id = String(form.get('id') ?? '');
    await db.delete(xpGoals).where(and(eq(xpGoals.id, id), eq(xpGoals.familyId, locals.familyId!)));
    return redirect('/admin/chores#xp-goals');
  }
  const denied = await requirePermission(locals, 'chores', 'create');
  if (denied) return denied;
  const title = String(form.get('title') ?? '').trim().slice(0, 80);
  const targetPoints = Math.max(1, Math.min(1_000_000, Math.floor(Number(form.get('targetPoints')) || 0)));
  const memberId = String(form.get('memberId') ?? '') || null;
  const familyId = locals.familyId!;
  const validMember = memberId ? await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.id, memberId), eq(householdMembers.familyId, familyId)) }) : null;
  if (title && (!memberId || validMember)) await db.insert(xpGoals).values({ familyId, memberId, title, targetPoints });
  return redirect('/admin/chores#xp-goals');
};
