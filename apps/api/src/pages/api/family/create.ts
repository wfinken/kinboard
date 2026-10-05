import type { APIRoute } from 'astro';
import { db } from '../../../db/client';
import { dashboardSettings, families, familyMemberships } from '../../../db/schema';

export const POST: APIRoute = async ({ locals, request, redirect }) => {
  const user = locals.session?.user;
  if (!user) return redirect('/login');
  if (locals.familyId) return redirect('/');
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim().slice(0, 80) || `${user.name?.split(' ')[0] || 'My'}'s Family`;
  const familyId = crypto.randomUUID();
  await db.insert(families).values({ id: familyId, name, ownerUserId: user.id });
  await db.insert(familyMemberships).values({ familyId, userId: user.id, role: 'owner' });
  await db.insert(dashboardSettings).values({ id: familyId });
  return redirect('/admin');
};
