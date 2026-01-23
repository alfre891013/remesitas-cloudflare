import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';
import type { Env, Variables } from './types';

// Import routes
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { remesasRoutes } from './routes/remesas';
import { publicoRoutes } from './routes/publico';
import { repartidorRoutes } from './routes/repartidor';
import { revendedorRoutes } from './routes/revendedor';
import { reportesRoutes } from './routes/reportes';
import { tasasRoutes } from './routes/tasas';
import { geografiaRoutes } from './routes/geografia';
import { contactosRoutes } from './routes/contactos';
import { disputasRoutes } from './routes/disputas';
import { facturasRoutes } from './routes/facturas';
import mensajesRoutes from './routes/mensajes';
import ubicacionRoutes from './routes/ubicacion';
import { notificacionesRoutes } from './routes/notificaciones';
import { analyticsRoutes } from './routes/analytics';

// Import scheduled handler
import { scheduledHandler } from './scheduled';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Production CORS origins
const PRODUCTION_ORIGINS = [
  'https://remesitas.pages.dev',
  'https://remesitas-web.pages.dev',
];
const DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Global middleware
app.use('*', async (c, next) => {
  // Only log in development to avoid performance overhead
  if (c.env.ENVIRONMENT === 'development') {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${c.req.method} ${c.req.path} - ${ms}ms`);
  } else {
    await next();
  }
});

// Enhanced security headers
app.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    xXssProtection: '1; mode=block',
  })
);

// Environment-aware CORS configuration
app.use('*', async (c, next) => {
  const isDevelopment = c.env.ENVIRONMENT === 'development';
  const allowedOrigins = isDevelopment
    ? [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS]
    : PRODUCTION_ORIGINS;

  const corsMiddleware = cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  });

  return corsMiddleware(c, next);
});

// Request size limit middleware (1MB max)
app.use('*', async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength, 10) > 1048576) {
    return c.json(
      { success: false, error: 'Payload Too Large', message: 'Request body exceeds 1MB limit' },
      413
    );
  }
  await next();
});

// Database middleware - inject Drizzle instance
app.use('*', async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set('db', db);
  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/remesas', remesasRoutes);
app.route('/api/publico', publicoRoutes);
app.route('/api/repartidor', repartidorRoutes);
app.route('/api/revendedor', revendedorRoutes);
app.route('/api/reportes', reportesRoutes);
app.route('/api/tasas', tasasRoutes);
app.route('/api/geografia', geografiaRoutes);
app.route('/api/contactos', contactosRoutes);
app.route('/api/disputas', disputasRoutes);
app.route('/api/facturas', facturasRoutes);
app.route('/api/mensajes', mensajesRoutes);
app.route('/api/ubicacion', ubicacionRoutes);
app.route('/api/notificaciones', notificacionesRoutes);
app.route('/api/analytics', analyticsRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not Found',
      message: `Route ${c.req.path} not found`,
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  // Only log errors in development
  if (c.env.ENVIRONMENT === 'development') {
    console.error('API Error:', err);
  }

  // Never expose internal error details in production
  return c.json(
    {
      success: false,
      error: 'Internal Server Error',
      message:
        c.env.ENVIRONMENT === 'development'
          ? err.message
          : 'An unexpected error occurred',
    },
    500
  );
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
