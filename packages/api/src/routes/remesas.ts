import { Hono } from 'hono';
import { eq, desc, and, or, like, sql, gte, lte } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { RemesasService } from '../services/remesas.service';
import { NotificacionesService, PushService } from '../services/notificaciones.service';
import { remesas, usuarios, movimientosEfectivo, movimientosContables } from '../db/schema';
import {
  remesaCreateSchema,
  remesaUpdateSchema,
  remesaAsignarSchema,
  paginationSchema,
  reportFiltersSchema,
} from '@remesitas/shared';
import { createPDFService } from '../services/pdf.service';

export const remesasRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
remesasRoutes.use('*', authMiddleware);
remesasRoutes.use('*', adminMiddleware);

// GET /api/remesas - List remittances with filters
remesasRoutes.get('/', validateQuery(paginationSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '20');
  const offset = (page - 1) * limit;

  const whereConditions = [];

  // Filter by status (exclude solicitudes by default)
  if (query.estado) {
    whereConditions.push(eq(remesas.estado, query.estado as any));
  } else {
    // By default, don't show solicitudes in main list
    whereConditions.push(sql`estado != 'solicitud'`);
  }

  // Filter by date range
  if (query.fecha_inicio) {
    whereConditions.push(gte(remesas.fecha_creacion, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    whereConditions.push(lte(remesas.fecha_creacion, query.fecha_fin));
  }

  // Filter by repartidor
  if (query.repartidor_id) {
    whereConditions.push(eq(remesas.repartidor_id, parseInt(query.repartidor_id)));
  }

  // Filter by revendedor
  if (query.revendedor_id) {
    whereConditions.push(eq(remesas.revendedor_id, parseInt(query.revendedor_id)));
  }

  // Filter by facturada
  if (query.facturada !== undefined) {
    whereConditions.push(eq(remesas.facturada, query.facturada === 'true'));
  }

  // Search by code or names
  if (query.search) {
    whereConditions.push(
      or(
        like(remesas.codigo, `%${query.search}%`),
        like(remesas.remitente_nombre, `%${query.search}%`),
        like(remesas.beneficiario_nombre, `%${query.search}%`),
        like(remesas.beneficiario_telefono, `%${query.search}%`)
      )
    );
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(remesas)
      .where(where)
      .orderBy(desc(remesas.fecha_creacion))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(where),
  ]);

  const total = countResult[0]?.count || 0;

  return c.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/remesas/:id - Get single remittance
remesasRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));

  const [remesa] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  // Get related users if assigned
  let repartidor = null;
  let revendedor = null;
  let creadoPor = null;

  if (remesa.repartidor_id) {
    const [r] = await db
      .select({ id: usuarios.id, nombre: usuarios.nombre, telefono: usuarios.telefono })
      .from(usuarios)
      .where(eq(usuarios.id, remesa.repartidor_id))
      .limit(1);
    repartidor = r;
  }

  if (remesa.revendedor_id) {
    const [r] = await db
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.id, remesa.revendedor_id))
      .limit(1);
    revendedor = r;
  }

  const [creator] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .where(eq(usuarios.id, remesa.creado_por))
    .limit(1);
  creadoPor = creator;

  return c.json({
    success: true,
    data: {
      ...remesa,
      repartidor,
      revendedor,
      creado_por_usuario: creadoPor,
    },
  });
});

// POST /api/remesas - Create new remittance
remesasRoutes.post('/', validateBody(remesaCreateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  const remesasService = new RemesasService(db);

  // Calculate amounts
  const calculo = await remesasService.calcular(
    body.monto_envio,
    body.tipo_entrega || 'MN'
  );

  // Create remittance
  const remesa = await remesasService.crear(
    {
      tipo_entrega: body.tipo_entrega || 'MN',
      remitente_nombre: body.remitente_nombre,
      remitente_telefono: body.remitente_telefono,
      beneficiario_nombre: body.beneficiario_nombre,
      beneficiario_telefono: body.beneficiario_telefono,
      beneficiario_direccion: body.beneficiario_direccion,
      monto_envio: calculo.monto_envio,
      tasa_cambio: body.tasa_cambio || calculo.tasa_cambio,
      monto_entrega: calculo.monto_entrega,
      moneda_entrega: calculo.moneda_entrega,
      comision_porcentaje: calculo.comision_porcentaje,
      comision_fija: calculo.comision_fija,
      total_comision: calculo.total_comision,
      total_cobrado: calculo.total_cobrado,
      estado: body.es_solicitud ? 'solicitud' : 'pendiente',
      es_solicitud: body.es_solicitud || false,
      notas: body.notas || null,
      revendedor_id: body.revendedor_id || null,
    },
    auth.userId
  );

  // Notify admins of new remesa via push
  try {
    const vapidConfig = {
      publicKey: c.env.VAPID_PUBLIC_KEY || '',
      privateKey: c.env.VAPID_PRIVATE_KEY || '',
      email: c.env.VAPID_EMAIL || '',
    };
    const pushService = new PushService(db, vapidConfig);
    await pushService.pushNuevaRemesaAdmin(remesa);
  } catch (e) {
    console.error('Push notification failed:', e);
  }

  return c.json(
    {
      success: true,
      message: 'Remesa creada correctamente',
      data: {
        id: remesa.id,
        codigo: remesa.codigo,
        ...calculo,
      },
    },
    201
  );
});

