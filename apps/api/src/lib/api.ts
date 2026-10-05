import type { ApiError } from '@kinboard/contracts';
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
});
export const apiError = (status: number, code: string, message: string) => json({ error: { code, message } } satisfies ApiError, status);
