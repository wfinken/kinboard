import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { allowanceLedger } from '../../../../db/schema';
import { requirePermission } from '../../../../lib/permissions';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const denied = await requirePermission(locals, 'allowance', 'create');
  if (denied) return denied;
  const form = await request.formData();
  const amountCents = Math.round(Number(form.get('amount')) * 100);
  const note = String(form.get('note') ?? '').trim().slice(0, 160);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 1_000_000) return new Response('Enter an amount from $0.01 to $10,000.', { status: 400 });
  if (Number.isFinite(amountCents) && amountCents > 0 && amountCents <= 1_000_000) {
    await db.insert(allowanceLedger).values({ familyId: locals.familyId!, kind: 'deposit', amountCents, note: note || 'Parent added funds' });
  }
  return redirect('/admin/allowance');
};