// PUT /api/remesas/:id - Update remittance
remesasRoutes.put('/:id', validateBody(remesaUpdateSchema), async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();

  const [existing] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!existing) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  const updates: Record<string, any> = { ...body };

  // Handle state transitions
  if (body.estado) {
    switch (body.estado) {
      case 'entregada':
        updates.fecha_entrega = new Date().toISOString();
        break;
      case 'facturada':
        updates.facturada = true;
        updates.fecha_facturacion = new Date().toISOString();
        break;
    }
  }

  await db.update(remesas).set(updates).where(eq(remesas.id, id));

  return c.json({ success: true, message: 'Remesa actualizada correctamente' });
});

// POST /api/remesas/:id/asignar - Assign to repartidor
remesasRoutes.post('/:id/asignar', validateBody(remesaAsignarSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'));
  const { repartidor_id } = await c.req.json();

  const remesasService = new RemesasService(db);
  const remesa = await remesasService.asignar(id, repartidor_id, auth.userId);

  if (!remesa) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Remesa o repartidor no encontrado' },
      404
    );
  }

  // Notify repartidor via push
  try {
    const vapidConfig = {
      publicKey: c.env.VAPID_PUBLIC_KEY || '',
      privateKey: c.env.VAPID_PRIVATE_KEY || '',
      email: c.env.VAPID_EMAIL || '',
    };
    const pushService = new PushService(db, vapidConfig);
    await pushService.pushRemesaAsignada(remesa);
  } catch (e) {
    console.error('Push notification failed:', e);
  }

  // Also notify via WhatsApp if repartidor has phone
  try {
    const [repartidor] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, repartidor_id))
      .limit(1);

    if (repartidor?.telefono) {
      const twilioConfig = {
        accountSid: c.env.TWILIO_ACCOUNT_SID || '',
        authToken: c.env.TWILIO_AUTH_TOKEN || '',
        smsFrom: c.env.TWILIO_SMS_FROM || '',
        whatsappFrom: c.env.TWILIO_WHATSAPP_FROM || '',
      };
      const notifService = new NotificacionesService(db, twilioConfig);
      await notifService.notificarNuevaRemesa(repartidor, remesa);
    }
  } catch (e) {
    console.error('WhatsApp notification failed:', e);
  }

  return c.json({ success: true, message: 'Remesa asignada correctamente', data: remesa });
});

// POST /api/remesas/:id/desasignar - Unassign from repartidor
remesasRoutes.post('/:id/desasignar', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));

  const [existing] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!existing) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  if (existing.estado === 'entregada' || existing.estado === 'facturada') {
    return c.json(
      { success: false, error: 'Invalid State', message: 'No se puede desasignar una remesa ya entregada' },
      400
    );
  }

  await db
    .update(remesas)
    .set({ repartidor_id: null, estado: 'pendiente' })
    .where(eq(remesas.id, id));

  return c.json({ success: true, message: 'Remesa desasignada correctamente' });
});

// POST /api/remesas/:id/facturar - Mark as billed
remesasRoutes.post('/:id/facturar', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));

  const remesasService = new RemesasService(db);
  const remesa = await remesasService.facturar(id);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  return c.json({ success: true, message: 'Remesa facturada correctamente' });
});

// POST /api/remesas/:id/desfacturar - Unmark as billed
remesasRoutes.post('/:id/desfacturar', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));

  const remesasService = new RemesasService(db);
  const remesa = await remesasService.desfacturar(id);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  return c.json({ success: true, message: 'Remesa desfacturada correctamente' });
});

// POST /api/remesas/:id/cancelar - Cancel remittance
remesasRoutes.post('/:id/cancelar', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));

  const [existing] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!existing) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  if (existing.estado === 'entregada' || existing.estado === 'facturada') {
    return c.json(
      { success: false, error: 'Invalid State', message: 'No se puede cancelar una remesa ya entregada' },
      400
    );
  }

  const remesasService = new RemesasService(db);
  await remesasService.cancelar(id);

  return c.json({ success: true, message: 'Remesa cancelada correctamente' });
});

// DELETE /api/remesas/:id - Delete remittance (only if not delivered)
remesasRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));

  const remesasService = new RemesasService(db);
  const deleted = await remesasService.eliminar(id);

  if (!deleted) {
    return c.json(
      { success: false, error: 'Cannot Delete', message: 'No se puede eliminar esta remesa' },
      400
    );
  }

  return c.json({ success: true, message: 'Remesa eliminada correctamente' });
});

