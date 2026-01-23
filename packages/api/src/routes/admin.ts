import { Hono } from 'hono';
import { eq, desc, and, like, or, sql, gte, lte } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { AuthService } from '../services/auth.service';
import { TasasService } from '../services/tasas.service';
import { RemesasService } from '../services/remesas.service';
import { parseId, parseMonetaryAmount, parsePagination, sanitizeForLike } from '../utils/validators';
import {
  usuarios,
  remesas,
  comisiones,
  configuracion,
  movimientosEfectivo,
  movimientosContables,
  pagosRevendedor,
  tasasCambio,
} from '../db/schema';
import {
  userCreateSchema,
  userUpdateSchema,
  comisionCreateSchema,
  comisionUpdateSchema,
  movimientoEfectivoCreateSchema,
  pagoRevendedorCreateSchema,
  tasasBulkUpdateSchema,
  paginationSchema,
  reportFiltersSchema,
} from '@remesitas/shared';

export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', adminMiddleware);

// ============ Dashboard ============

adminRoutes.get('/dashboard', async (c) => {
  const db = c.get('db');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // Get all stats in parallel
  const [pendientes, solicitudes, hoy, tasa] = await Promise.all([
    // Pending remittances count
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(eq(remesas.estado, 'pendiente')),
    // Pending requests (solicitudes)
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(eq(remesas.estado, 'solicitud')),
    // Today's remittances
    db
      .select({
        count: sql<number>`count(*)`,
        total_usd: sql<number>`coalesce(sum(monto_envio), 0)`,
        total_cup: sql<number>`coalesce(sum(case when moneda_entrega = 'CUP' then monto_entrega else 0 end), 0)`,
      })
      .from(remesas)
      .where(gte(remesas.fecha_creacion, todayStr)),
    // Current USD rate
    db
      .select()
      .from(tasasCambio)
      .where(and(eq(tasasCambio.moneda_origen, 'USD'), eq(tasasCambio.activa, true)))
      .limit(1),
  ]);

  return c.json({
    success: true,
    data: {
      remesas_pendientes: pendientes[0]?.count || 0,
      solicitudes_pendientes: solicitudes[0]?.count || 0,
      remesas_hoy: hoy[0]?.count || 0,
      total_usd_hoy: hoy[0]?.total_usd || 0,
      total_cup_hoy: hoy[0]?.total_cup || 0,
      tasa_actual: tasa[0]?.tasa || 0,
    },
  });
});

// ============ User Management ============

adminRoutes.get('/usuarios', validateQuery(paginationSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '20');
  const offset = (page - 1) * limit;
  const rol = query.rol;
  const search = query.search;
  const activo = query.activo;

  const whereConditions = [];

  if (rol) {
    whereConditions.push(eq(usuarios.rol, rol as any));
  }

  if (activo !== undefined) {
    whereConditions.push(eq(usuarios.activo, activo === 'true'));
  }

  if (search) {
    whereConditions.push(
      or(
        like(usuarios.username, `%${search}%`),
        like(usuarios.nombre, `%${search}%`),
        like(usuarios.telefono, `%${search}%`)
      )
    );
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [users, countResult] = await Promise.all([
    db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        nombre: usuarios.nombre,
        telefono: usuarios.telefono,
        rol: usuarios.rol,
        activo: usuarios.activo,
        debe_cambiar_password: usuarios.debe_cambiar_password,
        saldo_usd: usuarios.saldo_usd,
        saldo_cup: usuarios.saldo_cup,
        saldo_pendiente: usuarios.saldo_pendiente,
        comision_revendedor: usuarios.comision_revendedor,
        usa_logistica: usuarios.usa_logistica,
        fecha_creacion: usuarios.fecha_creacion,
      })
      .from(usuarios)
      .where(where)
      .orderBy(desc(usuarios.fecha_creacion))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(usuarios)
      .where(where),
  ]);

  return c.json({
    success: true,
    data: {
      items: users,
      total: countResult[0]?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult[0]?.count || 0) / limit),
    },
  });
});

