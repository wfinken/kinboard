import type { APIRoute } from 'astro';
import type { Note } from '@kinboard/contracts';
import { db } from '../../../../db/client';
import { stickyNotes } from '../../../../db/schema';
import { hasPermission } from '../../../../lib/permissions';
import { apiError, json } from '../../../../lib/api';
export const POST: APIRoute = async ({ request, locals }) => {
  const familyId = locals.familyId!, user = locals.session!.user!;
  if (!await hasPermission(familyId, user.id, 'notes', 'create')) return apiError(403, 'forbidden', 'You cannot create notes.');
  const value: unknown = await request.json().catch(() => null);
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  if (!input || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 2000 || (input.color !== undefined && (typeof input.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.color)))) return apiError(400, 'invalid_input', 'Provide a note of 1–2000 characters and an optional six-digit hex color.');
  const [note] = await db.insert(stickyNotes).values({ familyId, content: input.content.trim(), color: input.color ?? '#facc15', authorName: user.name ?? null }).returning();
  return json({ id: note.id, content: note.content, color: note.color, authorName: note.authorName, createdAt: note.createdAt.toISOString() } satisfies Note, 201);
};
