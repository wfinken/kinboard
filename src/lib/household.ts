import { db } from '../db/client';

/**
 * Phase 1 is single-household self-hosting: whichever Google account signed
 * in first "owns" the calendars shown on the public kiosk dashboard. Multi-
 * household support arrives with SaaS multi-tenancy in Phase 3.
 */
export async function getHouseholdOwnerId(): Promise<string | null> {
  const owner = await db.query.users.findFirst();
  return owner?.id ?? null;
}
