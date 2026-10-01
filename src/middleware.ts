import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';
import { getFamilyContext, ensureHouseholdMemberForUser } from './lib/household';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isLoginRoute = pathname === '/login' || pathname === '/admin/login';
  const isAuthRoute = pathname.startsWith('/api/auth');
  const isFamilySetup = pathname === '/welcome' || pathname === '/api/family/create' || pathname === '/api/family/join';
  const isProtectedRoute = !isLoginRoute && !isAuthRoute;

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
    const family = await getFamilyContext(context.request, user.id);
    context.locals.familyId = family?.familyId ?? null;
    context.locals.family = family?.family ?? null;
    if (!family && !isFamilyJoin && !isFamilySetup) return context.redirect('/welcome');
    // Backfills the link for users who signed in before this existed, and
    // covers brand-new owners/joiners too — see ensureHouseholdMemberForUser.
    if (family) await ensureHouseholdMemberForUser(family.familyId, user.id, user.name || 'Family member');
  }

  if (isLoginRoute) {
    const session = await getSession(context.request);
    if (session?.user) return context.redirect('/');
  }

  return next();
});
