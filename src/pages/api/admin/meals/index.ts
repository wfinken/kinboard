import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { meals } from '../../../../db/schema';

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = new Set(['breakfast', 'lunch', 'dinner']);

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  const familyId = locals.familyId!;
  const deleteId = form.get('deleteId');

  if (typeof deleteId === 'string' && deleteId) {
    await db.delete(meals).where(and(eq(meals.id, deleteId), eq(meals.familyId, familyId)));
    return redirect('/admin/meals');
  }

  const date = String(form.get('date') ?? '');
  const mealType = String(form.get('mealType') ?? '');
  const description = String(form.get('description') ?? '').trim();
  if (!VALID_DATE.test(date) || !VALID_TYPES.has(mealType) || !description || description.length > 240) {
    return redirect('/admin/meals');
  }

  const normalizedType = mealType as 'breakfast' | 'lunch' | 'dinner';
  const existing = await db.query.meals.findFirst({
    where: and(eq(meals.familyId, familyId), eq(meals.date, date), eq(meals.mealType, normalizedType)),
  });

  if (existing) {
    await db.update(meals).set({ description }).where(and(eq(meals.id, existing.id), eq(meals.familyId, familyId)));
  } else {
    await db.insert(meals).values({ familyId, date, mealType: normalizedType, description });
  }

  return redirect('/admin/meals');
};
