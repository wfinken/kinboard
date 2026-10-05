import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { allowanceBids, allowanceLedger, chores } from '../../../../../db/schema';
import { requirePermission } from '../../../../../lib/permissions';

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const denied = await requirePermission(locals, 'allowance', 'update');
  if (denied) return denied;
  const familyId = locals.familyId!;
  const bidId = params.id;
  const form = await request.formData();
  if (!['approve', 'reject'].includes(String(form.get('decision')))) return new Response('Choose approve or reject.', { status: 400 });
  const decision = form.get('decision') === 'approve' ? 'approved' : 'rejected';
  const bid = bidId ? await db.query.allowanceBids.findFirst({ where: and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.id, bidId), eq(allowanceBids.status, 'pending')) }) : null;
  if (!bid) return new Response('Pending bid not found.', { status: 404 });
  if (bid && decision === 'approved') {
    const chore = await db.query.chores.findFirst({ where: and(eq(chores.familyId, familyId), eq(chores.id, bid.choreId)) });
    const ledger = await db.query.allowanceLedger.findMany({ where: eq(allowanceLedger.familyId, familyId) });
    const balance = ledger.reduce((sum, row) => sum + (row.kind === 'deposit' ? row.amountCents : -row.amountCents), 0);
    const alreadyApproved = (await db.query.allowanceBids.findMany({ where: and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.status, 'approved')) })).reduce((sum, row) => sum + row.amountCents, 0);
    if (!chore?.allowanceEnabled || bid.amountCents > chore.maxBidCents || bid.amountCents > balance - alreadyApproved) return new Response('This bid cannot be approved. Check the available pool and chore bid limit.', { status: 409 });
    if (chore?.allowanceEnabled && bid.amountCents <= chore.maxBidCents && bid.amountCents <= balance - alreadyApproved) {
      await db.update(allowanceBids).set({ status: 'approved', decidedAt: new Date() }).where(and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.id, bid.id)));
      await db.update(allowanceBids).set({ status: 'rejected', decidedAt: new Date() }).where(and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.choreId, bid.choreId), eq(allowanceBids.status, 'pending')));
      await db.update(chores).set({ memberId: bid.memberId, bounty: false }).where(and(eq(chores.familyId, familyId), eq(chores.id, bid.choreId)));
    }
  } else if (bid) {
    await db.update(allowanceBids).set({ status: decision, decidedAt: new Date() }).where(and(eq(allowanceBids.familyId, familyId), eq(allowanceBids.id, bid.id)));
  }
  return redirect('/admin/allowance');
};
