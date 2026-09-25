import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isLoginRoute = pathname === '/login' || pathname === '/admin/login';
  const isAuthRoute = pathname.startsWith('/api/auth');
  const isProtectedRoute = !isLoginRoute && !isAuthRoute;

  if (isProtectedRoute) {
    const session = await getSession(context.request);
    if (!session?.user) {
      if (pathname.startsWith('/api/')) {
        return new Response('Unauthorized', { status: 401 });
      }
      const callbackUrl = `${context.url.pathname}${context.url.search}`;
      return context.redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    context.locals.session = session;
  }

  if (isLoginRoute) {
    const session = await getSession(context.request);
    if (session?.user) return context.redirect('/');
  }

  return next();
});