adminRoutes.get('/usuarios/:id', async (c) => {
  const db = c.get('db');
  const id = parseId(c.req.param('id'));

  if (!id) {
    return c.json({ success: false, error: 'Invalid Input', message: 'ID de usuario inválido' }, 400);
  }

  const [user] = await db
    .select({
      id: usuarios.id,
      username: usuarios.username,
      nombre: usuarios.nombre,
      telefono: usuarios.telefono,
      rol: usuarios.rol,
      activo: usuarios.activo,
      debe_cambiar_password: usuarios.debe_cambiar_password,
      saldo_usd: usuarios.saldo_usd,
      saldo_cup: usuarios.saldo_cup,
      saldo_pendiente: usuarios.saldo_pendiente,
      comision_revendedor: usuarios.comision_revendedor,
      usa_logistica: usuarios.usa_logistica,
      fecha_creacion: usuarios.fecha_creacion,
    })
    .from(usuarios)
    .where(eq(usuarios.id, id))
    .limit(1);

  if (!user) {
    return c.json({ success: false, error: 'Not Found', message: 'Usuario no encontrado' }, 404);
  }

  return c.json({ success: true, data: user });
});

adminRoutes.post('/usuarios', validateBody(userCreateSchema), async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  // Check if username exists
  const [existing] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.username, body.username))
    .limit(1);

  if (existing) {
    return c.json({ success: false, error: 'Conflict', message: 'El nombre de usuario ya existe' }, 409);
  }

  // Hash password
  const passwordHash = await AuthService.hashPassword(body.password);

  // Insert user
  const result = await db
    .insert(usuarios)
    .values({
      username: body.username,
      password_hash: passwordHash,
      nombre: body.nombre,
      rol: body.rol,
      telefono: body.telefono || null,
      debe_cambiar_password: true,
      comision_revendedor: body.comision_revendedor || 2.0,
      usa_logistica: body.usa_logistica ?? true,
    })
    .returning({ id: usuarios.id });

  return c.json(
    { success: true, message: 'Usuario creado correctamente', data: { id: result[0].id } },
    201
  );
});

adminRoutes.put('/usuarios/:id', validateBody(userUpdateSchema), async (c) => {
  const db = c.get('db');
  const id = parseId(c.req.param('id'));
  const body = await c.req.json();

  if (!id) {
    return c.json({ success: false, error: 'Invalid Input', message: 'ID de usuario inválido' }, 400);
  }

  const [existing] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ success: false, error: 'Not Found', message: 'Usuario no encontrado' }, 404);
  }

  await db.update(usuarios).set(body).where(eq(usuarios.id, id));

  return c.json({ success: true, message: 'Usuario actualizado correctamente' });
});

adminRoutes.delete('/usuarios/:id', async (c) => {
  const db = c.get('db');
  const id = parseId(c.req.param('id'));
  const auth = c.get('auth')!;

  if (!id) {
    return c.json({ success: false, error: 'Invalid Input', message: 'ID de usuario inválido' }, 400);
  }

  if (id === auth.userId) {
    return c.json({ success: false, error: 'Forbidden', message: 'No puede eliminar su propia cuenta' }, 403);
  }

  // Soft delete (deactivate)
  await db.update(usuarios).set({ activo: false }).where(eq(usuarios.id, id));

  return c.json({ success: true, message: 'Usuario desactivado correctamente' });
});

adminRoutes.post('/usuarios/:id/reset-password', async (c) => {
  const db = c.get('db');
  const id = parseId(c.req.param('id'));
  const body = await c.req.json();

  if (!id) {
    return c.json({ success: false, error: 'Invalid Input', message: 'ID de usuario inválido' }, 400);
  }

  if (!body.new_password || body.new_password.length < 6) {
    return c.json(
      { success: false, error: 'Validation Error', message: 'La contraseña debe tener al menos 6 caracteres' },
      400
    );
  }

  const passwordHash = await AuthService.hashPassword(body.new_password);

  await db
    .update(usuarios)
    .set({ password_hash: passwordHash, debe_cambiar_password: true })
    .where(eq(usuarios.id, id));

  return c.json({ success: true, message: 'Contraseña actualizada correctamente' });
});

