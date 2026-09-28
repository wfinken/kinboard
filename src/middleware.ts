import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';
import { getFamilyContext, getFamilyContextByDashboardToken, getFamilyContextById } from './lib/household';

const DASHBOARD_COOKIE = 'kinboard_dashboard';
const DASHBOARD_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function dashboardHmacKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signDashboardSession(familyId: string) {
  const key = await dashboardHmacKey();
  if (!key) return null;
  const payload = `${familyId}\n${Date.now() + DASHBOARD_SESSION_TTL_SECONDS * 1000}`;
  const encodedPayload = toBase64Url(new TextEncoder().encode(payload));
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyDashboardSession(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${DASHBOARD_COOKIE}=`));
  const value = cookie?.slice(DASHBOARD_COOKIE.length + 1);
  const [encodedPayload, encodedSignature] = value?.split('.') ?? [];
  if (!encodedPayload || !encodedSignature) return null;
  const key = await dashboardHmacKey();
  if (!key) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(encodedSignature), new TextEncoder().encode(encodedPayload));
    if (!valid) return null;
    const [familyId, expiresAt] = new TextDecoder().decode(fromBase64Url(encodedPayload)).split('\n');
    return familyId && Number(expiresAt) > Date.now() ? familyId : null;
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isLoginRoute = pathname === '/login' || pathname === '/admin/login';
  const isAuthRoute = pathname.startsWith('/api/auth');
  const isFamilySetup = pathname === '/welcome' || pathname === '/api/family/create' || pathname === '/api/family/join';
  const isKioskRoute = pathname === '/' || pathname.startsWith('/api/dashboard/');
  const isProtectedRoute = !isLoginRoute && !isAuthRoute && !isKioskRoute;

  if (isKioskRoute) {
    const dashboardAddress = context.url.searchParams.get('family') ?? context.request.headers.get('x-kinboard-family');
    let family = dashboardAddress ? await getFamilyContextByDashboardToken(dashboardAddress) : null;
    let refreshDashboardCookie = Boolean(family);
    if (!family) {
      const cookieFamilyId = await verifyDashboardSession(context.request);
      family = cookieFamilyId ? await getFamilyContextById(cookieFamilyId) : null;
      refreshDashboardCookie = Boolean(family);
    }
    if (!family) {
      const session = await getSession(context.request);
      if (session?.user) {
        context.locals.session = session;
        family = await getFamilyContext(context.request, session.user.id);
      }
    }
    if (family) {
      context.locals.familyId = family.familyId;
      context.locals.family = family.family;
      context.locals.refreshDashboardCookie = refreshDashboardCookie;
    }
    if (!context.locals.familyId && pathname.startsWith('/api/')) return new Response('Family required', { status: 400 });
  }

  if (isProtectedRoute) {
    const session = await getSession(context.request);
    if (!session?.user) {
      if (pathname.startsWith('/api/') && !isFamilySetup) {
        return new Response('Unauthorized', { status: 401 });
      }
      const callbackUrl = `${context.url.pathname}${context.url.search}`;
      return context.redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    context.locals.session = session;
    const user = session.user;
    const isFamilyJoin = pathname.startsWith('/join/') || pathname.startsWith('/api/family/join/');
    let family = await getFamilyContext(context.request, user.id);
    context.locals.familyId = family?.familyId ?? null;
    context.locals.family = family?.family ?? null;
    if (!family && !isFamilyJoin && !isFamilySetup) return context.redirect('/welcome');
  }

  if (isLoginRoute) {
    const session = await getSession(context.request);
    if (session?.user) return context.redirect('/');
  }

  const response = await next();
  if (isKioskRoute && context.locals.refreshDashboardCookie && context.locals.familyId) {
    const signedCookie = await signDashboardSession(context.locals.familyId);
    if (signedCookie) {
      const headers = new Headers(response.headers);
      headers.append('Set-Cookie', `${DASHBOARD_COOKIE}=${signedCookie}; Path=/; Max-Age=${DASHBOARD_SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
  }
  return response;
});
