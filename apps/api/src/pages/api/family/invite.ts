import type { APIRoute } from 'astro';
import { db } from '../../../db/client';
import { familyInvites } from '../../../db/schema';
import { json } from '../../../lib/api';
import { requirePermission } from '../../../lib/permissions';

const INVITE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function createInviteCode() {
  // Reject values outside the largest evenly divisible range to avoid bias.
  const ceiling = Math.floor(256 / INVITE_ALPHABET.length) * INVITE_ALPHABET.length;
  let code = '';
  while (code.length < 10) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte >= ceiling) continue;
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
      if (code.length === 10) break;
    }
  }
  return code;
}

export const POST: APIRoute = async ({ locals, request }) => {
  const denied = await requirePermission(locals, 'family', 'create');
  if (denied) return denied;
  const familyId = locals.familyId;
  const userId = locals.session?.user?.id;
  if (!familyId || !userId) return new Response('Family required', { status: 409 });
  const token = createInviteCode();
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await db.insert(familyInvites).values({ token, familyId, createdBy: userId, expiresAt });
  const appOrigin = process.env.KINBOARD_APP_ORIGIN || request.url;
  const url = new URL(`/join/${token}`, appOrigin);
  if (url.hostname === 'app.kinboard.xyz' || url.hostname === 'kinboard.wfinken.workers.dev' || url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    url.hostname = `${token}.invite.kinboard.xyz`;
    url.pathname = '/';
  }
  const inviteUrl = url.toString();
  const directUrl = new URL(`/join/${token}`, appOrigin).toString();
  return json({ token, url: inviteUrl, directUrl, expiresAt: expiresAt.toISOString() }, 201);
};
