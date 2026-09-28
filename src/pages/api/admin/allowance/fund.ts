import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { allowanceLedger } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  const amountCents = Math.round(Number(form.get('amount')) * 100);
  const note = String(form.get('note') ?? '').trim().slice(0, 160);
  if (Number.isFinite(amountCents) && amountCents > 0 && amountCents <= 1_000_000) {
    await db.insert(allowanceLedger).values({ familyId: locals.familyId!, kind: 'deposit', amountCents, note: note || 'Parent added funds' });
  }
  return redirect('/admin/allowance');
};
