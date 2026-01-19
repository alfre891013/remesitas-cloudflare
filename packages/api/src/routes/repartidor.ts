import { Hono } from 'hono';
import { eq, desc, and, sql, gte } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, repartidorMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RemesasService } from '../services/remesas.service';
import { NotificacionesService, PushService } from '../services/notificaciones.service';
import { remesas, usuarios, movimientosEfectivo } from '../db/schema';
import { remesaDeliverySchema } from '@remesitas/shared';

export const repartidorRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware
repartidorRoutes.use('*', authMiddleware);
repartidorRoutes.use('*', repartidorMiddleware);

// GET /api/repartidor/dashboard - Get dashboard stats
repartidorRoutes.get('/dashboard', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  const isAdmin = auth.rol === 'admin';
  const repartidorId = isAdmin ? undefined : auth.userId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // Get user balance if repartidor
  let saldoUsd = 0;
  let saldoCup = 0;

  if (!isAdmin) {
    const [user] = await db
      .select({ saldo_usd: usuarios.saldo_usd, saldo_cup: usuarios.saldo_cup })
      .from(usuarios)
      .where(eq(usuarios.id, auth.userId))
      .limit(1);

    saldoUsd = user?.saldo_usd || 0;
    saldoCup = user?.saldo_cup || 0;
  }

  // Get stats
  const baseConditions = repartidorId ? [eq(remesas.repartidor_id, repartidorId)] : [];

  const [pendientes, entregasHoy, totalEntregas] = await Promise.all([
    // Pending deliveries
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(and(eq(remesas.estado, 'en_proceso'), ...baseConditions)),
    // Today's deliveries
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(
        and(eq(remesas.estado, 'entregada'), gte(remesas.fecha_entrega, todayStr), ...baseConditions)
      ),
    // Total delivered (all time)
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(and(eq(remesas.estado, 'entregada'), ...baseConditions)),
  ]);

  return c.json({
    success: true,
    data: {
      entregas_pendientes: pendientes[0]?.count || 0,
      entregas_hoy: entregasHoy[0]?.count || 0,
      total_entregas: totalEntregas[0]?.count || 0,
      saldo_usd: saldoUsd,
      saldo_cup: saldoCup,
    },
  });
});

// GET /api/repartidor/remesas - Get assigned remittances
repartidorRoutes.get('/remesas', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query();

  const isAdmin = auth.rol === 'admin';
  const repartidorId =
    isAdmin && query.repartidor_id ? parseInt(query.repartidor_id) : auth.userId;

  const estado = query.estado || 'en_proceso';

  const whereConditions = [eq(remesas.estado, estado as any)];

  if (!isAdmin || query.repartidor_id) {
    whereConditions.push(eq(remesas.repartidor_id, repartidorId));
  }

  const items = await db
    .select()
    .from(remesas)
    .where(and(...whereConditions))
    .orderBy(desc(remesas.fecha_creacion))
    .limit(50);

  return c.json({
    success: true,
    data: items,
  });
});

// GET /api/repartidor/remesas/:id - Get single remittance details
repartidorRoutes.get('/remesas/:id', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'));

  const [remesa] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  // Verify ownership (unless admin)
  if (auth.rol !== 'admin' && remesa.repartidor_id !== auth.userId) {
    return c.json(
      { success: false, error: 'Forbidden', message: 'No tiene permiso para esta remesa' },
      403
    );
  }

  return c.json({ success: true, data: remesa });
});

// POST /api/repartidor/remesas/:id/entregar - Mark as delivered
repartidorRoutes.post(
  '/remesas/:id/entregar',
  validateBody(remesaDeliverySchema),
  async (c) => {
    const db = c.get('db');
    const auth = c.get('auth')!;
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    const remesasService = new RemesasService(db);
    const remesa = await remesasService.entregar(id, auth.userId, body.notas);

    if (!remesa) {
      return c.json(
        {
          success: false,
          error: 'Invalid Operation',
          message: 'No se puede marcar como entregada. Verifique el estado y asignación.',
        },
        400
      );
    }

    // Notify admin via push
    try {
      const vapidConfig = {
        publicKey: c.env.VAPID_PUBLIC_KEY || '',
        privateKey: c.env.VAPID_PRIVATE_KEY || '',
        email: c.env.VAPID_EMAIL || '',
      };
      const pushService = new PushService(db, vapidConfig);
      await pushService.pushRemesaEntregadaAdmin(remesa);
    } catch (e) {
      console.error('Push notification failed:', e);
    }

    // Notify remitente
    try {
      const twilioConfig = {
        accountSid: c.env.TWILIO_ACCOUNT_SID || '',
        authToken: c.env.TWILIO_AUTH_TOKEN || '',
        smsFrom: c.env.TWILIO_SMS_FROM || '',
        whatsappFrom: c.env.TWILIO_WHATSAPP_FROM || '',
      };
      const notifService = new NotificacionesService(db, twilioConfig);
      await notifService.notificarEntregaRemitente(remesa);
    } catch (e) {
      console.error('Notification failed:', e);
    }

    return c.json({
      success: true,
      message: 'Remesa marcada como entregada',
      data: remesa,
    });
  }
);

