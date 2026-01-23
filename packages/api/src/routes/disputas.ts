/**
 * Disputes API Routes
 * Manages dispute/claim resolution
 */

import { Hono } from 'hono';
import { eq, and, desc, sql, gte, lte, or } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  disputas,
  tiposDisputa,
  comentariosDisputa,
  remesas,
  usuarios,
} from '../db/schema';
import { z } from 'zod';
import {
  DISPUTA_ESTADOS,
  DISPUTA_PRIORIDADES,
  DISPUTA_RESOLUCIONES,
} from '@remesitas/shared';

export const disputasRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth to all routes
disputasRoutes.use('*', authMiddleware);

// ============ Validation Schemas ============

const disputaCreateSchema = z.object({
  remesa_id: z.number().positive(),
  tipo_disputa_id: z.number().positive(),
  descripcion: z.string().min(10).max(2000),
  prioridad: z
    .enum(['baja', 'normal', 'alta', 'urgente'])
    .optional()
    .default('normal'),
});

const disputaUpdateSchema = z.object({
  estado: z
    .enum([
      'abierta',
      'en_investigacion',
      'pendiente_cliente',
      'resuelta',
      'rechazada',
      'escalada',
    ])
    .optional(),
  prioridad: z.enum(['baja', 'normal', 'alta', 'urgente']).optional(),
  asignado_a: z.number().positive().optional().nullable(),
  resolucion: z.string().max(2000).optional(),
  tipo_resolucion: z
    .enum([
      'reembolso_total',
      'reembolso_parcial',
      'reenvio',
      'compensacion',
      'sin_accion',
      'otro',
    ])
    .optional(),
  monto_reembolso: z.number().min(0).optional(),
});

const comentarioCreateSchema = z.object({
  contenido: z.string().min(1).max(2000),
  es_interno: z.boolean().optional().default(false),
});

// ============ Dispute Types ============

// GET /api/disputas/tipos - List dispute types
disputasRoutes.get('/tipos', async (c) => {
  const db = c.get('db');

  const result = await db
    .select()
    .from(tiposDisputa)
    .orderBy(tiposDisputa.id);

  return c.json({
    success: true,
    data: result,
  });
});

// ============ Disputes CRUD ============

// GET /api/disputas - List disputes
disputasRoutes.get('/', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query();

  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [];

  // Non-admin users can only see their own disputes
  if (auth.rol !== 'admin') {
    conditions.push(eq(disputas.reportado_por, auth.userId));
  }

  // Filters
  if (query.estado) {
    conditions.push(eq(disputas.estado, query.estado as any));
  }
  if (query.prioridad) {
    conditions.push(eq(disputas.prioridad, query.prioridad as any));
  }
  if (query.asignado_a) {
    conditions.push(eq(disputas.asignado_a, parseInt(query.asignado_a, 10)));
  }
  if (query.fecha_inicio) {
    conditions.push(gte(disputas.fecha_creacion, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    conditions.push(lte(disputas.fecha_creacion, query.fecha_fin));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Execute queries
  const [items, countResult] = await Promise.all([
    db
      .select({
        id: disputas.id,
        numero: disputas.numero,
        remesa_id: disputas.remesa_id,
        tipo_disputa_id: disputas.tipo_disputa_id,
        estado: disputas.estado,
        prioridad: disputas.prioridad,
        descripcion: disputas.descripcion,
        fecha_creacion: disputas.fecha_creacion,
        fecha_limite: disputas.fecha_limite,
        fecha_resolucion: disputas.fecha_resolucion,
        asignado_a: disputas.asignado_a,
        reportado_por: disputas.reportado_por,
      })
      .from(disputas)
      .where(where)
      .orderBy(
        // Order by priority (urgente first) then by date
        sql`CASE prioridad WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END`,
        desc(disputas.fecha_creacion)
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(disputas)
      .where(where),
  ]);

  // Enrich with related data
  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const [tipo, remesa, asignado, reportador] = await Promise.all([
        db
          .select({ nombre: tiposDisputa.nombre })
          .from(tiposDisputa)
          .where(eq(tiposDisputa.id, item.tipo_disputa_id))
          .limit(1),
        db
          .select({ codigo: remesas.codigo })
          .from(remesas)
          .where(eq(remesas.id, item.remesa_id))
          .limit(1),
        item.asignado_a
          ? db
              .select({ nombre: usuarios.nombre })
              .from(usuarios)
              .where(eq(usuarios.id, item.asignado_a))
              .limit(1)
          : Promise.resolve([]),
        db
          .select({ nombre: usuarios.nombre })
          .from(usuarios)
          .where(eq(usuarios.id, item.reportado_por))
          .limit(1),
      ]);

      return {
        ...item,
        tipo_nombre: tipo[0]?.nombre || '',
        remesa_codigo: remesa[0]?.codigo || '',
        asignado_nombre: asignado[0]?.nombre || null,
        reportador_nombre: reportador[0]?.nombre || '',
      };
    })
  );

  return c.json({
    success: true,
    data: enrichedItems,
    pagination: {
      page,
      limit,
      total: countResult[0]?.count || 0,
      totalPages: Math.ceil((countResult[0]?.count || 0) / limit),
    },
  });
});

