import type { APIRoute } from 'astro';
import { db } from '../../../db/client';
import { familyInvites } from '../../../db/schema';
import qrcode from 'qrcode-generator';

export const POST: APIRoute = async ({ locals, request }) => {
  const familyId = locals.familyId;
  const userId = locals.session?.user?.id;
  if (!familyId || !userId) return new Response('Family required', { status: 409 });
  const token = crypto.randomUUID();
  await db.insert(familyInvites).values({ token, familyId, createdBy: userId, expiresAt: new Date(Date.now() + 15 * 60_000) });
  const url = new URL(`/join/${token}`, request.url).toString();
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const svg = qr.createSvgTag(6, 4);
  const html = `<!doctype html><html><body style="font-family:system-ui;text-align:center;padding:3rem"><h1>Join my KinBoard family</h1><p>Scan this QR code or open the link on your phone. It expires in 15 minutes.</p>${svg}<p><a href="${url}">${url}</a></p><a href="/admin/family">Back to family settings</a></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
