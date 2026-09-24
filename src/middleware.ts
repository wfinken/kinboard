import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isProtectedAdminRoute =
    pathname.startsWith('/admin') && pathname !== '/admin/login';
  // Only /api/admin/* requires the household owner's Google session. Routes
  // under /api/dashboard/* (e.g. toggling a chore) are reachable from any
  // device on the kiosk/tablet without login, same as the public dashboard.
  const isProtectedApiRoute = pathname.startsWith('/api/admin');

  if (isProtectedAdminRoute || isProtectedApiRoute) {
    const session = await getSession(context.request);
    if (!session?.user) {
      if (isProtectedApiRoute) {
        return new Response('Unauthorized', { status: 401 });
      }
      return context.redirect('/admin/login');
    }
    context.locals.session = session;
  }

  return next();
});
