/// <reference lib="webworker" />
/// <reference lib="esnext" />
declare let self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

// Cache configuration
const CACHE_VERSION = version;
const STATIC_CACHE = `remesitas-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `remesitas-runtime-${CACHE_VERSION}`;
const API_CACHE = `remesitas-api-${CACHE_VERSION}`;

// Static files to cache on install
const STATIC_FILES = [...build, ...files];

// API endpoints that can be cached (read-only endpoints)
const CACHEABLE_API_PATHS = [
  '/api/tasas',
  '/api/geografia/provincias',
  '/api/mensajes/asuntos',
  '/api/publico/calcular-entrega',
];

// API cache TTL in milliseconds (5 minutes for rates, longer for static data)
const API_CACHE_TTL: Record<string, number> = {
  '/api/tasas': 5 * 60 * 1000,           // 5 minutes
  '/api/geografia': 24 * 60 * 60 * 1000,  // 24 hours
  '/api/mensajes/asuntos': 60 * 60 * 1000, // 1 hour
  default: 10 * 60 * 1000,                // 10 minutes default
};

// ============ Install Event ============
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      // Cache static files in parallel, resilient to individual failures
      const results = await Promise.allSettled(
        STATIC_FILES.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(url, response);
              return { url, status: 'cached' };
            }
            return { url, status: 'failed', reason: response.status };
          } catch (error) {
            return { url, status: 'failed', reason: String(error) };
          }
        })
      );

      const cached = results.filter((r) => r.status === 'fulfilled').length;
      console.log(`[SW] Cached ${cached}/${STATIC_FILES.length} static files`);

      // Skip waiting to activate immediately
      await self.skipWaiting();
    })()
  );
});

// ============ Activate Event ============
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(
        (name) =>
          name.startsWith('remesitas-') &&
          !name.includes(CACHE_VERSION)
      );

      await Promise.all(oldCaches.map((name) => caches.delete(name)));
      console.log(`[SW] Deleted ${oldCaches.length} old caches`);

      // Take control of all clients immediately
      await self.clients.claim();
      console.log('[SW] Service worker activated');
    })()
  );
});

// ============ Fetch Event ============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle different request types
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request, url));
  } else if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(handleStaticRequest(request));
  }
});

// ============ API Request Handler (Network-First with Cache Fallback) ============
async function handleApiRequest(request: Request, url: URL): Promise<Response> {
  const isCacheable = CACHEABLE_API_PATHS.some((path) =>
    url.pathname.startsWith(path)
  );

  if (!isCacheable) {
    // Non-cacheable API requests - network only
    try {
      return await fetch(request);
    } catch (error) {
      return createOfflineApiResponse();
    }
  }

  // Network-first strategy for cacheable APIs
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clone and cache the response
      const cache = await caches.open(API_CACHE);
      const responseToCache = networkResponse.clone();

      // Add timestamp header for TTL checking
      const headers = new Headers(responseToCache.headers);
      headers.set('X-Cached-At', Date.now().toString());

      const cachedResponse = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });

      cache.put(request, cachedResponse);
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Check if cache is still valid
      const cachedAt = cachedResponse.headers.get('X-Cached-At');
      const ttl = getTTLForPath(url.pathname);

      if (cachedAt && Date.now() - parseInt(cachedAt) < ttl) {
        // Add header to indicate cached response
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-From-Cache', 'true');
        headers.set('X-Cache-Age', (Date.now() - parseInt(cachedAt)).toString());

        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers,
        });
      }
    }

    return createOfflineApiResponse();
  }
}

// ============ Navigation Request Handler ============
async function handleNavigationRequest(request: Request): Promise<Response> {
  try {
    // Try network first for fresh content
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache the navigation response
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Try app shell (root index)
    const appShell = await caches.match('/');
    if (appShell) {
      return appShell;
    }

    // Return offline page
    return createOfflinePage();
  }
}

// ============ Static Request Handler (Cache-First) ============
async function handleStaticRequest(request: Request): Promise<Response> {
  // Check static cache first
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Update cache in background (stale-while-revalidate)
    updateCacheInBackground(request);
    return cachedResponse;
  }

  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    return new Response('Not Found', { status: 404 });
  }
}

// ============ Background Cache Update ============
async function updateCacheInBackground(request: Request): Promise<void> {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, networkResponse);
    }
  } catch {
    // Silently fail background updates
  }
}

// ============ Helper Functions ============
function getTTLForPath(pathname: string): number {
  for (const [path, ttl] of Object.entries(API_CACHE_TTL)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      return ttl;
    }
  }
  return API_CACHE_TTL.default;
}

function createOfflineApiResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Sin conexion a internet. Intenta de nuevo cuando tengas conexion.',
      offline: true,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
        'X-Offline': 'true',
      },
    }
  );
}

function createOfflinePage(): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sin Conexion - Remesitas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
      padding: 24px;
    }
    .container {
      text-align: center;
      max-width: 400px;
      background: white;
      padding: 48px 32px;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }
    .icon-wrapper {
      width: 96px;
      height: 96px;
      margin: 0 auto 24px;
      background: #fef3c7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-wrapper svg {
      width: 48px;
      height: 48px;
      color: #d97706;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 12px;
    }
    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #2563eb;
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }
    .btn:active {
      transform: translateY(0);
    }
    .btn svg {
      width: 20px;
      height: 20px;
    }
    .hint {
      margin-top: 24px;
      font-size: 14px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon-wrapper">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
      </svg>
    </div>
    <h1>Sin Conexion</h1>
    <p>Parece que no hay conexion a internet. Verifica tu conexion WiFi o datos moviles e intenta de nuevo.</p>
    <button class="btn" onclick="window.location.reload()">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Reintentar
    </button>
    <p class="hint">Algunas funciones pueden estar disponibles sin conexion.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Offline': 'true',
    },
  });
}

// ============ Background Sync ============
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-remesas') {
    event.waitUntil(handleRemesasSync());
  }

  if (event.tag === 'sync-contacto') {
    event.waitUntil(handleContactoSync());
  }
});

async function handleRemesasSync(): Promise<void> {
  // Notify all clients that sync has started
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_STATUS',
      tag: 'remesas',
      status: 'started',
    });
  });

  // The actual sync will be handled by IndexedDB in the client
  // Service worker just triggers the notification
}

async function handleContactoSync(): Promise<void> {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_STATUS',
      tag: 'contacto',
      status: 'started',
    });
  });
}

// ============ Push Notifications ============
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Push received without data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push notification received:', data);

    const options: NotificationOptions = {
      body: data.body || data.message || '',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/badge-72.png',
      tag: data.tag || `remesitas-${Date.now()}`,
      data: data.data || {},
      renotify: data.renotify !== false,
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.vibrate || [200, 100, 200],
      actions: data.actions || [],
    };

    // Set image if provided (for rich notifications)
    if (data.image) {
      options.image = data.image;
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'Remesitas', options)
    );
  } catch (error) {
    console.error('[SW] Error processing push notification:', error);

    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('Remesitas', {
        body: 'Tienes una nueva notificacion',
        icon: '/icon-192.png',
      })
    );
  }
});

// ============ Notification Click Handler ============
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Determine target URL based on notification data
  if (data.url) {
    targetUrl = data.url;
  } else if (data.remesaCodigo) {
    targetUrl = `/rastrear?codigo=${data.remesaCodigo}`;
  } else if (data.remesaId) {
    targetUrl = `/admin/remesas?id=${data.remesaId}`;
  } else if (data.action === 'track') {
    targetUrl = '/rastrear';
  }

  // Handle action buttons
  if (event.action) {
    switch (event.action) {
      case 'view':
        targetUrl = data.viewUrl || targetUrl;
        break;
      case 'dismiss':
        return;
      default:
        break;
    }
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Try to find an existing window to focus
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          client.postMessage({
            type: 'NAVIGATE',
            url: targetUrl,
          });
          return;
        }
      }

      // No existing window, open a new one
      await self.clients.openWindow(targetUrl);
    })()
  );
});

// ============ Message Handler ============
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  console.log('[SW] Message received:', type);

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({
        version: CACHE_VERSION,
        caches: [STATIC_CACHE, RUNTIME_CACHE, API_CACHE],
      });
      break;

    case 'CLEAR_ALL_CACHES':
      event.waitUntil(
        (async () => {
          const names = await caches.keys();
          await Promise.all(names.map((name) => caches.delete(name)));
          event.ports[0]?.postMessage({ success: true });
        })()
      );
      break;

    case 'CLEAR_API_CACHE':
      event.waitUntil(
        (async () => {
          await caches.delete(API_CACHE);
          event.ports[0]?.postMessage({ success: true });
        })()
      );
      break;

    case 'PRECACHE_URL':
      if (data?.url) {
        event.waitUntil(
          (async () => {
            try {
              const cache = await caches.open(RUNTIME_CACHE);
              await cache.add(data.url);
              event.ports[0]?.postMessage({ success: true });
            } catch (error) {
              event.ports[0]?.postMessage({ success: false, error: String(error) });
            }
          })()
        );
      }
      break;

    default:
      console.warn('[SW] Unknown message type:', type);
  }
});

// Export empty to make TypeScript happy
export {};