// Get repartidores for assignment dropdown
adminRoutes.get('/repartidores', async (c) => {
  const db = c.get('db');

  const repartidores = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      telefono: usuarios.telefono,
      saldo_usd: usuarios.saldo_usd,
      saldo_cup: usuarios.saldo_cup,
    })
    .from(usuarios)
    .where(and(eq(usuarios.rol, 'repartidor'), eq(usuarios.activo, true)))
    .orderBy(usuarios.nombre);

  return c.json({ success: true, data: repartidores });
});

// Get revendedores
adminRoutes.get('/revendedores', async (c) => {
  const db = c.get('db');

  const revendedores = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      telefono: usuarios.telefono,
      saldo_pendiente: usuarios.saldo_pendiente,
      comision_revendedor: usuarios.comision_revendedor,
      usa_logistica: usuarios.usa_logistica,
    })
    .from(usuarios)
    .where(and(eq(usuarios.rol, 'revendedor'), eq(usuarios.activo, true)))
    .orderBy(usuarios.nombre);

  return c.json({ success: true, data: revendedores });
});

// ============ Exchange Rates ============

adminRoutes.get('/tasas', async (c) => {
  const db = c.get('db');
  const tasasService = new TasasService(db);

  const rates = await tasasService.obtenerTodasLasTasas();

  return c.json({ success: true, data: rates });
});

adminRoutes.get('/tasas/historial', async (c) => {
  const db = c.get('db');
  const tasasService = new TasasService(db);
  const limit = parseInt(c.req.query('limit') || '20');

  const historial = await tasasService.obtenerHistorial(limit);

  return c.json({ success: true, data: historial });
});

adminRoutes.put('/tasas', validateBody(tasasBulkUpdateSchema), async (c) => {
  const db = c.get('db');
  const body = await c.req.json();
  const tasasService = new TasasService(db);

  if (body.usd) {
    await tasasService.agregarTasa('USD', 'CUP', body.usd);
  }
  if (body.eur) {
    await tasasService.agregarTasa('EUR', 'CUP', body.eur);
  }
  if (body.mlc) {
    await tasasService.agregarTasa('MLC', 'CUP', body.mlc);
  }

  const rates = await tasasService.obtenerTodasLasTasas();

  return c.json({ success: true, message: 'Tasas actualizadas', data: rates });
});

adminRoutes.post('/tasas/sincronizar', async (c) => {
  const db = c.get('db');
  const tasasService = new TasasService(db);
  const elToqueJwt = c.env.ELTOQUE_JWT;

  const result = await tasasService.sincronizarTasas(elToqueJwt);

  if (!result.success) {
    return c.json({ success: false, error: 'Sync Failed', message: result.error }, 500);
  }

  return c.json({ success: true, message: 'Tasas sincronizadas', data: result.rates });
});

// ============ Commissions ============

adminRoutes.get('/comisiones', async (c) => {
  const db = c.get('db');

  const commissions = await db.select().from(comisiones).orderBy(comisiones.rango_minimo);

  return c.json({ success: true, data: commissions });
});

adminRoutes.post('/comisiones', validateBody(comisionCreateSchema), async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  const result = await db
    .insert(comisiones)
    .values({
      nombre: body.nombre,
      rango_minimo: body.rango_minimo || 0,
      rango_maximo: body.rango_maximo || null,
      porcentaje: body.porcentaje || 0,
      monto_fijo: body.monto_fijo || 0,
      activa: body.activa ?? true,
    })
    .returning({ id: comisiones.id });

  return c.json({ success: true, message: 'Comisión creada', data: { id: result[0].id } }, 201);
});

adminRoutes.put('/comisiones/:id', validateBody(comisionUpdateSchema), async (c) => {
  const db = c.get('db');
  const id = parseId(c.req.param('id'));
  const body = await c.req.json();

  if (!id) {
    return c.json({ success: false, error: 'Invalid Input', message: 'ID de comisión inválido' }, 400);
  }

  await db.update(comisiones).set(body).where(eq(comisiones.id, id));

  return c.json({ success: true, message: 'Comisión actualizada' });
});

