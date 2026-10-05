import type { APIRoute } from 'astro';
import { Auth } from '@auth/core';
import { calendarEventsAuthConfig } from '../../../../lib/auth';

export const prerender = false;

function getSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (withGetter.getSetCookie) return withGetter.getSetCookie();
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

export const GET: APIRoute = async ({ request, locals, url }) => {
  if (!locals.session?.user) return new Response('Unauthorized', { status: 401 });
  const returnTo = url.searchParams.get('returnTo') ?? '/admin/calendars';
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/admin/calendars';
  const callbackUrl = new URL(safeReturnTo, url.origin).toString();

  // Auth.js's sign-in action requires a csrfToken in the POST body that
  // matches its own csrf cookie, or it rejects the request with
  // MissingCSRF. A real sign-in page fetches that token via the /csrf
  // action first; do the same server-to-server instead of reimplementing
  // its cookie format here.
  const csrfRequest = new Request(new URL('/api/auth/csrf', request.url), { headers: request.headers });
  const csrfResponse = await Auth(csrfRequest, calendarEventsAuthConfig);
  const { csrfToken } = (await csrfResponse.json().catch(() => ({}))) as { csrfToken?: string };
  if (!csrfToken) return new Response('Unable to establish a CSRF token', { status: 500 });

  // If no csrf cookie existed yet, the call above just minted one — carry
  // it into the sign-in request's Cookie header so the two match.
  const freshCookies = getSetCookies(csrfResponse.headers);
  const authHeaders = new Headers(request.headers);
  if (freshCookies.length) {
    const cookieHeader = [request.headers.get('cookie'), ...freshCookies.map((c) => c.split(';')[0])].filter(Boolean).join('; ');
    authHeaders.set('cookie', cookieHeader);
  }

  const authRequest = new Request(new URL('/api/auth/signin/google', request.url), {
    method: 'POST',
    headers: authHeaders,
    body: new URLSearchParams({ csrfToken, callbackUrl }),
  });
  const signinResponse = await Auth(authRequest, calendarEventsAuthConfig);
  if (!freshCookies.length) return signinResponse;

  // Relay the freshly minted csrf cookie to the browser too, alongside the
  // OAuth state/PKCE cookies the sign-in step just set.
  const finalHeaders = new Headers(signinResponse.headers);
  for (const cookie of freshCookies) finalHeaders.append('set-cookie', cookie);
  return new Response(signinResponse.body, { status: signinResponse.status, statusText: signinResponse.statusText, headers: finalHeaders });
};
