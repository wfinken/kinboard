import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { meals } from '../../../../db/schema';

const MEAL_KEY = /^meal_(\d{4}-\d{2}-\d{2})_(breakfast|lunch|dinner)$/;

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();

  for (const [key, value] of form.entries()) {
    const match = MEAL_KEY.exec(key);
    if (!match) continue;

    const date = match[1];
    const mealType = match[2] as 'breakfast' | 'lunch' | 'dinner';
    const description = String(value).trim();

    const existing = await db.query.meals.findFirst({
      where: and(eq(meals.date, date), eq(meals.mealType, mealType)),
    });

    if (!description) {
      if (existing) await db.delete(meals).where(eq(meals.id, existing.id));
      continue;
    }

    if (existing) {
      await db.update(meals).set({ description }).where(eq(meals.id, existing.id));
    } else {
      await db.insert(meals).values({ date, mealType, description });
    }
  }

  return redirect('/admin/meals');
};