// GET /api/disputas/:id - Get dispute by ID
disputasRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID inválido' },
      400
    );
  }

  const [disputa] = await db
    .select()
    .from(disputas)
    .where(eq(disputas.id, id))
    .limit(1);

  if (!disputa) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Disputa no encontrada' },
      404
    );
  }

  // Check access
  if (auth.rol !== 'admin' && disputa.reportado_por !== auth.userId) {
    return c.json(
      { success: false, error: 'Forbidden', message: 'No autorizado' },
      403
    );
  }

  // Get related data
  const [tipo, remesa, comentarios] = await Promise.all([
    db
      .select()
      .from(tiposDisputa)
      .where(eq(tiposDisputa.id, disputa.tipo_disputa_id))
      .limit(1),
    db.select().from(remesas).where(eq(remesas.id, disputa.remesa_id)).limit(1),
    db
      .select()
      .from(comentariosDisputa)
      .where(eq(comentariosDisputa.disputa_id, id))
      .orderBy(desc(comentariosDisputa.fecha)),
  ]);

  // Enrich comments with user names (filter internal if not admin)
  const filteredComments = auth.rol === 'admin'
    ? comentarios
    : comentarios.filter((c) => !c.es_interno);

  const enrichedComments = await Promise.all(
    filteredComments.map(async (comment) => {
      const [user] = await db
        .select({ nombre: usuarios.nombre })
        .from(usuarios)
        .where(eq(usuarios.id, comment.usuario_id))
        .limit(1);
      return {
        ...comment,
        usuario_nombre: user?.nombre || '',
      };
    })
  );

  return c.json({
    success: true,
    data: {
      ...disputa,
      tipo: tipo[0] || null,
      remesa: remesa[0] || null,
      comentarios: enrichedComments,
    },
  });
});

// POST /api/disputas - Create dispute
disputasRoutes.post('/', validateBody(disputaCreateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  // Verify remesa exists
  const [remesa] = await db
    .select()
    .from(remesas)
    .where(eq(remesas.id, body.remesa_id))
    .limit(1);

  if (!remesa) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Remesa no encontrada' },
      404
    );
  }

  // Verify tipo_disputa exists
  const [tipo] = await db
    .select()
    .from(tiposDisputa)
    .where(eq(tiposDisputa.id, body.tipo_disputa_id))
    .limit(1);

  if (!tipo) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Tipo de disputa no encontrado' },
      404
    );
  }

  // Generate dispute number
  const numero = `DIS-${Date.now().toString(36).toUpperCase()}`;

  // Calculate deadline based on SLA
  const fechaLimite = new Date();
  fechaLimite.setHours(fechaLimite.getHours() + tipo.sla_horas);

  // Create dispute
  const [created] = await db
    .insert(disputas)
    .values({
      numero,
      remesa_id: body.remesa_id,
      tipo_disputa_id: body.tipo_disputa_id,
      reportado_por: auth.userId,
      descripcion: body.descripcion,
      prioridad: body.prioridad || tipo.prioridad_default,
      fecha_limite: fechaLimite.toISOString(),
    })
    .returning();

  // Add initial comment
  await db.insert(comentariosDisputa).values({
    disputa_id: created.id,
    usuario_id: auth.userId,
    tipo: 'sistema',
    contenido: `Disputa creada: ${body.descripcion}`,
    es_interno: false,
  });

  return c.json(
    {
      success: true,
      data: created,
      message: 'Disputa creada correctamente',
    },
    201
  );
});