adminRoutes.delete('/comisiones/:id', async (c) => {
  const db = c.get('db');
  const id = parseId(c.req.param('id'));

  if (!id) {
    return c.json({ success: false, error: 'Invalid Input', message: 'ID de comisión inválido' }, 400);
  }

  await db.delete(comisiones).where(eq(comisiones.id, id));

  return c.json({ success: true, message: 'Comisión eliminada' });
});

// ============ Cash Flow (Efectivo) ============

adminRoutes.get('/movimientos-efectivo', async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const repartidorId = query.repartidor_id ? parseInt(query.repartidor_id) : undefined;
  const limit = parseInt(query.limit || '50');
  const offset = parseInt(query.offset || '0');

  const whereConditions = [];
  if (repartidorId) {
    whereConditions.push(eq(movimientosEfectivo.repartidor_id, repartidorId));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const movements = await db
    .select()
    .from(movimientosEfectivo)
    .where(where)
    .orderBy(desc(movimientosEfectivo.fecha))
    .limit(limit)
    .offset(offset);

  return c.json({ success: true, data: movements });
});

adminRoutes.post('/movimientos-efectivo', validateBody(movimientoEfectivoCreateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  // Get repartidor
  const [repartidor] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, body.repartidor_id), eq(usuarios.rol, 'repartidor')))
    .limit(1);

  if (!repartidor) {
    return c.json({ success: false, error: 'Not Found', message: 'Repartidor no encontrado' }, 404);
  }

  // Calculate new balance
  const saldoAnterior = body.moneda === 'USD' ? repartidor.saldo_usd : repartidor.saldo_cup;
  let saldoNuevo: number;

  // Type determines if balance increases or decreases
  switch (body.tipo) {
    case 'asignacion':
    case 'recogida':
      saldoNuevo = saldoAnterior + body.monto;
      break;
    case 'retiro':
    case 'entrega':
      saldoNuevo = saldoAnterior - body.monto;
      break;
    case 'venta_usd':
      // For USD sales, USD decreases and equivalent CUP increases
      if (body.moneda === 'USD') {
        saldoNuevo = saldoAnterior - body.monto;
      } else {
        saldoNuevo = saldoAnterior + body.monto;
      }
      break;
    default:
      saldoNuevo = saldoAnterior;
  }

  // Insert movement
  await db.insert(movimientosEfectivo).values({
    repartidor_id: body.repartidor_id,
    tipo: body.tipo,
    moneda: body.moneda,
    monto: body.monto,
    saldo_anterior: saldoAnterior,
    saldo_nuevo: saldoNuevo,
    tasa_cambio: body.tasa_cambio || null,
    notas: body.notas || null,
    registrado_por: auth.userId,
  });

  // Update repartidor balance
  const balanceField = body.moneda === 'USD' ? 'saldo_usd' : 'saldo_cup';
  await db
    .update(usuarios)
    .set({ [balanceField]: saldoNuevo })
    .where(eq(usuarios.id, body.repartidor_id));

  return c.json(
    { success: true, message: 'Movimiento registrado', data: { nuevo_saldo: saldoNuevo } },
    201
  );
});

// ============ Reseller Payments ============

adminRoutes.get('/pagos-revendedor', async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const revendedorId = query.revendedor_id ? parseInt(query.revendedor_id) : undefined;
  const limit = parseInt(query.limit || '50');
  const offset = parseInt(query.offset || '0');

  const whereConditions = [];
  if (revendedorId) {
    whereConditions.push(eq(pagosRevendedor.revendedor_id, revendedorId));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const pagos = await db
    .select()
    .from(pagosRevendedor)
    .where(where)
    .orderBy(desc(pagosRevendedor.fecha))
    .limit(limit)
    .offset(offset);

  return c.json({ success: true, data: pagos });
});