// GET /api/remesas/buscar-remitentes - Autocomplete senders
remesasRoutes.get('/buscar-remitentes', async (c) => {
  const db = c.get('db');
  const search = c.req.query('q') || '';

  if (search.length < 2) {
    return c.json({ success: true, data: [] });
  }

  const remesasService = new RemesasService(db);
  const results = await remesasService.buscarRemitentes(search);

  return c.json({ success: true, data: results });
});

// GET /api/remesas/buscar-beneficiarios - Autocomplete recipients
remesasRoutes.get('/buscar-beneficiarios', async (c) => {
  const db = c.get('db');
  const search = c.req.query('q') || '';

  if (search.length < 2) {
    return c.json({ success: true, data: [] });
  }

  const remesasService = new RemesasService(db);
  const results = await remesasService.buscarBeneficiarios(search);

  return c.json({ success: true, data: results });
});

// GET /api/remesas/por-remitente/:telefono - Get remittances by sender phone
remesasRoutes.get('/por-remitente/:telefono', async (c) => {
  const db = c.get('db');
  const telefono = c.req.param('telefono');

  const remesasService = new RemesasService(db);
  const results = await remesasService.obtenerPorTelefonoRemitente(telefono);

  return c.json({ success: true, data: results });
});

// GET /api/remesas/:id/links - Get notification links for manual sending
remesasRoutes.get('/:id/links', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));

  const [remesa] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  let repartidor = null;
  if (remesa.repartidor_id) {
    const [r] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, remesa.repartidor_id))
      .limit(1);
    repartidor = r;
  }

  const twilioConfig = {
    accountSid: c.env.TWILIO_ACCOUNT_SID || '',
    authToken: c.env.TWILIO_AUTH_TOKEN || '',
    smsFrom: c.env.TWILIO_SMS_FROM || '',
    whatsappFrom: c.env.TWILIO_WHATSAPP_FROM || '',
  };
  const notifService = new NotificacionesService(db, twilioConfig);
  const links = notifService.obtenerLinksNotificacion(remesa, repartidor);

  return c.json({ success: true, data: links });
});

// POST /api/remesas/:id/notificar - Send notifications
remesasRoutes.post('/:id/notificar', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));
  const { tipo } = await c.req.json(); // 'remitente' | 'beneficiario' | 'repartidor'

  const [remesa] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  const twilioConfig = {
    accountSid: c.env.TWILIO_ACCOUNT_SID || '',
    authToken: c.env.TWILIO_AUTH_TOKEN || '',
    smsFrom: c.env.TWILIO_SMS_FROM || '',
    whatsappFrom: c.env.TWILIO_WHATSAPP_FROM || '',
  };
  const notifService = new NotificacionesService(db, twilioConfig);

  let result;
  switch (tipo) {
    case 'remitente':
      result = await notifService.notificarRemitente(remesa);
      break;
    case 'beneficiario':
      result = await notifService.notificarBeneficiario(remesa);
      break;
    case 'repartidor':
      if (remesa.repartidor_id) {
        const [repartidor] = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.id, remesa.repartidor_id))
          .limit(1);
        if (repartidor) {
          result = await notifService.notificarNuevaRemesa(repartidor, remesa);
        } else {
          result = { success: false, error: 'Repartidor no encontrado' };
        }
      } else {
        result = { success: false, error: 'No hay repartidor asignado' };
      }
      break;
    default:
      return c.json({ success: false, error: 'Invalid Type', message: 'Tipo de notificación inválido' }, 400);
  }

  return c.json({ success: result.success, data: result });
});

// GET /api/remesas/api/calcular - Calculate amounts (for form)
remesasRoutes.get('/api/calcular', async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const monto = parseFloat(query.monto || '0');
  const tipoEntrega = (query.tipo_entrega || 'MN') as 'MN' | 'USD';

  if (monto <= 0) {
    return c.json({ success: false, error: 'Invalid Input', message: 'El monto debe ser mayor a 0' }, 400);
  }

  const remesasService = new RemesasService(db);
  const calculo = await remesasService.calcular(monto, tipoEntrega);

  return c.json({ success: true, data: calculo });
});

// ============ Receipt Generation ============

// GET /api/remesas/:id/recibo - Get delivery receipt as HTML
remesasRoutes.get('/:id/recibo', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'));
  const format = c.req.query('format') || 'html';

  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid ID', message: 'ID inválido' }, 400);
  }

  const [remesa] = await db.select().from(remesas).where(eq(remesas.id, id)).limit(1);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Remesa no encontrada' }, 404);
  }

  try {
    const pdfService = createPDFService(db, c.env.STORAGE);
    const html = await pdfService.generateReceiptHTML(id);

    if (format === 'json') {
      return c.json({
        success: true,
        data: { html },
      });
    }

    // Return as HTML document
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="recibo-${remesa.codigo}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    return c.json(
      { success: false, error: 'Generation Failed', message: 'Error al generar recibo' },
      500
    );
  }
});
