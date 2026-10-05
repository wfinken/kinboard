import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { allowanceBids, chores, householdMembers } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, locals }) => {
  const { choreId, memberId, amount } = await request.json().catch(() => ({})) as { choreId?: string; memberId?: string; amount?: number };
  const amountCents = Math.round(Number(amount) * 100);
  if (!choreId || !memberId || !Number.isFinite(amountCents) || amountCents <= 0) return new Response('Invalid bid', { status: 400 });
  const familyId = locals.familyId!;
  const [chore, member] = await Promise.all([
    db.query.chores.findFirst({ where: and(eq(chores.id, choreId), eq(chores.familyId, familyId)) }),
    db.query.householdMembers.findFirst({ where: and(eq(householdMembers.id, memberId), eq(householdMembers.familyId, familyId)) }),
  ]);
  if (!chore?.allowanceEnabled || !member || amountCents > chore.maxBidCents) return new Response('Bid exceeds the chore limit or chore is unavailable', { status: 400 });
  const existing = await db.query.allowanceBids.findFirst({ where: and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.choreId, choreId), eq(allowanceBids.memberId, memberId), eq(allowanceBids.status, 'pending')) });
  if (existing) {
    await db.update(allowanceBids).set({ amountCents, createdAt: new Date() }).where(and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.id, existing.id)));
  } else {
    await db.insert(allowanceBids).values({ familyId, choreId, memberId, amountCents });
  }
  return new Response(null, { status: 204 });
};
