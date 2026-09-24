import { Auth, type AuthConfig } from '@auth/core';
import type { Session } from '@auth/core/types';
import Google from '@auth/core/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
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
  },
};

/** Reads the current session by replaying the request's cookies against
 *  Auth.js's own /session endpoint — the standard way to check auth state
 *  from framework code when there's no official Astro integration. */
export async function getSession(request: Request): Promise<Session | null> {
  const url = new URL('/api/auth/session', request.url);
  const response = await Auth(new Request(url, { headers: request.headers }), authConfig);

  const session = (await response.json().catch(() => null)) as Session | null;
  if (!session || Object.keys(session).length === 0) return null;

  return session;
}
