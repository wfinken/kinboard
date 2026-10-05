import type { APIRoute } from 'astro';
import { Auth } from '@auth/core';
import { authConfig } from '../../../lib/auth';

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
  return Auth(request, authConfig);
};
