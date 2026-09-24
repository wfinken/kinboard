import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { stickyNotes } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const content = String(form.get('content') ?? '').trim();
  const color = String(form.get('color') ?? '#facc15');
  const authorName = String(form.get('authorName') ?? '').trim() || null;

  if (content) {
    await db.insert(stickyNotes).values({ content, color, authorName });
  }

  return redirect('/admin/notes');
};
