import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { validateBody } from '../middleware/validate';
import { publicRateLimiter } from '../middleware/rate-limit';
import { RemesasService } from '../services/remesas.service';
import { TasasService } from '../services/tasas.service';
import { PushService } from '../services/notificaciones.service';
import { remesas, tasasCambio } from '../db/schema';
import { remesaCreateSchema, remesaTrackSchema, calculatorSchema, SYSTEM_USER_ID } from '@remesitas/shared';
import { parseMonetaryAmount, parseSearchQuery } from '../utils/validators';

export const publicoRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply rate limiting to all public routes
publicoRoutes.use('*', publicRateLimiter);

// GET /api/publico/tasas - Get public exchange rates
publicoRoutes.get('/tasas', async (c) => {
  const db = c.get('db');
  const tasasService = new TasasService(db);

  const rates = await tasasService.obtenerTodasLasTasas();

  // Get last update time
  const [lastUpdate] = await db
    .select({ fecha: tasasCambio.fecha_actualizacion })
    .from(tasasCambio)
    .where(eq(tasasCambio.activa, true))
    .orderBy(desc(tasasCambio.fecha_actualizacion))
    .limit(1);

  return c.json({
    success: true,
    data: {
      ...rates,
      ultima_actualizacion: lastUpdate?.fecha || null,
    },
  });
});

// GET /api/publico/calcular-entrega - Calculate delivery amount
publicoRoutes.get('/calcular-entrega', async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  // Validate and parse amount with bounds
  const monto = parseMonetaryAmount(query.monto, { min: 1, max: 10000 });
  if (monto === null) {
    return c.json(
      { success: false, error: 'Invalid Input', message: 'El monto debe ser entre $1 y $10,000' },
      400
    );
  }

  const tipoEntrega = query.tipo_entrega === 'USD' ? 'USD' : 'MN';

  const remesasService = new RemesasService(db);
  const calculo = await remesasService.calcularPublico(monto, tipoEntrega);

  return c.json({
    success: true,
    data: calculo,
  });
});

// POST /api/publico/solicitar - Create a public remittance request
publicoRoutes.post('/solicitar', validateBody(remesaCreateSchema), async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  // Validate amount bounds
  const monto = parseMonetaryAmount(body.monto_envio, { min: 1, max: 10000 });
  if (monto === null) {
    return c.json(
      { success: false, error: 'Invalid Input', message: 'El monto debe ser entre $1 y $10,000' },
      400
    );
  }

  const remesasService = new RemesasService(db);
  const tipoEntrega = body.tipo_entrega === 'USD' ? 'USD' : 'MN';

  // Calculate amounts
  const calculo = await remesasService.calcularPublico(monto, tipoEntrega);

  // Create remittance as a request (solicitud) using system user
  const remesa = await remesasService.crear(
    {
      tipo_entrega: tipoEntrega,
      remitente_nombre: body.remitente_nombre.trim(),
      remitente_telefono: body.remitente_telefono.trim(),
      beneficiario_nombre: body.beneficiario_nombre.trim(),
      beneficiario_telefono: body.beneficiario_telefono.trim(),
      beneficiario_direccion: body.beneficiario_direccion.trim(),
      monto_envio: calculo.monto_envio,
      tasa_cambio: calculo.tasa_cambio,
      monto_entrega: calculo.monto_entrega,
      moneda_entrega: calculo.moneda_entrega,
      comision_porcentaje: calculo.comision_porcentaje,
      comision_fija: calculo.comision_fija,
      total_comision: calculo.total_comision,
      total_cobrado: calculo.total_cobrado,
      estado: 'solicitud',
      es_solicitud: true,
      notas: body.notas?.trim() || null,
    },
    SYSTEM_USER_ID
  );

  // Notify admins via push (non-blocking)
  const vapidConfig = {
    publicKey: c.env.VAPID_PUBLIC_KEY || '',
    privateKey: c.env.VAPID_PRIVATE_KEY || '',
    email: c.env.VAPID_EMAIL || '',
  };
  if (vapidConfig.publicKey && vapidConfig.privateKey) {
    const pushService = new PushService(db, vapidConfig);
    pushService.pushNuevaSolicitudAdmin(remesa).catch(() => {
      // Silently ignore push notification failures
    });
  }

  return c.json(
    {
      success: true,
      message: 'Solicitud creada correctamente. Nos pondremos en contacto pronto.',
      data: {
        codigo: remesa.codigo,
        monto_envio: calculo.monto_envio,
        monto_entrega: calculo.monto_entrega,
        moneda_entrega: calculo.moneda_entrega,
        total_comision: calculo.total_comision,
        total_cobrado: calculo.total_cobrado,
      },
    },
    201
  );
});

// GET /api/publico/rastrear/:codigo - Track remittance by code
publicoRoutes.get('/rastrear/:codigo', async (c) => {
  const db = c.get('db');
  const codigo = c.req.param('codigo').toUpperCase();

  if (codigo.length < 5) {
    return c.json(
      { success: false, error: 'Invalid Code', message: 'Código de remesa inválido' },
      400
    );
  }

  const [remesa] = await db
    .select({
      codigo: remesas.codigo,
      estado: remesas.estado,
      beneficiario_nombre: remesas.beneficiario_nombre,
      monto_entrega: remesas.monto_entrega,
      moneda_entrega: remesas.moneda_entrega,
      fecha_creacion: remesas.fecha_creacion,
      fecha_entrega: remesas.fecha_entrega,
    })
    .from(remesas)
    .where(eq(remesas.codigo, codigo))
    .limit(1);

  if (!remesa) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Remesa no encontrada' },
      404
    );
  }

  // Translate status to user-friendly message
  const estadoMensaje: Record<string, string> = {
    solicitud: 'Solicitud recibida, pendiente de confirmación',
    pendiente: 'Confirmada, pendiente de asignar repartidor',
    en_proceso: 'En camino al beneficiario',
    entregada: 'Entregada exitosamente',
    facturada: 'Completada y facturada',
    cancelada: 'Cancelada',
  };

  return c.json({
    success: true,
    data: {
      codigo: remesa.codigo,
      estado: remesa.estado,
      estado_descripcion: estadoMensaje[remesa.estado] || remesa.estado,
      beneficiario_nombre: remesa.beneficiario_nombre,
      monto_entrega: remesa.monto_entrega,
      moneda_entrega: remesa.moneda_entrega,
      fecha_creacion: remesa.fecha_creacion,
      fecha_entrega: remesa.fecha_entrega,
    },
  });
});

// POST /api/publico/rastrear - Track by code (POST version for forms)
publicoRoutes.post('/rastrear', validateBody(remesaTrackSchema), async (c) => {
  const { codigo } = await c.req.json();
  const url = new URL(c.req.url);
  url.pathname = `/api/publico/rastrear/${codigo}`;
  return c.redirect(url.toString(), 307);
});

// POST /api/publico/push/subscribe - Subscribe to push notifications (for anonymous users)
publicoRoutes.post('/push/subscribe', async (c) => {
  const db = c.get('db');
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
    null, // No user ID for anonymous
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

// GET /api/publico/vapid-key - Get VAPID public key for push notifications
publicoRoutes.get('/vapid-key', async (c) => {
  const publicKey = c.env.VAPID_PUBLIC_KEY || '';

  return c.json({
    success: true,
    data: { publicKey },
  });
});
