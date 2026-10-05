import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { chores, choreCompletions, allowanceBids, allowanceLedger, choreClaims, householdMembers } from '../../../../../db/schema';
import { currentPeriodKey } from '../../../../../lib/chores';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const choreId = params.id;
  if (!choreId) return new Response('Missing chore id', { status: 400 });

  const familyId = locals.familyId!;
  const chore = await db.query.chores.findFirst({ where: and(eq(chores.id, choreId), eq(chores.familyId, familyId)) });
  if (!chore) return new Response('Chore not found', { status: 404 });

  const { completed, memberId } = (await request.json()) as { completed: boolean; memberId?: string };
  const periodKey = currentPeriodKey(chore.frequency);

  if (completed) {
    if (chore.bounty && !memberId) return new Response('Select who completed this bounty', { status: 400 });
    const selectedMember = memberId
      ? await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.id, memberId), eq(householdMembers.familyId, familyId)) })
      : null;
    if (chore.bounty && !selectedMember) return new Response('Invalid household member', { status: 400 });
    const claim = await db.query.choreClaims.findFirst({ where: and(eq(choreClaims.familyId, familyId), eq(choreClaims.choreId, choreId)) });
    const signedInMember = locals.session?.user?.id
      ? await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.familyId, familyId), eq(householdMembers.userId, locals.session.user.id)) })
      : null;
    const assignedMemberId = chore.bounty
      ? selectedMember!.id
      : signedInMember?.id ?? claim?.memberId ?? chore.memberId;
    const newCompletion = await db
      .insert(choreCompletions)
      .values({ familyId, choreId, periodKey, completedAt: new Date(), memberId: assignedMemberId })
      .onConflictDoNothing()
      .returning({ choreId: choreCompletions.choreId });
    if (newCompletion.length) {
      const approvedBid = chore.rewardType === 'allowance' ? await db.query.allowanceBids.findFirst({ where: and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.choreId, choreId), eq(allowanceBids.status, 'approved')) }) : null;
      const rewardMemberId = approvedBid?.memberId ?? assignedMemberId;
      const amountCents = approvedBid?.amountCents ?? chore.rewardCents;
      if (chore.rewardType === 'allowance' && amountCents > 0 && rewardMemberId) {
        await db.insert(allowanceLedger).values({ familyId, kind: 'payout', amountCents, memberId: rewardMemberId, choreId, note: `Allowance: ${chore.title}` });
      }
      if (approvedBid) {
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
