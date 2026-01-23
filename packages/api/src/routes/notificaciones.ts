/**
 * Notification API Routes
 *
 * Endpoints for managing notifications, preferences, and retry queue
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc, and, sql, inArray, gte, lte } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { notificaciones, tiposNotificacion, usuarios, suscripcionesPush } from '../db/schema';
import { validateBody } from '../middleware/validate';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import {
  createNotificationService,
  NotificationCode,
  type NotificationCodeType,
} from '../services/notificaciones-v2.service';

const notificacionesRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============ Schemas ============

const updatePreferencesSchema = z.object({
  sms: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  push: z.boolean().optional(),
  email: z.boolean().optional(),
});

const sendTestSchema = z.object({
  channel: z.enum(['sms', 'whatsapp', 'push', 'email']),
  recipient: z.string().min(1),
  message: z.string().min(1).max(500),
});

const retrySchema = z.object({
  notification_ids: z.array(z.number()).min(1).max(100),
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  estado: z.enum(['pendiente', 'enviando', 'enviado', 'fallido', 'entregado']).optional(),
  canal: z.enum(['sms', 'whatsapp', 'push', 'email']).optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

// ============ User Endpoints ============

/**
 * GET /api/notificaciones/preferencias
 * Get current user's notification preferences
 */
