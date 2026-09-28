import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { chores, choreCompletions, allowanceBids, allowanceLedger } from '../../../../../db/schema';
import { currentPeriodKey } from '../../../../../lib/chores';

export const POST: APIRoute = async ({ params, request, locals, url }) => {
  const choreId = params.id;
  if (!choreId) return new Response('Missing chore id', { status: 400 });

  const familyId = locals.familyId ?? url.searchParams.get('family');
  if (!familyId) return new Response('Family required', { status: 400 });
  const chore = await db.query.chores.findFirst({ where: and(eq(chores.id, choreId), eq(chores.familyId, familyId)) });
  if (!chore) return new Response('Chore not found', { status: 404 });

  const { completed } = (await request.json()) as { completed: boolean };
  const periodKey = currentPeriodKey(chore.frequency);

  if (completed) {
    const newCompletion = await db
      .insert(choreCompletions)
      .values({ familyId, choreId, periodKey, completedAt: new Date() })
      .onConflictDoNothing()
      .returning({ choreId: choreCompletions.choreId });
    if (newCompletion.length) {
      const approvedBid = await db.query.allowanceBids.findFirst({ where: and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.choreId, choreId), eq(allowanceBids.status, 'approved')) });
      if (approvedBid) {
        await db.insert(allowanceLedger).values({ familyId, kind: 'payout', amountCents: approvedBid.amountCents, memberId: approvedBid.memberId, choreId, note: `Allowance: ${chore.title}` });
        await db.update(allowanceBids).set({ status: 'paid', decidedAt: new Date() }).where(and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.id, approvedBid.id)));
      }
    }
  } else {
    await db
      .delete(choreCompletions)
      .where(and(eq(choreCompletions.choreId, choreId), eq(choreCompletions.periodKey, periodKey)));
  }

  return new Response(null, { status: 204 });
};
