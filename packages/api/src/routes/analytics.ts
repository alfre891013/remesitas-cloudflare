/**
 * Analytics API Routes
 * Provides aggregated analytics data for dashboards and reporting
 */

import { Hono } from 'hono';
import { eq, desc, and, sql, gte, lte, count } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { remesas, usuarios, movimientosEfectivo, facturas } from '../db/schema';

export const analyticsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
analyticsRoutes.use('*', authMiddleware);
analyticsRoutes.use('*', adminMiddleware);

// GET /api/analytics/overview - Get comprehensive overview stats
analyticsRoutes.get('/overview', async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  // Date range (default: last 30 days)
  const fechaFin = query.fecha_fin || new Date().toISOString().split('T')[0];
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const fechaInicio = query.fecha_inicio || defaultStart.toISOString().split('T')[0];

  const dateConditions = and(
    gte(remesas.fecha_creacion, `${fechaInicio}T00:00:00`),
    lte(remesas.fecha_creacion, `${fechaFin}T23:59:59`)
  );

  const [
    totals,
    byStatus,
    byType,
    activeUsers,
  ] = await Promise.all([
    // Overall totals
    db
      .select({
        total_remesas: sql<number>`count(*)`,
        total_usd_enviado: sql<number>`coalesce(sum(monto_envio), 0)`,
        total_cup_entregado: sql<number>`coalesce(sum(CASE WHEN moneda_entrega = 'CUP' THEN monto_entrega ELSE 0 END), 0)`,
        total_usd_entregado: sql<number>`coalesce(sum(CASE WHEN moneda_entrega = 'USD' THEN monto_entrega ELSE 0 END), 0)`,
        total_comisiones: sql<number>`coalesce(sum(total_comision), 0)`,
        promedio_envio: sql<number>`coalesce(avg(monto_envio), 0)`,
      })
      .from(remesas)
      .where(dateConditions),

    // By status
    db
      .select({
        estado: remesas.estado,
        count: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(monto_envio), 0)`,
      })
      .from(remesas)
      .where(dateConditions)
      .groupBy(remesas.estado),

    // By delivery type
    db
      .select({
        tipo_entrega: remesas.tipo_entrega,
        count: sql<number>`count(*)`,
        total_usd: sql<number>`coalesce(sum(monto_envio), 0)`,
        total_comision: sql<number>`coalesce(sum(total_comision), 0)`,
      })
      .from(remesas)
      .where(dateConditions)
      .groupBy(remesas.tipo_entrega),

    // Active users
    db
      .select({
        rol: usuarios.rol,
        count: sql<number>`count(*)`,
      })
      .from(usuarios)
      .where(eq(usuarios.activo, true))
      .groupBy(usuarios.rol),
  ]);

  // Calculate growth (compare to previous period)
  const prevEnd = new Date(fechaInicio);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const periodLength = Math.ceil(
    (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)
  );
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - periodLength);

  const [prevTotals] = await db
    .select({
      total_remesas: sql<number>`count(*)`,
      total_usd: sql<number>`coalesce(sum(monto_envio), 0)`,
    })
    .from(remesas)
    .where(
      and(
        gte(remesas.fecha_creacion, prevStart.toISOString()),
        lte(remesas.fecha_creacion, prevEnd.toISOString())
      )
    );

  const growth = {
    remesas_percent: prevTotals.total_remesas > 0
      ? ((totals[0].total_remesas - prevTotals.total_remesas) / prevTotals.total_remesas) * 100
      : 100,
    volumen_percent: prevTotals.total_usd > 0
      ? ((totals[0].total_usd_enviado - prevTotals.total_usd) / prevTotals.total_usd) * 100
      : 100,
  };

  return c.json({
    success: true,
    data: {
      periodo: { inicio: fechaInicio, fin: fechaFin },
      totales: totals[0],
      por_estado: byStatus,
      por_tipo: byType,
      usuarios_activos: activeUsers,
      crecimiento: growth,
    },
  });
});

// GET /api/analytics/trends - Get time-series data for charts
analyticsRoutes.get('/trends', async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  // Date range (default: last 30 days)
  const fechaFin = query.fecha_fin || new Date().toISOString().split('T')[0];
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const fechaInicio = query.fecha_inicio || defaultStart.toISOString().split('T')[0];
  const granularity = query.granularity || 'day'; // day, week, month

  let dateFormat = '%Y-%m-%d';
  if (granularity === 'week') {
    dateFormat = '%Y-W%W';
  } else if (granularity === 'month') {
    dateFormat = '%Y-%m';
  }

  const dateConditions = and(
    gte(remesas.fecha_creacion, `${fechaInicio}T00:00:00`),
    lte(remesas.fecha_creacion, `${fechaFin}T23:59:59`)
  );

  // Time series data
  const timeSeries = await db
    .select({
      fecha: sql<string>`strftime('${sql.raw(dateFormat)}', fecha_creacion)`,
      remesas: sql<number>`count(*)`,
      volumen_usd: sql<number>`coalesce(sum(monto_envio), 0)`,
      comisiones: sql<number>`coalesce(sum(total_comision), 0)`,
      entregas: sql<number>`sum(CASE WHEN estado = 'entregada' OR estado = 'facturada' THEN 1 ELSE 0 END)`,
    })
    .from(remesas)
    .where(dateConditions)
    .groupBy(sql`strftime('${sql.raw(dateFormat)}', fecha_creacion)`)
    .orderBy(sql`strftime('${sql.raw(dateFormat)}', fecha_creacion)`);

  return c.json({
    success: true,
    data: {
      periodo: { inicio: fechaInicio, fin: fechaFin, granularity },
      series: timeSeries,
    },
  });
});

// GET /api/analytics/top - Get top performers (repartidores, revendedores)
analyticsRoutes.get('/top', async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  // Date range (default: last 30 days)
  const fechaFin = query.fecha_fin || new Date().toISOString().split('T')[0];
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const fechaInicio = query.fecha_inicio || defaultStart.toISOString().split('T')[0];
  const limit = parseInt(query.limit || '10', 10);

  const dateConditions = and(
    gte(remesas.fecha_creacion, `${fechaInicio}T00:00:00`),
    lte(remesas.fecha_creacion, `${fechaFin}T23:59:59`)
  );

  // Top repartidores by deliveries
  const topRepartidores = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      entregas: sql<number>`count(*)`,
      volumen_usd: sql<number>`coalesce(sum(${remesas.monto_envio}), 0)`,
    })
    .from(remesas)
    .innerJoin(usuarios, eq(remesas.repartidor_id, usuarios.id))
    .where(and(dateConditions, eq(remesas.estado, 'entregada')))
    .groupBy(usuarios.id, usuarios.nombre)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  // Top revendedores by volume
  const topRevendedores = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      remesas: sql<number>`count(*)`,
      volumen_usd: sql<number>`coalesce(sum(${remesas.monto_envio}), 0)`,
      comision_plataforma: sql<number>`coalesce(sum(${remesas.comision_plataforma}), 0)`,
    })
    .from(remesas)
    .innerJoin(usuarios, eq(remesas.revendedor_id, usuarios.id))
    .where(dateConditions)
    .groupBy(usuarios.id, usuarios.nombre)
    .orderBy(desc(sql`sum(${remesas.monto_envio})`))
    .limit(limit);

  // Top remitentes (frequent senders)
  const topRemitentes = await db
    .select({
      nombre: remesas.remitente_nombre,
      telefono: remesas.remitente_telefono,
      remesas: sql<number>`count(*)`,
      volumen_usd: sql<number>`coalesce(sum(monto_envio), 0)`,
    })
    .from(remesas)
    .where(dateConditions)
    .groupBy(remesas.remitente_telefono, remesas.remitente_nombre)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return c.json({
    success: true,
    data: {
      periodo: { inicio: fechaInicio, fin: fechaFin },
      top_repartidores: topRepartidores,
      top_revendedores: topRevendedores,
      top_remitentes: topRemitentes,
    },
  });
});

// GET /api/analytics/geography - Get geographic distribution
analyticsRoutes.get('/geography', async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  // Date range (default: last 30 days)
  const fechaFin = query.fecha_fin || new Date().toISOString().split('T')[0];
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const fechaInicio = query.fecha_inicio || defaultStart.toISOString().split('T')[0];

  const dateConditions = and(
    gte(remesas.fecha_creacion, `${fechaInicio}T00:00:00`),
    lte(remesas.fecha_creacion, `${fechaFin}T23:59:59`)
  );

  // By province (if available)
  const byProvince = await db
    .select({
      provincia_id: remesas.beneficiario_provincia_id,
      remesas: sql<number>`count(*)`,
      volumen_usd: sql<number>`coalesce(sum(monto_envio), 0)`,
    })
    .from(remesas)
    .where(and(dateConditions, sql`${remesas.beneficiario_provincia_id} IS NOT NULL`))
    .groupBy(remesas.beneficiario_provincia_id)
    .orderBy(desc(sql`count(*)`));

  return c.json({
    success: true,
    data: {
      periodo: { inicio: fechaInicio, fin: fechaFin },
      por_provincia: byProvince,
    },
  });
});

// GET /api/analytics/realtime - Get real-time stats
analyticsRoutes.get('/realtime', async (c) => {
  const db = c.get('db');

  // Today's data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const [
    remesasHoy,
    entregasHoy,
    pendientes,
    enProceso,
    solicitudes,
  ] = await Promise.all([
    // Remesas created today
    db
      .select({
        count: sql<number>`count(*)`,
        volumen: sql<number>`coalesce(sum(monto_envio), 0)`,
      })
      .from(remesas)
      .where(gte(remesas.fecha_creacion, todayStr)),

    // Deliveries completed today
    db
      .select({
        count: sql<number>`count(*)`,
        volumen: sql<number>`coalesce(sum(monto_envio), 0)`,
      })
      .from(remesas)
      .where(and(eq(remesas.estado, 'entregada'), gte(remesas.fecha_entrega, todayStr))),

    // Pending remittances
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(eq(remesas.estado, 'pendiente')),

    // In process
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(eq(remesas.estado, 'en_proceso')),

    // Pending solicitudes
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(eq(remesas.estado, 'solicitud')),
  ]);

  return c.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      hoy: {
        remesas: remesasHoy[0]?.count || 0,
        volumen_usd: remesasHoy[0]?.volumen || 0,
        entregas: entregasHoy[0]?.count || 0,
        volumen_entregas: entregasHoy[0]?.volumen || 0,
      },
      cola: {
        solicitudes: solicitudes[0]?.count || 0,
        pendientes: pendientes[0]?.count || 0,
        en_proceso: enProceso[0]?.count || 0,
      },
    },
  });
});

// GET /api/analytics/kpis - Get key performance indicators
analyticsRoutes.get('/kpis', async (c) => {
  const db = c.get('db');
  const query = c.req.query();

  // Date range (default: last 30 days)
  const fechaFin = query.fecha_fin || new Date().toISOString().split('T')[0];
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const fechaInicio = query.fecha_inicio || defaultStart.toISOString().split('T')[0];

  const dateConditions = and(
    gte(remesas.fecha_creacion, `${fechaInicio}T00:00:00`),
    lte(remesas.fecha_creacion, `${fechaFin}T23:59:59`)
  );

  const [
    deliveryStats,
    totalRemesas,
    cancelledRemesas,
  ] = await Promise.all([
    // Average delivery time (for delivered remesas)
    db
      .select({
        avg_delivery_hours: sql<number>`avg(
          (julianday(fecha_entrega) - julianday(fecha_creacion)) * 24
        )`,
      })
      .from(remesas)
      .where(
        and(
          dateConditions,
          eq(remesas.estado, 'entregada'),
          sql`${remesas.fecha_entrega} IS NOT NULL`
        )
      ),

    // Total remesas
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(dateConditions),

    // Cancelled remesas
    db
      .select({ count: sql<number>`count(*)` })
      .from(remesas)
      .where(and(dateConditions, eq(remesas.estado, 'cancelada'))),
  ]);

  // Calculate KPIs
  const totalCount = totalRemesas[0]?.count || 0;
  const cancelledCount = cancelledRemesas[0]?.count || 0;
  const successRate = totalCount > 0 ? ((totalCount - cancelledCount) / totalCount) * 100 : 100;
  const avgDeliveryTime = deliveryStats[0]?.avg_delivery_hours || 0;

  return c.json({
    success: true,
    data: {
      periodo: { inicio: fechaInicio, fin: fechaFin },
      kpis: {
        tasa_exito: Math.round(successRate * 100) / 100,
        tiempo_entrega_promedio_horas: Math.round(avgDeliveryTime * 100) / 100,
        total_remesas: totalCount,
        remesas_canceladas: cancelledCount,
      },
    },
  });
});
