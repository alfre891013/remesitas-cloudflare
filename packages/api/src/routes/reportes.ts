import { Hono } from 'hono';
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import {
  remesas,
  usuarios,
  movimientosEfectivo,
  movimientosContables,
  pagosRevendedor,
} from '../db/schema';
import { reportFiltersSchema } from '@remesitas/shared';

export const reportesRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
reportesRoutes.use('*', authMiddleware);
reportesRoutes.use('*', adminMiddleware);

// GET /api/reportes/resumen - General summary
reportesRoutes.get('/resumen', validateQuery(reportFiltersSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  const whereConditions = [];

  if (query.fecha_inicio) {
    whereConditions.push(gte(remesas.fecha_creacion, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    whereConditions.push(lte(remesas.fecha_creacion, query.fecha_fin));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [totals, byStatus] = await Promise.all([
    // Total amounts
    db
      .select({
        total_remesas: sql<number>`count(*)`,
        total_monto_envio: sql<number>`coalesce(sum(monto_envio), 0)`,
        total_monto_entrega: sql<number>`coalesce(sum(monto_entrega), 0)`,
        total_comision: sql<number>`coalesce(sum(total_comision), 0)`,
        total_cobrado: sql<number>`coalesce(sum(total_cobrado), 0)`,
      })
      .from(remesas)
      .where(where),
    // By status
    db
      .select({
        estado: remesas.estado,
        cantidad: sql<number>`count(*)`,
        total_monto_envio: sql<number>`coalesce(sum(monto_envio), 0)`,
      })
      .from(remesas)
      .where(where)
      .groupBy(remesas.estado),
  ]);

  return c.json({
    success: true,
    data: {
      totales: totals[0],
      por_estado: byStatus,
    },
  });
});

// GET /api/reportes/repartidores - Repartidor performance report
reportesRoutes.get('/repartidores', validateQuery(reportFiltersSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  const whereConditions = [eq(remesas.estado, 'entregada')];

  if (query.fecha_inicio) {
    whereConditions.push(gte(remesas.fecha_entrega, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    whereConditions.push(lte(remesas.fecha_entrega, query.fecha_fin));
  }

  // Get all repartidores
  const repartidores = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      saldo_usd: usuarios.saldo_usd,
      saldo_cup: usuarios.saldo_cup,
    })
    .from(usuarios)
    .where(eq(usuarios.rol, 'repartidor'));

  // Get delivery stats per repartidor
  const deliveryStats = await db
    .select({
      repartidor_id: remesas.repartidor_id,
      entregas: sql<number>`count(*)`,
      total_monto_envio: sql<number>`coalesce(sum(monto_envio), 0)`,
      total_monto_entrega: sql<number>`coalesce(sum(monto_entrega), 0)`,
    })
    .from(remesas)
    .where(and(...whereConditions))
    .groupBy(remesas.repartidor_id);

  // Combine data
  const result = repartidores.map((rep) => {
    const stats = deliveryStats.find((s) => s.repartidor_id === rep.id);
    return {
      ...rep,
      entregas: stats?.entregas || 0,
      total_monto_envio: stats?.total_monto_envio || 0,
      total_monto_entrega: stats?.total_monto_entrega || 0,
    };
  });

  return c.json({
    success: true,
    data: result,
  });
});

// GET /api/reportes/revendedores - Reseller performance report
reportesRoutes.get('/revendedores', validateQuery(reportFiltersSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  const whereConditions = [];

  if (query.fecha_inicio) {
    whereConditions.push(gte(remesas.fecha_creacion, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    whereConditions.push(lte(remesas.fecha_creacion, query.fecha_fin));
  }

  // Get all revendedores
  const revendedores = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      saldo_pendiente: usuarios.saldo_pendiente,
      comision_revendedor: usuarios.comision_revendedor,
      usa_logistica: usuarios.usa_logistica,
    })
    .from(usuarios)
    .where(eq(usuarios.rol, 'revendedor'));

  // Get remittance stats per revendedor
  const baseWhereConditions =
    whereConditions.length > 0
      ? and(...whereConditions, sql`revendedor_id IS NOT NULL`)
      : sql`revendedor_id IS NOT NULL`;

  const remesaStats = await db
    .select({
      revendedor_id: remesas.revendedor_id,
      remesas_count: sql<number>`count(*)`,
      total_monto_envio: sql<number>`coalesce(sum(monto_envio), 0)`,
      total_comision_plataforma: sql<number>`coalesce(sum(comision_plataforma), 0)`,
    })
    .from(remesas)
    .where(baseWhereConditions)
    .groupBy(remesas.revendedor_id);

  // Get payment totals
  const paymentStats = await db
    .select({
      revendedor_id: pagosRevendedor.revendedor_id,
      total_pagado: sql<number>`coalesce(sum(monto), 0)`,
    })
    .from(pagosRevendedor)
    .groupBy(pagosRevendedor.revendedor_id);

  // Combine data
  const result = revendedores.map((rev) => {
    const remStats = remesaStats.find((s) => s.revendedor_id === rev.id);
    const payStats = paymentStats.find((s) => s.revendedor_id === rev.id);
    return {
      ...rev,
      remesas_count: remStats?.remesas_count || 0,
      total_monto_envio: remStats?.total_monto_envio || 0,
      total_comision_plataforma: remStats?.total_comision_plataforma || 0,
      total_pagado: payStats?.total_pagado || 0,
    };
  });

  return c.json({
    success: true,
    data: result,
  });
});

// GET /api/reportes/movimientos - Cash movements report
reportesRoutes.get('/movimientos', validateQuery(reportFiltersSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const limit = parseInt(query.limit || '100');
  const offset = parseInt(query.offset || '0');

  const whereConditions = [];

  if (query.fecha_inicio) {
    whereConditions.push(gte(movimientosEfectivo.fecha, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    whereConditions.push(lte(movimientosEfectivo.fecha, query.fecha_fin));
  }
  if (query.repartidor_id) {
    whereConditions.push(eq(movimientosEfectivo.repartidor_id, parseInt(query.repartidor_id)));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [movements, summary] = await Promise.all([
    db
      .select()
      .from(movimientosEfectivo)
      .where(where)
      .orderBy(desc(movimientosEfectivo.fecha))
      .limit(limit)
      .offset(offset),
    db
      .select({
        tipo: movimientosEfectivo.tipo,
        moneda: movimientosEfectivo.moneda,
        total: sql<number>`coalesce(sum(monto), 0)`,
      })
      .from(movimientosEfectivo)
      .where(where)
      .groupBy(movimientosEfectivo.tipo, movimientosEfectivo.moneda),
  ]);

  return c.json({
    success: true,
    data: {
      items: movements,
      resumen: summary,
    },
  });
});

// GET /api/reportes/contabilidad - Accounting ledger report
reportesRoutes.get('/contabilidad', validateQuery(reportFiltersSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const limit = parseInt(query.limit || '100');
  const offset = parseInt(query.offset || '0');

  const whereConditions = [];

  if (query.fecha_inicio) {
    whereConditions.push(gte(movimientosContables.fecha, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    whereConditions.push(lte(movimientosContables.fecha, query.fecha_fin));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [entries, summary] = await Promise.all([
    db
      .select()
      .from(movimientosContables)
      .where(where)
      .orderBy(desc(movimientosContables.fecha))
      .limit(limit)
      .offset(offset),
    db
      .select({
        tipo: movimientosContables.tipo,
        total: sql<number>`coalesce(sum(monto), 0)`,
        cantidad: sql<number>`count(*)`,
      })
      .from(movimientosContables)
      .where(where)
      .groupBy(movimientosContables.tipo),
  ]);

  return c.json({
    success: true,
    data: {
      items: entries,
      resumen: summary,
    },
  });
});

// GET /api/reportes/diario - Daily report
reportesRoutes.get('/diario', async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  // Default to today if no date specified
  const fecha = query.fecha || new Date().toISOString().split('T')[0];
  const fechaInicio = `${fecha}T00:00:00.000Z`;
  const fechaFin = `${fecha}T23:59:59.999Z`;

  const [remesasHoy, entregasHoy, solicitudesHoy, movimientosHoy] = await Promise.all([
    // All remittances created today
    db
      .select({
        total: sql<number>`count(*)`,
        total_monto_envio: sql<number>`coalesce(sum(monto_envio), 0)`,
        total_monto_entrega: sql<number>`coalesce(sum(monto_entrega), 0)`,
        total_comision: sql<number>`coalesce(sum(total_comision), 0)`,
      })
      .from(remesas)
      .where(
        and(gte(remesas.fecha_creacion, fechaInicio), lte(remesas.fecha_creacion, fechaFin))
      ),
    // Deliveries today
    db
      .select({
        total: sql<number>`count(*)`,
        total_monto_entrega: sql<number>`coalesce(sum(monto_entrega), 0)`,
      })
      .from(remesas)
      .where(
        and(
          eq(remesas.estado, 'entregada'),
          gte(remesas.fecha_entrega, fechaInicio),
          lte(remesas.fecha_entrega, fechaFin)
        )
      ),
    // Pending requests
    db.select({ total: sql<number>`count(*)` }).from(remesas).where(eq(remesas.estado, 'solicitud')),
    // Cash movements today
    db
      .select({
        tipo: movimientosEfectivo.tipo,
        moneda: movimientosEfectivo.moneda,
        total: sql<number>`coalesce(sum(monto), 0)`,
      })
      .from(movimientosEfectivo)
      .where(
        and(gte(movimientosEfectivo.fecha, fechaInicio), lte(movimientosEfectivo.fecha, fechaFin))
      )
      .groupBy(movimientosEfectivo.tipo, movimientosEfectivo.moneda),
  ]);

  return c.json({
    success: true,
    data: {
      fecha,
      remesas_creadas: remesasHoy[0],
      entregas: entregasHoy[0],
      solicitudes_pendientes: solicitudesHoy[0]?.total || 0,
      movimientos_efectivo: movimientosHoy,
    },
  });
});

// GET /api/reportes/balance - Balance general report
reportesRoutes.get('/balance', async (c) => {
  const db = c.get('db');

  // Get all repartidores with balances
  const repartidores = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      saldo_usd: usuarios.saldo_usd,
      saldo_cup: usuarios.saldo_cup,
    })
    .from(usuarios)
    .where(eq(usuarios.rol, 'repartidor'));

  // Get all revendedores with pending balances
  const revendedores = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      saldo_pendiente: usuarios.saldo_pendiente,
      comision_revendedor: usuarios.comision_revendedor,
    })
    .from(usuarios)
    .where(eq(usuarios.rol, 'revendedor'));

  // Calculate totals
  const totalUsdRepartidores = repartidores.reduce((sum, r) => sum + (r.saldo_usd || 0), 0);
  const totalCupRepartidores = repartidores.reduce((sum, r) => sum + (r.saldo_cup || 0), 0);
  const totalPendienteRevendedores = revendedores.reduce(
    (sum, r) => sum + (r.saldo_pendiente || 0),
    0
  );

  // Get pending remesas stats
  const [pendientes] = await db
    .select({
      count: sql<number>`count(*)`,
      total_monto_envio: sql<number>`coalesce(sum(monto_envio), 0)`,
      total_monto_entrega: sql<number>`coalesce(sum(monto_entrega), 0)`,
    })
    .from(remesas)
    .where(eq(remesas.estado, 'pendiente'));

  const [enProceso] = await db
    .select({
      count: sql<number>`count(*)`,
      total_monto_envio: sql<number>`coalesce(sum(monto_envio), 0)`,
      total_monto_entrega: sql<number>`coalesce(sum(monto_entrega), 0)`,
    })
    .from(remesas)
    .where(eq(remesas.estado, 'en_proceso'));

  return c.json({
    success: true,
    data: {
      repartidores: {
        items: repartidores,
        totales: {
          usd: totalUsdRepartidores,
          cup: totalCupRepartidores,
        },
      },
      revendedores: {
        items: revendedores,
        total_pendiente: totalPendienteRevendedores,
      },
      remesas: {
        pendientes: pendientes,
        en_proceso: enProceso,
      },
    },
  });
});

// GET /api/reportes/ingresos - Income report
reportesRoutes.get('/ingresos', validateQuery(reportFiltersSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  const whereConditions = [];

  if (query.fecha_inicio) {
    whereConditions.push(gte(remesas.fecha_creacion, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    whereConditions.push(lte(remesas.fecha_creacion, query.fecha_fin));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Get income by type
  const [byTipo, byEstado, comisionesRevendedor] = await Promise.all([
    // By delivery type
    db
      .select({
        tipo_entrega: remesas.tipo_entrega,
        count: sql<number>`count(*)`,
        total_comision: sql<number>`coalesce(sum(total_comision), 0)`,
        total_cobrado: sql<number>`coalesce(sum(total_cobrado), 0)`,
      })
      .from(remesas)
      .where(where)
      .groupBy(remesas.tipo_entrega),
    // By status
    db
      .select({
        estado: remesas.estado,
        count: sql<number>`count(*)`,
        total_comision: sql<number>`coalesce(sum(total_comision), 0)`,
      })
      .from(remesas)
      .where(where)
      .groupBy(remesas.estado),
    // Platform commissions from resellers
    db
      .select({
        total_comision_plataforma: sql<number>`coalesce(sum(comision_plataforma), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(remesas)
      .where(
        whereConditions.length > 0
          ? and(...whereConditions, sql`revendedor_id IS NOT NULL`)
          : sql`revendedor_id IS NOT NULL`
      ),
  ]);

  return c.json({
    success: true,
    data: {
      por_tipo: byTipo,
      por_estado: byEstado,
      comisiones_revendedores: comisionesRevendedor[0],
    },
  });
});

// GET /api/reportes/exportar - Export data as CSV
reportesRoutes.get('/exportar', validateQuery(reportFiltersSchema), async (c) => {
  const db = c.get('db');
  const query = c.req.query();
  const tipo = query.tipo || 'remesas';

  const whereConditions = [];

  if (query.fecha_inicio) {
    whereConditions.push(gte(remesas.fecha_creacion, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    whereConditions.push(lte(remesas.fecha_creacion, query.fecha_fin));
  }
  if (query.estado) {
    whereConditions.push(eq(remesas.estado, query.estado as any));
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  let csvContent = '';
  let filename = '';

  if (tipo === 'remesas') {
    const data = await db.select().from(remesas).where(where).orderBy(desc(remesas.fecha_creacion));

    // CSV header
    csvContent =
      'Codigo,Estado,Tipo Entrega,Remitente,Tel Remitente,Beneficiario,Tel Beneficiario,Direccion,Monto Envio,Tasa,Monto Entrega,Moneda Entrega,Comision,Total Cobrado,Fecha Creacion,Fecha Entrega\n';

    // CSV rows
    for (const r of data) {
      csvContent += `"${r.codigo}","${r.estado}","${r.tipo_entrega}","${r.remitente_nombre}","${r.remitente_telefono}","${r.beneficiario_nombre}","${r.beneficiario_telefono}","${r.beneficiario_direccion}",${r.monto_envio},${r.tasa_cambio},${r.monto_entrega},"${r.moneda_entrega}",${r.total_comision},${r.total_cobrado},"${r.fecha_creacion}","${r.fecha_entrega || ''}"\n`;
    }

    filename = `remesas_${query.fecha_inicio || 'all'}_${query.fecha_fin || 'all'}.csv`;
  } else if (tipo === 'movimientos') {
    const movWhereConditions = [];
    if (query.fecha_inicio) {
      movWhereConditions.push(gte(movimientosEfectivo.fecha, query.fecha_inicio));
    }
    if (query.fecha_fin) {
      movWhereConditions.push(lte(movimientosEfectivo.fecha, query.fecha_fin));
    }
    const movWhere = movWhereConditions.length > 0 ? and(...movWhereConditions) : undefined;

    const data = await db
      .select()
      .from(movimientosEfectivo)
      .where(movWhere)
      .orderBy(desc(movimientosEfectivo.fecha));

    // CSV header
    csvContent =
      'ID,Repartidor ID,Tipo,Moneda,Monto,Saldo Anterior,Saldo Nuevo,Tasa Cambio,Remesa ID,Notas,Fecha\n';

    // CSV rows
    for (const m of data) {
      csvContent += `${m.id},${m.repartidor_id},"${m.tipo}","${m.moneda}",${m.monto},${m.saldo_anterior},${m.saldo_nuevo},${m.tasa_cambio || ''},"${m.remesa_id || ''}","${m.notas || ''}","${m.fecha}"\n`;
    }

    filename = `movimientos_${query.fecha_inicio || 'all'}_${query.fecha_fin || 'all'}.csv`;
  } else if (tipo === 'pagos_revendedor') {
    const pagosWhereConditions = [];
    if (query.fecha_inicio) {
      pagosWhereConditions.push(gte(pagosRevendedor.fecha, query.fecha_inicio));
    }
    if (query.fecha_fin) {
      pagosWhereConditions.push(lte(pagosRevendedor.fecha, query.fecha_fin));
    }
    const pagosWhere = pagosWhereConditions.length > 0 ? and(...pagosWhereConditions) : undefined;

    const data = await db
      .select()
      .from(pagosRevendedor)
      .where(pagosWhere)
      .orderBy(desc(pagosRevendedor.fecha));

    // CSV header
    csvContent = 'ID,Revendedor ID,Monto,Metodo Pago,Referencia,Notas,Fecha\n';

    // CSV rows
    for (const p of data) {
      csvContent += `${p.id},${p.revendedor_id},${p.monto},"${p.metodo_pago}","${p.referencia || ''}","${p.notas || ''}","${p.fecha}"\n`;
    }

    filename = `pagos_revendedor_${query.fecha_inicio || 'all'}_${query.fecha_fin || 'all'}.csv`;
  }

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