// PUT /api/disputas/:id - Update dispute (admin only)
disputasRoutes.put('/:id', adminMiddleware, validateBody(disputaUpdateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID inválido' },
      400
    );
  }

  const [existing] = await db
    .select()
    .from(disputas)
    .where(eq(disputas.id, id))
    .limit(1);

  if (!existing) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Disputa no encontrada' },
      404
    );
  }

  // Build update object
  const updateData: any = {
    fecha_ultima_actualizacion: new Date().toISOString(),
  };

  if (body.estado) updateData.estado = body.estado;
  if (body.prioridad) updateData.prioridad = body.prioridad;
  if (body.asignado_a !== undefined) updateData.asignado_a = body.asignado_a;
  if (body.resolucion) updateData.resolucion = body.resolucion;
  if (body.tipo_resolucion) updateData.tipo_resolucion = body.tipo_resolucion;
  if (body.monto_reembolso !== undefined) updateData.monto_reembolso = body.monto_reembolso;

  // If resolving, set resolution date and user
  if (body.estado === 'resuelta' || body.estado === 'rechazada') {
    updateData.fecha_resolucion = new Date().toISOString();
    updateData.resuelto_por = auth.userId;
  }

  const [updated] = await db
    .update(disputas)
    .set(updateData)
    .where(eq(disputas.id, id))
    .returning();

  // Add activity comment for state changes
  if (body.estado && body.estado !== existing.estado) {
    await db.insert(comentariosDisputa).values({
      disputa_id: id,
      usuario_id: auth.userId,
      tipo: 'cambio_estado',
      contenido: `Estado cambiado de "${existing.estado}" a "${body.estado}"`,
      es_interno: true,
    });
  }

  if (body.asignado_a && body.asignado_a !== existing.asignado_a) {
    const [assignee] = await db
      .select({ nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.id, body.asignado_a))
      .limit(1);

    await db.insert(comentariosDisputa).values({
      disputa_id: id,
      usuario_id: auth.userId,
      tipo: 'asignacion',
      contenido: `Asignado a ${assignee?.nombre || 'usuario'}`,
      es_interno: true,
    });
  }

  return c.json({
    success: true,
    data: updated,
    message: 'Disputa actualizada',
  });
});

// ============ Comments ============

// POST /api/disputas/:id/comentarios - Add comment
disputasRoutes.post(
  '/:id/comentarios',
  validateBody(comentarioCreateSchema),
  async (c) => {
    const db = c.get('db');
    const auth = c.get('auth')!;
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    if (isNaN(id)) {
      return c.json(
        { success: false, error: 'Invalid ID', message: 'ID inválido' },
        400
      );
    }

    const [disputa] = await db
      .select()
      .from(disputas)
      .where(eq(disputas.id, id))
      .limit(1);

    if (!disputa) {
      return c.json(
        { success: false, error: 'Not Found', message: 'Disputa no encontrada' },
        404
      );
    }

    // Check access
    if (auth.rol !== 'admin' && disputa.reportado_por !== auth.userId) {
      return c.json(
        { success: false, error: 'Forbidden', message: 'No autorizado' },
        403
      );
    }

    // Non-admin can't create internal comments
    const esInterno = auth.rol === 'admin' ? body.es_interno : false;

    const [created] = await db
      .insert(comentariosDisputa)
      .values({
        disputa_id: id,
        usuario_id: auth.userId,
        tipo: 'comentario',
        contenido: body.contenido,
        es_interno: esInterno,
      })
      .returning();

    return c.json(
      {
        success: true,
        data: created,
        message: 'Comentario agregado',
      },
      201
    );
  }
);

// ============ Statistics (Admin) ============

// GET /api/disputas/estadisticas - Get dispute statistics
disputasRoutes.get('/estadisticas', adminMiddleware, async (c) => {
  const db = c.get('db');

  const [
    totalAbiertas,
    totalEnInvestigacion,
    totalResueltas,
    totalRechazadas,
    porPrioridad,
    porTipo,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(disputas)
      .where(eq(disputas.estado, 'abierta')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(disputas)
      .where(eq(disputas.estado, 'en_investigacion')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(disputas)
      .where(eq(disputas.estado, 'resuelta')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(disputas)
      .where(eq(disputas.estado, 'rechazada')),
    db
      .select({
        prioridad: disputas.prioridad,
        count: sql<number>`count(*)`,
      })
      .from(disputas)
      .where(
        or(eq(disputas.estado, 'abierta'), eq(disputas.estado, 'en_investigacion'))
      )
      .groupBy(disputas.prioridad),
    db
      .select({
        tipo_disputa_id: disputas.tipo_disputa_id,
        count: sql<number>`count(*)`,
      })
      .from(disputas)
      .groupBy(disputas.tipo_disputa_id),
  ]);

  return c.json({
    success: true,
    data: {
      abiertas: totalAbiertas[0]?.count || 0,
      en_investigacion: totalEnInvestigacion[0]?.count || 0,
      resueltas: totalResueltas[0]?.count || 0,
      rechazadas: totalRechazadas[0]?.count || 0,
      por_prioridad: porPrioridad,
      por_tipo: porTipo,
    },
  });
});
