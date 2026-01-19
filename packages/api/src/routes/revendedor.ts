import { Hono } from 'hono';
import { eq, desc, and, sql, gte } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, revendedorMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { RemesasService } from '../services/remesas.service';
import { PushService } from '../services/notificaciones.service';
import { remesas, usuarios, pagosRevendedor } from '../db/schema';
import { remesaCreateSchema, calculatorRevendedorSchema } from '@remesitas/shared';

export const revendedorRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware
revendedorRoutes.use('*', authMiddleware);
revendedorRoutes.use('*', revendedorMiddleware);

// GET /api/revendedor/dashboard - Get dashboard stats
revendedorRoutes.get('/dashboard', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  const isAdmin = auth.rol === 'admin';
  const revendedorId = isAdmin ? undefined : auth.userId;

  // Get this month's start date
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString();

  // Get user stats
  let saldoPendiente = 0;
  let comisionRevendedor = 0;
  let usaLogistica = true;

  if (!isAdmin) {
    const [user] = await db
      .select({
        saldo_pendiente: usuarios.saldo_pendiente,
        comision_revendedor: usuarios.comision_revendedor,
        usa_logistica: usuarios.usa_logistica,
      })
      .from(usuarios)
      .where(eq(usuarios.id, auth.userId))
      .limit(1);

    saldoPendiente = user?.saldo_pendiente || 0;
    comisionRevendedor = user?.comision_revendedor || 0;
    usaLogistica = user?.usa_logistica ?? true;
  }

  // Get stats
  const whereConditions = revendedorId ? [eq(remesas.revendedor_id, revendedorId)] : [];

  const [remesasMes, totalPagado] = await Promise.all([
    // This month's remittances
    db
      .select({
        count: sql<number>`count(*)`,
        total_usd: sql<number>`coalesce(sum(monto_envio), 0)`,
        total_comision: sql<number>`coalesce(sum(comision_plataforma), 0)`,
      })
      .from(remesas)
      .where(and(gte(remesas.fecha_creacion, monthStartStr), ...whereConditions)),
    // Total paid commissions
    isAdmin
      ? Promise.resolve([{ total: 0 }])
      : db
          .select({ total: sql<number>`coalesce(sum(monto), 0)` })
          .from(pagosRevendedor)
          .where(eq(pagosRevendedor.revendedor_id, auth.userId)),
  ]);

  return c.json({
    success: true,
    data: {
      remesas_mes: remesasMes[0]?.count || 0,
      total_usd_mes: remesasMes[0]?.total_usd || 0,
      comisiones_mes: remesasMes[0]?.total_comision || 0,
      saldo_pendiente: saldoPendiente,
      comisiones_pagadas: totalPagado[0]?.total || 0,
      comision_porcentaje: comisionRevendedor,
      usa_logistica: usaLogistica,
    },
  });
});

// GET /api/revendedor/remesas - Get reseller's remittances
revendedorRoutes.get('/remesas', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query();

  const isAdmin = auth.rol === 'admin';
  const revendedorId =
    isAdmin && query.revendedor_id ? parseInt(query.revendedor_id) : auth.userId;

  const limit = parseInt(query.limit || '20');
  const offset = parseInt(query.offset || '0');

  const whereConditions = [eq(remesas.revendedor_id, revendedorId)];

  if (query.estado) {
    whereConditions.push(eq(remesas.estado, query.estado as any));
  }

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(remesas)
      .where(and(...whereConditions))
      .orderBy(desc(remesas.fecha_creacion))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(and(...whereConditions)),
  ]);

  return c.json({
    success: true,
    data: {
      items,
      total: countResult[0]?.count || 0,
    },
  });
});

