import type { APIRoute } from 'astro';
import { Auth } from '@auth/core';
import { calendarEventsAuthConfig } from '../../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, url }) => {
  if (!locals.session?.user) return new Response('Unauthorized', { status: 401 });
  const returnTo = url.searchParams.get('returnTo') ?? '/admin/calendars';
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/admin/calendars';
  const callbackUrl = new URL(safeReturnTo, url.origin).toString();
  const authRequest = new Request(new URL('/api/auth/signin/google', request.url), {
    method: 'POST',
    headers: request.headers,
    body: new URLSearchParams({ callbackUrl }),
  });
  return Auth(authRequest, calendarEventsAuthConfig);
};
