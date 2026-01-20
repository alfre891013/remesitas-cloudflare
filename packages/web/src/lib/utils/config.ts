import { browser } from '$app/environment';

// Production API URL
const PRODUCTION_API_URL = 'https://remesitas-api.alfre891013.workers.dev/api';

// Determine API URL based on environment
export function getApiBaseUrl(): string {
  if (!browser) return '/api';

  // In production (pages.dev), use the full API URL
  if (window.location.hostname.includes('pages.dev') ||
      window.location.hostname.includes('remesitas-web')) {
    return PRODUCTION_API_URL;
  }

  // In development, use relative path (proxied by Vite)
  return '/api';
}
