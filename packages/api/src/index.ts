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

// Import scheduled handler
import { scheduledHandler } from './scheduled';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://remesitas.pages.dev'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })
);

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
  console.error('API Error:', err);
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
