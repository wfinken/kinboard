import type { APIRoute } from 'astro';
import { rotateDashboardToken } from '../../../../lib/household';

export const POST: APIRoute = async ({ locals }) => {
  const familyId = locals.familyId;
  if (!familyId || !locals.session?.user) return new Response('Family required', { status: 401 });
  const updated = await rotateDashboardToken(familyId);
  if (!updated?.dashboardToken) return new Response('Family not found', { status: 404 });
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
