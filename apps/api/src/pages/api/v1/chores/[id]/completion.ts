import type { APIRoute } from 'astro';
import { POST as toggle } from '../../../dashboard/chores/[id]/toggle';
import { hasPermission } from '../../../../../lib/permissions';
import { apiError } from '../../../../../lib/api';
export const PUT: APIRoute = async (context) => {
  const { locals, request } = context;
  if (!await hasPermission(locals.familyId!, locals.session!.user!.id, 'chores', 'update')) return apiError(403, 'forbidden', 'You cannot update chores.');
  const value: unknown = await request.clone().json().catch(() => null);
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  if (!input || typeof input.completed !== 'boolean' || (input.memberId !== undefined && typeof input.memberId !== 'string')) return apiError(400, 'invalid_input', 'Provide completed as a boolean and an optional memberId.');
  const response = await toggle(context);
  return response.ok ? response : apiError(response.status, 'chore_update_failed', await response.text());
};
