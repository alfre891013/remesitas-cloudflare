import { Hono } from 'hono';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { tasasCambio, configuracion } from '../db/schema';
import { TasasService } from '../services/tasas.service';
import { tasaCambioUpdateSchema, tasasBulkUpdateSchema } from '@remesitas/shared';

export const tasasRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============ Public Routes ============

// GET /api/tasas - Get all current rates (public)
tasasRoutes.get('/', async (c) => {
  const db = c.get('db');

  const rates = await db
    .select()
    .from(tasasCambio)
    .where(eq(tasasCambio.activa, true))
    .orderBy(tasasCambio.moneda_destino);

  return c.json({
    success: true,
    data: rates.map((r) => ({
      moneda_origen: r.moneda_origen,
      moneda_destino: r.moneda_destino,
      tasa: r.tasa,
      fecha_actualizacion: r.fecha_actualizacion,
    })),
  });
});

// GET /api/tasas/:moneda - Get specific rate (USD to moneda)
tasasRoutes.get('/:moneda', async (c) => {
  const db = c.get('db');
  const moneda = c.req.param('moneda').toUpperCase();

  const [rate] = await db
    .select()
    .from(tasasCambio)
    .where(and(eq(tasasCambio.moneda_destino, moneda), eq(tasasCambio.activa, true)))
    .limit(1);

  if (!rate) {
    return c.json(
      { success: false, error: 'Not Found', message: `Tasa para ${moneda} no encontrada` },
      404
    );
  }

  return c.json({
    success: true,
    data: {
      moneda_origen: rate.moneda_origen,
      moneda_destino: rate.moneda_destino,
      tasa: rate.tasa,
      fecha_actualizacion: rate.fecha_actualizacion,
    },
  });
});

// ============ Admin Routes ============

// GET /api/tasas/admin/all - Get all rates with admin details
tasasRoutes.get('/admin/all', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');

  const rates = await db.select().from(tasasCambio).orderBy(tasasCambio.moneda_destino);

  // Get global auto-update setting
  const [globalConfig] = await db
    .select()
    .from(configuracion)
    .where(eq(configuracion.clave, 'auto_update_tasas'))
    .limit(1);

  return c.json({
    success: true,
    data: {
      auto_update_global: globalConfig?.valor === 'true',
      rates,
    },
  });
});

// PUT /api/tasas/admin/:moneda - Update specific rate
tasasRoutes.put(
  '/admin/:moneda',
  authMiddleware,
  adminMiddleware,
  validateBody(tasaCambioUpdateSchema),
  async (c) => {
    const db = c.get('db');
    const moneda = c.req.param('moneda').toUpperCase();
    const body = await c.req.json();

    const [current] = await db
      .select()
      .from(tasasCambio)
      .where(eq(tasasCambio.moneda_destino, moneda))
      .limit(1);

    if (!current) {
      return c.json(
        { success: false, error: 'Not Found', message: `Tasa para ${moneda} no encontrada` },
        404
      );
    }

    const updates: Record<string, any> = {
      fecha_actualizacion: new Date().toISOString(),
    };

    if (body.tasa !== undefined) {
      updates.tasa = body.tasa;
    }

    if (body.activa !== undefined) {
      updates.activa = body.activa;
    }

    await db.update(tasasCambio).set(updates).where(eq(tasasCambio.moneda_destino, moneda));

    return c.json({
      success: true,
      message: `Tasa de ${moneda} actualizada correctamente`,
    });
  }
);

// PUT /api/tasas/admin/bulk - Bulk update settings
tasasRoutes.put(
  '/admin/bulk',
  authMiddleware,
  adminMiddleware,
  validateBody(tasasBulkUpdateSchema),
  async (c) => {
    const db = c.get('db');
    const body = await c.req.json();

    // Update global auto-update setting
    if (body.auto_update_global !== undefined) {
      const [existing] = await db
        .select()
        .from(configuracion)
        .where(eq(configuracion.clave, 'auto_update_tasas'))
        .limit(1);

      if (existing) {
        await db
          .update(configuracion)
          .set({ valor: body.auto_update_global ? 'true' : 'false' })
          .where(eq(configuracion.clave, 'auto_update_tasas'));
      } else {
        await db.insert(configuracion).values({
          clave: 'auto_update_tasas',
          valor: body.auto_update_global ? 'true' : 'false',
          descripcion: 'Activar actualizacion automatica de tasas',
        });
      }
    }

    // Update individual rates
    if (body.tasas && Array.isArray(body.tasas)) {
      for (const rate of body.tasas) {
        const [current] = await db
          .select()
          .from(tasasCambio)
          .where(eq(tasasCambio.moneda_destino, rate.moneda_destino))
          .limit(1);

        if (!current) continue;

        const updates: Record<string, any> = {
          fecha_actualizacion: new Date().toISOString(),
        };

        if (rate.tasa !== undefined) {
          updates.tasa = rate.tasa;
        }

        if (rate.activa !== undefined) {
          updates.activa = rate.activa;
        }

        await db
          .update(tasasCambio)
          .set(updates)
          .where(eq(tasasCambio.moneda_destino, rate.moneda_destino));
      }
    }

    return c.json({
      success: true,
      message: 'Configuración de tasas actualizada correctamente',
    });
  }
);

// POST /api/tasas/admin/fetch - Manually trigger rate fetch from external sources
tasasRoutes.post('/admin/fetch', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');

  const tasasService = new TasasService(db);
  const result = await tasasService.actualizarDesdeExterno();

  if (!result.success) {
    return c.json(
      {
        success: false,
        error: 'Fetch Failed',
        message: result.error || 'Error al obtener tasas externas',
      },
      500
    );
  }

  return c.json({
    success: true,
    message: 'Tasas actualizadas desde fuente externa',
    data: {
      source: result.source,
      updated: result.updated,
    },
  });
});

// GET /api/tasas/admin/external - Preview external rates without saving
tasasRoutes.get('/admin/external', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');

  const tasasService = new TasasService(db);
  const result = await tasasService.obtenerTasasExternas();

  if (!result.success) {
    return c.json(
      {
        success: false,
        error: 'Fetch Failed',
        message: result.error || 'Error al obtener tasas externas',
      },
      500
    );
  }

  return c.json({
    success: true,
    data: {
      source: result.source,
      rates: result.rates,
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/tasas/admin/historial - Get rate update history from configuration
tasasRoutes.get('/admin/historial', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const moneda = query.moneda?.toUpperCase();
  const limit = parseInt(query.limit || '50');

  // Get all rates with their update timestamps
  const whereConditions = [];

  if (moneda) {
    whereConditions.push(eq(tasasCambio.moneda_destino, moneda));
  }

  if (query.fecha_inicio) {
    whereConditions.push(gte(tasasCambio.fecha_actualizacion, query.fecha_inicio));
  }

  if (query.fecha_fin) {
    whereConditions.push(lte(tasasCambio.fecha_actualizacion, query.fecha_fin));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const history = await db
    .select()
    .from(tasasCambio)
    .where(where)
    .orderBy(desc(tasasCambio.fecha_actualizacion))
    .limit(limit);

  return c.json({
    success: true,
    data: history,
  });
});
