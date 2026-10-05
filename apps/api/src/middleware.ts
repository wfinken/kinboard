import { apiError, json } from './lib/api';
import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';
import { getFamilyContext, ensureHouseholdMemberForUser } from './lib/household';

const appOrigin = process.env.KINBOARD_APP_ORIGIN ?? '';
const isVersionedApiPath = (path: string) => path === '/api/v1' || path.startsWith('/api/v1/');
function addCors(response: Response, origin: string) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
  headers.set('Access-Control-Max-Age', '600');
  headers.append('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
const appMiddleware = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isV1 = isVersionedApiPath(pathname);
  const jsonForm = context.request.method === 'POST' &&
    (pathname.startsWith('/api/admin/') || pathname === '/api/family/invite') &&
    context.request.headers.get('accept')?.includes('application/json');
  const jsonApi = isV1 || jsonForm;
  const origin = context.request.headers.get('origin');
  if (isV1 && context.request.method === 'OPTIONS') {
    if (!origin || origin !== appOrigin) return apiError(403, 'invalid_origin', 'This origin cannot access the API.');
    return addCors(new Response(null, { status: 204 }), origin);
  }
  if (pathname === '/admin/login') return context.redirect('/login?callbackUrl=%2Fadmin%2F');
  if (pathname === '/admin/calendar' || pathname === '/admin/calendar/') {
    const destination = new URL(context.url);
    destination.pathname = '/admin/calendars/';
    return context.redirect(destination.toString(), 307);
  }
  // The static shell contains no private data. Every data request authenticates.
  if (pathname === '/app' || pathname.startsWith('/app/') || pathname === '/admin' || pathname.startsWith('/admin/')) return next();
  if (jsonApi && !['GET', 'HEAD'].includes(context.request.method)) {
    if (origin && origin !== context.url.origin && !(isV1 && origin === appOrigin)) return apiError(403, 'invalid_origin', 'Cross-origin writes are not allowed.');
    if (isV1 && context.request.method !== 'DELETE' && !context.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return apiError(415, 'unsupported_media_type', 'Use application/json.');
  }

  // Invite short links use the token as the sole subdomain label. Redirect
  // them to the canonical app host so sign-in cookies remain first-party.
  const hostname = context.url.hostname.toLowerCase();
  const inviteHostSuffix = '.invite.kinboard.xyz';
  if (hostname.endsWith(inviteHostSuffix)) {
    const token = hostname.slice(0, -inviteHostSuffix.length);
    if (/^[A-Za-z0-9]{10}$/.test(token)) {
      const destination = new URL(`/join/${encodeURIComponent(token)}${context.url.search}`, 'https://app.kinboard.xyz');
      return context.redirect(destination.toString(), 302);
    }
  }

  const isLoginRoute = pathname === '/login' || pathname === '/admin/login';
  const isAuthRoute = pathname.startsWith('/api/auth');
  const isFamilySetup = pathname === '/welcome' || pathname === '/api/family/create' || pathname === '/api/family/join';
  const isProtectedRoute = !isLoginRoute && !isAuthRoute;

  if (isProtectedRoute) {
    const session = await getSession(context.request);
    if (!session?.user) {
      if (jsonApi) return apiError(401, 'unauthorized', 'Sign in to continue.');
      if (pathname.startsWith('/api/') && !isFamilySetup) {
        return new Response('Unauthorized', { status: 401 });
      }
      const callbackUrl = `${context.url.pathname}${context.url.search}`;
      return context.redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    context.locals.session = session;
    const user = session.user;
    const isFamilyJoin = pathname.startsWith('/join/') || pathname.startsWith('/api/family/join/');
    const family = await getFamilyContext(context.request, user.id);
    context.locals.familyId = family?.familyId ?? null;
    context.locals.family = family?.family ?? null;
    if (!family && jsonApi) return apiError(409, 'family_required', 'Create or join a family.');
    if (!family && !isFamilyJoin && !isFamilySetup) return context.redirect('/welcome');
    // Backfills the link for users who signed in before this existed, and
    // covers brand-new owners/joiners too — see ensureHouseholdMemberForUser.
    if (family) await ensureHouseholdMemberForUser(family.familyId, user.id, user.name || 'Family member');
  }

  if (isLoginRoute) {
    const session = await getSession(context.request);
    if (session?.user) return context.redirect('/');
  }

  if (jsonApi) {
    try {
      const response = await next();
      response.headers.set('Cache-Control', 'private, no-store');
      if (jsonForm) {
        const location = response.headers.get('location');
        if (location && response.status >= 300 && response.status < 400) {
          const destination = new URL(location, context.url);
          const error = destination.searchParams.get('error') || destination.searchParams.get('eventError');
          if (error) return apiError(422, 'action_failed', error);
          const synced = destination.searchParams.get('synced');
          return json({ ok: true, message: synced !== null ? `Synced ${synced} calendars.` : 'Changes saved.' });
        }
        if (!response.ok && !response.headers.get('content-type')?.includes('application/json')) {
          return apiError(response.status, response.status === 403 ? 'forbidden' : 'action_failed', await response.text());
        }
      }
      if (response.status === 404) return apiError(404, 'not_found', 'API route not found.');
      return response;
    } catch (error) {
      console.error('API request failed', error);
      return apiError(500, 'internal_error', 'The request could not be completed.');
    }
  }
  return next();
});


export const onRequest = defineMiddleware(async (context, next) => {
  const response = await appMiddleware(context, next);
  const origin = context.request.headers.get('origin');
  if (!response) return next();
  if (isVersionedApiPath(context.url.pathname) && origin && origin === appOrigin) return addCors(response, origin);
  return response;
});
