import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { householdMembers } from '../../../../db/schema';
import { requirePermission } from '../../../../lib/permissions';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const denied = await requirePermission(locals, 'family', 'create');
  if (denied) return denied;
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const color = String(form.get('color') ?? '#38bdf8');

  if (name) {
    await db.insert(householdMembers).values({ name, color, familyId: locals.familyId! });
  }

  return redirect('/admin/family');
};
