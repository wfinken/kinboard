import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { chores, choreCompletions } from '../../../../../db/schema';
import { currentPeriodKey } from '../../../../../lib/chores';

export const POST: APIRoute = async ({ params, request }) => {
  const choreId = params.id;
  if (!choreId) return new Response('Missing chore id', { status: 400 });

  const chore = await db.query.chores.findFirst({ where: eq(chores.id, choreId) });
  if (!chore) return new Response('Chore not found', { status: 404 });

  const { completed } = (await request.json()) as { completed: boolean };
  const periodKey = currentPeriodKey(chore.frequency);

  if (completed) {
    await db
      .insert(choreCompletions)
      .values({ choreId, periodKey, completedAt: new Date() })
      .onConflictDoNothing();
  } else {
    await db
      .delete(choreCompletions)
      .where(and(eq(choreCompletions.choreId, choreId), eq(choreCompletions.periodKey, periodKey)));
  }

  return new Response(null, { status: 204 });
};