notificacionesRoutes.get('/preferencias', authMiddleware, async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  try {
    const [user] = await db
      .select({
        preferencias_notificacion: usuarios.preferencias_notificacion,
        email: usuarios.email,
        telefono: usuarios.telefono,
      })
      .from(usuarios)
      .where(eq(usuarios.id, auth.userId))
      .limit(1);

    if (!user) {
      return c.json({ success: false, message: 'Usuario no encontrado' }, 404);
    }

    let preferencias = { sms: true, whatsapp: true, push: true, email: false };
    try {
      if (user.preferencias_notificacion) {
        preferencias = JSON.parse(user.preferencias_notificacion);
      }
    } catch {}

    return c.json({
      success: true,
      data: {
        preferencias,
        email: user.email,
        telefono: user.telefono,
        email_verificado: !!user.email,
      },
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return c.json({ success: false, message: 'Error al cargar preferencias' }, 500);
  }
});

/**
 * PUT /api/notificaciones/preferencias
 * Update notification preferences
 */
notificacionesRoutes.put(
  '/preferencias',
  authMiddleware,
  validateBody(updatePreferencesSchema),
  async (c) => {
    const db = c.get('db');
    const auth = c.get('auth')!;
    const updates = c.req.valid('json' as never) as z.infer<typeof updatePreferencesSchema>;

    try {
      // Get current preferences
      const [user] = await db
        .select({ preferencias_notificacion: usuarios.preferencias_notificacion })
        .from(usuarios)
        .where(eq(usuarios.id, auth.userId))
        .limit(1);

      let preferencias = { sms: true, whatsapp: true, push: true, email: false };
      try {
        if (user?.preferencias_notificacion) {
          preferencias = JSON.parse(user.preferencias_notificacion);
        }
      } catch {}

      // Merge updates
      const newPrefs = { ...preferencias, ...updates };

      await db
        .update(usuarios)
        .set({ preferencias_notificacion: JSON.stringify(newPrefs) })
        .where(eq(usuarios.id, auth.userId));

      return c.json({
        success: true,
        data: newPrefs,
        message: 'Preferencias actualizadas',
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      return c.json({ success: false, message: 'Error al actualizar preferencias' }, 500);
    }
  }
);

/**
 * GET /api/notificaciones/historial
 * Get user's notification history
 */
notificacionesRoutes.get('/historial', authMiddleware, async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  try {
    const notifications = await db
      .select({
        id: notificaciones.id,
        canal: notificaciones.canal,
        mensaje: notificaciones.mensaje,
        estado: notificaciones.estado,
        fecha_creacion: notificaciones.fecha_creacion,
        fecha_envio: notificaciones.fecha_envio,
      })
      .from(notificaciones)
      .where(eq(notificaciones.usuario_id, auth.userId))
      .orderBy(desc(notificaciones.fecha_creacion))
      .limit(Math.min(limit, 50))
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificaciones)
      .where(eq(notificaciones.usuario_id, auth.userId));

    return c.json({
      success: true,
      data: {
        notifications,
        total: count,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    return c.json({ success: false, message: 'Error al cargar historial' }, 500);
  }
});

// ============ Admin Endpoints ============

/**
 * GET /api/notificaciones
 * List all notifications (admin only)
 */
notificacionesRoutes.get('/', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const estado = c.req.query('estado');
  const canal = c.req.query('canal');
  const desde = c.req.query('desde');
  const hasta = c.req.query('hasta');

  try {
    const conditions: any[] = [];

    if (estado && ['pendiente', 'enviando', 'enviado', 'fallido', 'entregado'].includes(estado)) {
      conditions.push(eq(notificaciones.estado, estado as any));
    }

    if (canal && ['sms', 'whatsapp', 'push', 'email'].includes(canal)) {
      conditions.push(eq(notificaciones.canal, canal as any));
    }

    if (desde) {
      conditions.push(gte(notificaciones.fecha_creacion, desde));
    }

    if (hasta) {
      conditions.push(lte(notificaciones.fecha_creacion, hasta));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const notifications = await db
      .select({
        id: notificaciones.id,
        usuario_id: notificaciones.usuario_id,
        remesa_id: notificaciones.remesa_id,
        canal: notificaciones.canal,
        destinatario: notificaciones.destinatario,
        mensaje: notificaciones.mensaje,
        estado: notificaciones.estado,
        error_mensaje: notificaciones.error_mensaje,
        provider_message_id: notificaciones.provider_message_id,
        fecha_creacion: notificaciones.fecha_creacion,
        fecha_envio: notificaciones.fecha_envio,
        intentos: notificaciones.intentos,
        max_intentos: notificaciones.max_intentos,
      })
      .from(notificaciones)
      .where(whereClause)
      .orderBy(desc(notificaciones.fecha_creacion))
      .limit(Math.min(limit, 100))
      .offset((page - 1) * limit);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificaciones)
      .where(whereClause);

    return c.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return c.json({ success: false, message: 'Error al cargar notificaciones' }, 500);
  }
});

/**
 * GET /api/notificaciones/stats
 * Get notification statistics (admin only)
 */
notificacionesRoutes.get('/stats', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');

  try {
    const service = createNotificationService(db, c.env);
    const stats = await service.getStats();

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const [{ todayCount }] = await db
      .select({ todayCount: sql<number>`count(*)` })
      .from(notificaciones)
      .where(gte(notificaciones.fecha_creacion, todayStr));

    const [{ todaySuccess }] = await db
      .select({ todaySuccess: sql<number>`count(*)` })
      .from(notificaciones)
      .where(
        and(
          gte(notificaciones.fecha_creacion, todayStr),
          eq(notificaciones.estado, 'enviado')
        )
      );

    // Get pending retry count
    const [{ pendingRetry }] = await db
      .select({ pendingRetry: sql<number>`count(*)` })
      .from(notificaciones)
      .where(
        and(
          inArray(notificaciones.estado, ['pendiente', 'fallido']),
          sql`${notificaciones.intentos} < ${notificaciones.max_intentos}`
        )
      );

    return c.json({
      success: true,
      data: {
        ...stats,
        today: {
          total: todayCount,
          success: todaySuccess,
          rate: todayCount > 0 ? ((todaySuccess / todayCount) * 100).toFixed(1) : '0',
        },
        pendingRetry,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ success: false, message: 'Error al cargar estadisticas' }, 500);
  }
});

/**
 * GET /api/notificaciones/tipos
 * Get notification types (admin only)
 */
notificacionesRoutes.get('/tipos', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');

  try {
    const tipos = await db.select().from(tiposNotificacion).orderBy(tiposNotificacion.id);

    return c.json({ success: true, data: tipos });
  } catch (error) {
    console.error('Error fetching notification types:', error);
    return c.json({ success: false, message: 'Error al cargar tipos' }, 500);
  }
});

/**
 * PUT /api/notificaciones/tipos/:id
 * Update notification type template (admin only)
 */
notificacionesRoutes.put('/tipos/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);
  const updates = await c.req.json();

  try {
    // Validate allowed fields
    const allowedFields = [
      'plantilla_sms',
      'plantilla_whatsapp',
      'plantilla_email_asunto',
      'plantilla_email_cuerpo',
      'plantilla_push_titulo',
      'plantilla_push_cuerpo',
      'activo',
    ];

    const filteredUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return c.json({ success: false, message: 'No hay campos validos para actualizar' }, 400);
    }

    await db.update(tiposNotificacion).set(filteredUpdates).where(eq(tiposNotificacion.id, id));

    return c.json({ success: true, message: 'Plantilla actualizada' });
  } catch (error) {
    console.error('Error updating notification type:', error);
    return c.json({ success: false, message: 'Error al actualizar plantilla' }, 500);
  }
});

/**
 * POST /api/notificaciones/test
 * Send test notification (admin only)
 */
