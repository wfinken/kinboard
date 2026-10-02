import type { APIRoute } from 'astro';
import { db } from '../../../db/client';
import { familyInvites } from '../../../db/schema';
import qrcode from 'qrcode-generator';
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
  await db.insert(familyInvites).values({ token, familyId, createdBy: userId, expiresAt: new Date(Date.now() + 15 * 60_000) });
  const url = new URL(`/join/${token}`, request.url);
  if (url.hostname === 'app.kinboard.xyz' || url.hostname === 'kinboard.wfinken.workers.dev') {
    url.hostname = `${token}.invite.kinboard.xyz`;
    url.pathname = '/';
  }
  const inviteUrl = url.toString();
  const qr = qrcode(0, 'M');
  qr.addData(inviteUrl);
  qr.make();
  const svg = qr.createSvgTag(6, 4);
  const directUrl = new URL(`/join/${token}`, request.url).toString();
  const html = `<!doctype html><html><body style="font-family:system-ui;text-align:center;padding:3rem"><h1>Join my KinBoard family</h1><p>Scan this QR code or open the link on your phone. It expires in 15 minutes.</p>${svg}<p><a href="${inviteUrl}">${inviteUrl}</a></p><p>If the invite link does not open, use <a href="${directUrl}">the direct KinBoard invite</a>.</p><a href="/admin/family">Back to family settings</a></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
