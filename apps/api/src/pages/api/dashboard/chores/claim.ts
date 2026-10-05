import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { choreClaims, chores, householdMembers } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, locals }) => {
  const { choreId, memberId } = await request.json().catch(() => ({})) as { choreId?: string; memberId?: string };
  if (!choreId || !memberId) return new Response('Missing chore or member', { status: 400 });
  const familyId = locals.familyId!;
  const chore = await db.query.chores.findFirst({ where: and(eq(chores.id, choreId), eq(chores.familyId, familyId)) });
  const member = await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.id, memberId), eq(householdMembers.familyId, familyId)) });
  if (!chore?.bounty || !member) return new Response('Unavailable', { status: 404 });
  await db.insert(choreClaims).values({ familyId, choreId, memberId }).onConflictDoUpdate({ target: choreClaims.choreId, set: { familyId, memberId, claimedAt: new Date() } });
  return new Response(null, { status: 204 });
};