adminRoutes.post('/pagos-revendedor', validateBody(pagoRevendedorCreateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  // Get revendedor
  const [revendedor] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, body.revendedor_id), eq(usuarios.rol, 'revendedor')))
    .limit(1);

  if (!revendedor) {
    return c.json({ success: false, error: 'Not Found', message: 'Revendedor no encontrado' }, 404);
  }

  // Insert payment
  await db.insert(pagosRevendedor).values({
    revendedor_id: body.revendedor_id,
    monto: body.monto,
    metodo_pago: body.metodo_pago,
    referencia: body.referencia || null,
    notas: body.notas || null,
    registrado_por: auth.userId,
  });

  // Update pending balance
  const newBalance = Math.max(0, revendedor.saldo_pendiente - body.monto);
  await db
    .update(usuarios)
    .set({ saldo_pendiente: newBalance })
    .where(eq(usuarios.id, body.revendedor_id));

  return c.json(
    { success: true, message: 'Pago registrado', data: { nuevo_saldo_pendiente: newBalance } },
    201
  );
});

// ============ Solicitudes (Public Requests) ============

adminRoutes.get('/solicitudes', async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const limit = parseInt(query.limit || '50');
  const offset = parseInt(query.offset || '0');

  const solicitudes = await db
    .select()
    .from(remesas)
    .where(eq(remesas.estado, 'solicitud'))
    .orderBy(desc(remesas.fecha_creacion))
    .limit(limit)
    .offset(offset);

  return c.json({ success: true, data: solicitudes });
});

adminRoutes.post('/solicitudes/:id/aprobar', async (c) => {
  const db = c.get('db');
  const id = parseId(c.req.param('id'));

  if (!id) {
    return c.json({ success: false, error: 'Invalid Input', message: 'ID de solicitud inválido' }, 400);
  }

  const remesasService = new RemesasService(db);
  const remesa = await remesasService.aprobar(id);

  if (!remesa) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Solicitud no encontrada o ya aprobada' },
      404
    );
  }

  return c.json({ success: true, message: 'Solicitud aprobada', data: remesa });
});

adminRoutes.post('/solicitudes/:id/rechazar', async (c) => {
  const db = c.get('db');
  const id = parseId(c.req.param('id'));

  if (!id) {
    return c.json({ success: false, error: 'Invalid Input', message: 'ID de solicitud inválido' }, 400);
  }

  const remesasService = new RemesasService(db);
  const remesa = await remesasService.cancelar(id);

  if (!remesa) {
    return c.json({ success: false, error: 'Not Found', message: 'Solicitud no encontrada' }, 404);
  }

  return c.json({ success: true, message: 'Solicitud rechazada' });
});

// ============ Configuration ============

adminRoutes.get('/configuracion', async (c) => {
  const db = c.get('db');

  const configs = await db.select().from(configuracion);

  const configMap: Record<string, string> = {};
  for (const config of configs) {
    configMap[config.clave] = config.valor;
  }

  return c.json({ success: true, data: configMap });
});

adminRoutes.put('/configuracion', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  for (const [clave, valor] of Object.entries(body)) {
    const [existing] = await db
      .select()
      .from(configuracion)
      .where(eq(configuracion.clave, clave))
      .limit(1);

    if (existing) {
      await db
        .update(configuracion)
        .set({ valor: String(valor) })
        .where(eq(configuracion.clave, clave));
    } else {
      await db.insert(configuracion).values({
        clave,
        valor: String(valor),
      });
    }
  }

  return c.json({ success: true, message: 'Configuración actualizada' });
});

// ============ Accounting Movements ============

adminRoutes.get('/movimientos-contables', async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const tipo = query.tipo;
  const fechaInicio = query.fecha_inicio;
  const fechaFin = query.fecha_fin;
  const limit = parseInt(query.limit || '50');
  const offset = parseInt(query.offset || '0');

  const whereConditions = [];
  if (tipo) {
    whereConditions.push(eq(movimientosContables.tipo, tipo as any));
  }
  if (fechaInicio) {
    whereConditions.push(gte(movimientosContables.fecha, fechaInicio));
  }
  if (fechaFin) {
    whereConditions.push(lte(movimientosContables.fecha, fechaFin));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const movements = await db
    .select()
    .from(movimientosContables)
    .where(where)
    .orderBy(desc(movimientosContables.fecha))
    .limit(limit)
    .offset(offset);

  return c.json({ success: true, data: movements });
});

// ============ API Calculation ============

adminRoutes.get('/api/calcular', async (c) => {
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
