import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // In development, remove any CSP to allow Vite HMR with eval
  if (dev) {
    response.headers.delete('Content-Security-Policy');
  }

  return response;
};
