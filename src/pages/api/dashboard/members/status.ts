import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { householdMembers, memberStatuses } from '../../../../db/schema';

const ALLOWED = ['On my way home', 'At practice', 'Working late', 'Available'] as const;
export const POST: APIRoute = async ({ request }) => {
  const { memberId, status } = await request.json().catch(() => ({})) as { memberId?: string; status?: string };
  if (!memberId || !ALLOWED.includes(status as typeof ALLOWED[number])) return new Response('Invalid status', { status: 400 });
  const member = await db.query.householdMembers.findFirst({ where: eq(householdMembers.id, memberId) });
  if (!member) return new Response('Member not found', { status: 404 });
  await db.insert(memberStatuses).values({ memberId, status: status! }).onConflictDoUpdate({ target: memberStatuses.memberId, set: { status: status!, updatedAt: new Date() } });
  return new Response(null, { status: 204 });
};
