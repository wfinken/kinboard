import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { choreClaims, chores, householdMembers } from '../../../../db/schema';

export const POST: APIRoute = async ({ request }) => {
  const { choreId, memberId } = await request.json().catch(() => ({})) as { choreId?: string; memberId?: string };
  if (!choreId || !memberId) return new Response('Missing chore or member', { status: 400 });
  const chore = await db.query.chores.findFirst({ where: eq(chores.id, choreId) });
  const member = await db.query.householdMembers.findFirst({ where: eq(householdMembers.id, memberId) });
  if (!chore?.bounty || !member) return new Response('Unavailable', { status: 404 });
  await db.insert(choreClaims).values({ choreId, memberId }).onConflictDoUpdate({ target: choreClaims.choreId, set: { memberId, claimedAt: new Date() } });
  return new Response(null, { status: 204 });
};