// POST /api/repartidor/remesas/:id/foto - Upload delivery photo
repartidorRoutes.post('/remesas/:id/foto', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'));

  const [remesa] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  // Verify ownership (unless admin)
  if (auth.rol !== 'admin' && remesa.repartidor_id !== auth.userId) {
    return c.json(
      { success: false, error: 'Forbidden', message: 'No tiene permiso para esta remesa' },
      403
    );
  }

  try {
    const formData = await c.req.formData();
    const fileEntry = formData.get('foto');

    // Check if it's a File object (not a string)
    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json(
        { success: false, error: 'Missing File', message: 'No se proporcionó imagen' },
        400
      );
    }

    const file = fileEntry as File;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json(
        { success: false, error: 'Invalid File', message: 'Solo se permiten imágenes JPEG, PNG o WebP' },
        400
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json(
        { success: false, error: 'File Too Large', message: 'La imagen no puede superar 5MB' },
        400
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${remesa.codigo}_${timestamp}.${ext}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.STORAGE.put(`fotos_entrega/${filename}`, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Update remesa with photo path
    await db.update(remesas).set({ foto_entrega: filename }).where(eq(remesas.id, id));

    return c.json({
      success: true,
      message: 'Foto subida correctamente',
      data: { filename },
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return c.json(
      { success: false, error: 'Upload Failed', message: 'Error al subir la imagen' },
      500
    );
  }
});

// GET /api/repartidor/movimientos - Get cash movements
repartidorRoutes.get('/movimientos', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query();

  const isAdmin = auth.rol === 'admin';
  const repartidorId =
    isAdmin && query.repartidor_id ? parseInt(query.repartidor_id) : auth.userId;

  const limit = parseInt(query.limit || '50');
  const offset = parseInt(query.offset || '0');

  const movements = await db
    .select()
    .from(movimientosEfectivo)
    .where(eq(movimientosEfectivo.repartidor_id, repartidorId))
    .orderBy(desc(movimientosEfectivo.fecha))
    .limit(limit)
    .offset(offset);

  return c.json({
    success: true,
    data: movements,
  });
});

// GET /api/repartidor/balance - Get current balance
repartidorRoutes.get('/balance', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  const [user] = await db
    .select({
      saldo_usd: usuarios.saldo_usd,
      saldo_cup: usuarios.saldo_cup,
    })
    .from(usuarios)
    .where(eq(usuarios.id, auth.userId))
    .limit(1);

  return c.json({
    success: true,
    data: {
      saldo_usd: user?.saldo_usd || 0,
      saldo_cup: user?.saldo_cup || 0,
    },
  });
});

// POST /api/repartidor/push/subscribe - Subscribe to push notifications
repartidorRoutes.post('/push/subscribe', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return c.json(
      { success: false, error: 'Invalid Input', message: 'Datos de suscripción incompletos' },
      400
    );
  }

  const vapidConfig = {
    publicKey: c.env.VAPID_PUBLIC_KEY || '',
    privateKey: c.env.VAPID_PRIVATE_KEY || '',
    email: c.env.VAPID_EMAIL || '',
  };
  const pushService = new PushService(db, vapidConfig);

  const success = await pushService.suscribir(
    auth.userId,
    body.endpoint,
    body.p256dh,
    body.auth
  );

  if (!success) {
    return c.json(
      { success: false, error: 'Subscription Failed', message: 'Error al suscribir' },
      500
    );
  }

  return c.json({ success: true, message: 'Suscrito correctamente' });
});

// GET /api/repartidor/historial - Get delivery history
repartidorRoutes.get('/historial', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query();

  const limit = parseInt(query.limit || '20');
  const offset = parseInt(query.offset || '0');

  const items = await db
    .select()
    .from(remesas)
    .where(and(eq(remesas.repartidor_id, auth.userId), eq(remesas.estado, 'entregada')))
    .orderBy(desc(remesas.fecha_entrega))
    .limit(limit)
    .offset(offset);

  return c.json({ success: true, data: items });
});