// POST /api/revendedor/remesas - Create remittance as reseller
revendedorRoutes.post('/remesas', validateBody(remesaCreateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  // Get reseller's info
  const [user] = await db
    .select({
      comision_revendedor: usuarios.comision_revendedor,
      usa_logistica: usuarios.usa_logistica,
    })
    .from(usuarios)
    .where(eq(usuarios.id, auth.userId))
    .limit(1);

  const comisionRevendedor = user?.comision_revendedor || 0;
  const usaLogistica = user?.usa_logistica ?? true;

  const remesasService = new RemesasService(db);

  // Calculate amounts for reseller
  const calculo = await remesasService.calcularRevendedor(
    body.monto_envio,
    body.tipo_entrega || 'MN',
    comisionRevendedor
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
      comision_plataforma: calculo.comision_plataforma,
      estado: 'pendiente',
      es_solicitud: false,
      notas: body.notas || null,
      revendedor_id: auth.userId,
    },
    auth.userId
  );

  // Update reseller's pending balance based on usa_logistica
  if (usaLogistica) {
    // Reseller uses our logistics - they owe us the platform commission
    await db
      .update(usuarios)
      .set({ saldo_pendiente: sql`saldo_pendiente + ${calculo.comision_plataforma}` })
      .where(eq(usuarios.id, auth.userId));
  }
  // If not using logistics, the commission structure is different - managed externally

  // Notify admins via push
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

// GET /api/revendedor/api/calcular - Calculate with reseller commission
revendedorRoutes.get('/api/calcular', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query();

  const monto = parseFloat(query.monto || '0');
  const tipoEntrega = (query.tipo_entrega || 'MN') as 'MN' | 'USD';

  if (monto <= 0) {
    return c.json(
      { success: false, error: 'Invalid Input', message: 'El monto debe ser mayor a 0' },
      400
    );
  }

  // Get reseller's commission rate
  const [user] = await db
    .select({ comision_revendedor: usuarios.comision_revendedor })
    .from(usuarios)
    .where(eq(usuarios.id, auth.userId))
    .limit(1);

  const comisionRevendedor = user?.comision_revendedor || 0;

  const remesasService = new RemesasService(db);
  const calculo = await remesasService.calcularRevendedor(monto, tipoEntrega, comisionRevendedor);

  return c.json({
    success: true,
    data: calculo,
  });
});

// GET /api/revendedor/pagos - Get payment history
revendedorRoutes.get('/pagos', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query();

  const isAdmin = auth.rol === 'admin';
  const revendedorId =
    isAdmin && query.revendedor_id ? parseInt(query.revendedor_id) : auth.userId;

  const limit = parseInt(query.limit || '20');
  const offset = parseInt(query.offset || '0');

  const pagos = await db
    .select()
    .from(pagosRevendedor)
    .where(eq(pagosRevendedor.revendedor_id, revendedorId))
    .orderBy(desc(pagosRevendedor.fecha))
    .limit(limit)
    .offset(offset);

  return c.json({
    success: true,
    data: pagos,
  });
});

// GET /api/revendedor/balance - Get current balance
revendedorRoutes.get('/balance', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  const [user] = await db
    .select({
      saldo_pendiente: usuarios.saldo_pendiente,
      comision_revendedor: usuarios.comision_revendedor,
      usa_logistica: usuarios.usa_logistica,
    })
    .from(usuarios)
    .where(eq(usuarios.id, auth.userId))
    .limit(1);

  return c.json({
    success: true,
    data: {
      saldo_pendiente: user?.saldo_pendiente || 0,
      comision_porcentaje: user?.comision_revendedor || 0,
      usa_logistica: user?.usa_logistica ?? true,
    },
  });
});

// POST /api/revendedor/push/subscribe - Subscribe to push notifications
revendedorRoutes.post('/push/subscribe', async (c) => {
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

// GET /api/revendedor/remitentes - Get recent senders used by this reseller
revendedorRoutes.get('/remitentes', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  const remitentes = await db
    .selectDistinct({
      nombre: remesas.remitente_nombre,
      telefono: remesas.remitente_telefono,
    })
    .from(remesas)
    .where(eq(remesas.revendedor_id, auth.userId))
    .orderBy(desc(remesas.fecha_creacion))
    .limit(20);

  return c.json({ success: true, data: remitentes });
});

// GET /api/revendedor/beneficiarios - Get recent recipients used by this reseller
revendedorRoutes.get('/beneficiarios', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  const beneficiarios = await db
    .selectDistinct({
      nombre: remesas.beneficiario_nombre,
      telefono: remesas.beneficiario_telefono,
      direccion: remesas.beneficiario_direccion,
    })
    .from(remesas)
    .where(eq(remesas.revendedor_id, auth.userId))
    .orderBy(desc(remesas.fecha_creacion))
    .limit(20);

  return c.json({ success: true, data: beneficiarios });
});
