import { Auth, type AuthConfig } from '@auth/core';
import type { Session } from '@auth/core/types';
import Google from '@auth/core/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, accounts, sessions, verificationTokens } from '../db/schema';

export const authConfig: AuthConfig = {
  basePath: '/api/auth',
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'database' },
  cookies: {
    sessionToken: {
      options: { domain: process.env.AUTH_COOKIE_DOMAIN || undefined },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    // Re-authenticating an already-linked Google account (e.g. granting the
    // broader calendar.events scope via /admin/calendars/connect) hits
    // @auth/core's early-return path for "already linked to this user" and
    // never calls the adapter's linkAccount again — so the fresh
    // tokens/scope from that consent would otherwise be silently discarded.
    // Persist them here instead. This runs before the account row exists on
    // a brand-new sign-in, so the update is a harmless no-op in that case.
    async signIn({ account }) {
      if (account?.provider === 'google' && account.providerAccountId) {
        await db
          .update(accounts)
          .set({
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          })
          .where(and(eq(accounts.provider, account.provider), eq(accounts.providerAccountId, account.providerAccountId)));
      }
      return true;
    },
  },
};

/** Auth config used only when the signed-in user explicitly connects event
 *  creation. Keeping the write scope out of the regular sign-in consent keeps
 *  the default Google grant read-only. */
export const calendarEventsAuthConfig: AuthConfig = {
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
        },
      },
    }),
  ],
};

/** Reads the current session by replaying the request's cookies against
 *  Auth.js's own /session endpoint — the standard way to check auth state
 *  from framework code when there's no official Astro integration. */
export async function getSession(request: Request, onSetCookie?: (cookie: string) => void): Promise<Session | null> {
  const url = new URL('/api/auth/session', request.url);
  const response = await Auth(new Request(url, { headers: request.headers }), authConfig);
  const setCookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
  const refreshedCookie = setCookies.find((cookie) => /^(?:__Secure-)?authjs\.session-token=/.test(cookie));
  if (refreshedCookie) onSetCookie?.(refreshedCookie);

  const session = (await response.json().catch(() => null)) as Session | null;
  if (!session || Object.keys(session).length === 0) return null;

  return session;
}
