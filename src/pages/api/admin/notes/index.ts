import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { stickyNotes } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const drawing = String(form.get('drawing') ?? '').trim();
  const media = form.get('media');
  let mediaUrl: string | null = drawing || null;
  let mediaType: 'image' | 'audio' | 'drawing' | null = drawing ? 'drawing' : null;
  if (!mediaUrl && media instanceof File && media.size > 0 && media.size <= 2_000_000 && /^(image\/|audio\/)/.test(media.type)) {
    mediaUrl = `data:${media.type};base64,${Buffer.from(await media.arrayBuffer()).toString('base64')}`;
    mediaType = media.type.startsWith('audio/') ? 'audio' : 'image';
  }
  const content = String(form.get('content') ?? '').trim();
  const color = String(form.get('color') ?? '#facc15');
  const authorName = String(form.get('authorName') ?? '').trim() || null;

  if (content) {
    await db.insert(stickyNotes).values({ content, color, authorName, mediaUrl, mediaType });
  }

  return redirect(String(form.get('returnTo') ?? '/admin/notes'));
};
