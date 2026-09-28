import type { APIRoute } from 'astro';
export const POST: APIRoute = async ({ locals, params, redirect }) => {
  const userId = locals.session?.user?.id;
  if (!userId) return redirect(`/login?callbackUrl=${encodeURIComponent(`/welcome?invite=${params.token}`)}`);
  const { joinFamily } = await import('../../../../lib/household');
  const joined = await joinFamily(userId, params.token ?? '');
  return redirect(joined ? '/' : '/welcome?error=invite');
};
