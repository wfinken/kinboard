import type { APIRoute } from 'astro';
import { joinFamily } from '../../../lib/household';

export const POST: APIRoute = async ({ locals, request, redirect }) => {
  const userId = locals.session?.user?.id;
  if (!userId) return redirect('/login');
  const form = await request.formData();
  const token = String(form.get('token') ?? '').trim();
  const joined = token ? await joinFamily(userId, token) : false;
  if (!joined) return redirect('/welcome?error=invite');
  return redirect('/');
};
