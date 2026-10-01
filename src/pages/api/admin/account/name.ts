import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { users, householdMembers } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const userId = locals.session?.user?.id;
  if (!userId) return redirect('/login');
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();

  if (name) {
    await db.update(users).set({ name }).where(eq(users.id, userId));
    // Keep the assignment label (chores/calendar/allowance) in sync with the
    // display name shown in the app, rather than the one-time value it was
    // seeded with when the linked householdMembers row was first created.
    await db.update(householdMembers).set({ name }).where(eq(householdMembers.userId, userId));
  }

  return redirect('/admin/account');
};
