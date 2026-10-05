import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { stickyNotes } from '../../../../db/schema';
import { requirePermission } from '../../../../lib/permissions';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const denied = await requirePermission(locals, 'notes', 'create');
  if (denied) return denied;
  const form = await request.formData();
  const drawing = String(form.get('drawing') ?? '').trim();
  const media = form.get('media');
  if (media instanceof File && media.size > 2_000_000) return new Response('Choose media smaller than 2 MB.', { status: 400 });
  let mediaUrl: string | null = drawing || null;
  let mediaType: 'image' | 'audio' | 'drawing' | null = drawing ? 'drawing' : null;
  if (!mediaUrl && media instanceof File && media.size > 0 && media.size <= 2_000_000 && /^(image\/|audio\/)/.test(media.type)) {
    mediaUrl = `data:${media.type};base64,${Buffer.from(await media.arrayBuffer()).toString('base64')}`;
    mediaType = media.type.startsWith('audio/') ? 'audio' : 'image';
  }
  const content = String(form.get('content') ?? '').trim();
  const color = String(form.get('color') ?? '#facc15');
  const authorName = String(form.get('authorName') ?? '').trim() || null;

  if (!content || content.length > 2000 || !/^#[0-9a-f]{6}$/i.test(color)) return new Response('Enter a note of 1–2000 characters and a valid color.', { status: 400 });
  if (content) {
    await db.insert(stickyNotes).values({ familyId: locals.familyId!, content, color, authorName, mediaUrl, mediaType });
  }

  return redirect(String(form.get('returnTo') ?? '/admin/notes'));
};