notificacionesRoutes.post(
  '/test',
  authMiddleware,
  adminMiddleware,
  validateBody(sendTestSchema),
  async (c) => {
    const db = c.get('db');
    const { channel, recipient, message } = c.req.valid('json' as never) as z.infer<
      typeof sendTestSchema
    >;
    const auth = c.get('auth')!;

    try {
      const service = createNotificationService(db, c.env);

      // For push, use the admin's user ID
      const data: any = { usuario_id: auth.userId };

      const result = await service.send(
        NotificationCode.REMESA_CREADA, // Use a generic type
        recipient,
        data,
        { channels: [channel], skipPreferences: true }
      );

      const success = result.some((r) => r.success);

      return c.json({
        success,
        message: success ? 'Notificacion enviada' : 'Error al enviar notificacion',
        data: result,
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      return c.json({ success: false, message: 'Error al enviar notificacion' }, 500);
    }
  }
);

/**
 * POST /api/notificaciones/retry
 * Retry failed notifications (admin only)
 */
notificacionesRoutes.post(
  '/retry',
  authMiddleware,
  adminMiddleware,
  validateBody(retrySchema),
  async (c) => {
    const db = c.get('db');
    const { notification_ids } = c.req.valid('json' as never) as z.infer<typeof retrySchema>;

    try {
      // Reset notifications for retry
      const now = new Date().toISOString();

      await db
        .update(notificaciones)
        .set({
          estado: 'pendiente',
          siguiente_intento: now,
          error_mensaje: null,
        })
        .where(
          and(
            inArray(notificaciones.id, notification_ids),
            inArray(notificaciones.estado, ['fallido']),
            sql`${notificaciones.intentos} < ${notificaciones.max_intentos}`
          )
        );

      return c.json({
        success: true,
        message: `${notification_ids.length} notificaciones programadas para reintento`,
      });
    } catch (error) {
      console.error('Error scheduling retry:', error);
      return c.json({ success: false, message: 'Error al programar reintento' }, 500);
    }
  }
);

/**
 * POST /api/notificaciones/process-queue
 * Manually process retry queue (admin only)
 */
notificacionesRoutes.post('/process-queue', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');

  try {
    const service = createNotificationService(db, c.env);
    const result = await service.processRetryQueue();

    return c.json({
      success: true,
      message: `Procesadas ${result.processed} notificaciones: ${result.succeeded} exitosas, ${result.failed} fallidas`,
      data: result,
    });
  } catch (error) {
    console.error('Error processing queue:', error);
    return c.json({ success: false, message: 'Error al procesar cola' }, 500);
  }
});

/**
 * GET /api/notificaciones/:id
 * Get notification details (admin only)
 */
notificacionesRoutes.get('/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);

  try {
    const [notification] = await db
      .select()
      .from(notificaciones)
      .where(eq(notificaciones.id, id))
      .limit(1);

    if (!notification) {
      return c.json({ success: false, message: 'Notificacion no encontrada' }, 404);
    }

    // Get notification type info
    let tipoInfo = null;
    if (notification.tipo_notificacion_id) {
      const [tipo] = await db
        .select()
        .from(tiposNotificacion)
        .where(eq(tiposNotificacion.id, notification.tipo_notificacion_id))
        .limit(1);
      tipoInfo = tipo;
    }

    return c.json({
      success: true,
      data: {
        ...notification,
        tipo: tipoInfo,
      },
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    return c.json({ success: false, message: 'Error al cargar notificacion' }, 500);
  }
});

/**
 * DELETE /api/notificaciones/:id
 * Delete notification (admin only)
 */
notificacionesRoutes.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);

  try {
    await db.delete(notificaciones).where(eq(notificaciones.id, id));

    return c.json({ success: true, message: 'Notificacion eliminada' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return c.json({ success: false, message: 'Error al eliminar notificacion' }, 500);
  }
});

// ============ Push Subscription Endpoints ============

/**
 * POST /api/notificaciones/push/suscribir
 * Subscribe to push notifications
 */
notificacionesRoutes.post('/push/suscribir', authMiddleware, async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const { endpoint, p256dh, auth: authKey } = await c.req.json();

  if (!endpoint || !p256dh || !authKey) {
    return c.json({ success: false, message: 'Datos de suscripcion incompletos' }, 400);
  }

  try {
    // Check if already exists
    const [existing] = await db
      .select()
      .from(suscripcionesPush)
      .where(eq(suscripcionesPush.endpoint, endpoint))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(suscripcionesPush)
        .set({
          usuario_id: auth.userId,
          p256dh,
          auth: authKey,
          activa: true,
        })
        .where(eq(suscripcionesPush.id, existing.id));
    } else {
      // Create new
      await db.insert(suscripcionesPush).values({
        usuario_id: auth.userId,
        endpoint,
        p256dh,
        auth: authKey,
        activa: true,
      });
    }

    return c.json({ success: true, message: 'Suscripcion registrada' });
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return c.json({ success: false, message: 'Error al suscribirse' }, 500);
  }
});

/**
 * POST /api/notificaciones/push/desuscribir
 * Unsubscribe from push notifications
 */
notificacionesRoutes.post('/push/desuscribir', async (c) => {
  const db = c.get('db');
  const { endpoint } = await c.req.json();

  if (!endpoint) {
    return c.json({ success: false, message: 'Endpoint requerido' }, 400);
  }

  try {
    await db
      .update(suscripcionesPush)
      .set({ activa: false })
      .where(eq(suscripcionesPush.endpoint, endpoint));

    return c.json({ success: true, message: 'Suscripcion cancelada' });
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return c.json({ success: false, message: 'Error al desuscribirse' }, 500);
  }
});

/**
 * GET /api/notificaciones/push/vapid-key
 * Get VAPID public key for push subscriptions
 */
notificacionesRoutes.get('/push/vapid-key', (c) => {
  const publicKey = c.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return c.json({ success: false, message: 'Push notifications not configured' }, 503);
  }

  return c.json({ success: true, data: { publicKey } });
});

export { notificacionesRoutes };
