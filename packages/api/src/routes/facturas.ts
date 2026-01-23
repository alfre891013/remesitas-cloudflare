/**
 * Invoices API Routes
 * Manages invoice generation and management
 */

import { Hono } from 'hono';
import { eq, and, desc, sql, gte, lte, like } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  facturas,
  lineasFactura,
  tiposFactura,
  remesas,
  usuarios,
  pagosRevendedor,
} from '../db/schema';
import { z } from 'zod';
import { createPDFService } from '../services/pdf.service';

export const facturasRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth to all routes
facturasRoutes.use('*', authMiddleware);

// ============ Validation Schemas ============

const facturaCreateSchema = z.object({
  tipo_factura_id: z.number().positive(),
  remesa_id: z.number().positive().optional().nullable(),
  usuario_id: z.number().positive().optional().nullable(),
  pago_revendedor_id: z.number().positive().optional().nullable(),
  subtotal: z.number().min(0),
  descuento: z.number().min(0).optional().default(0),
  impuesto: z.number().min(0).optional().default(0),
  total: z.number().min(0),
  moneda: z.string().default('USD'),
  notas: z.string().max(500).optional(),
  condiciones: z.string().max(1000).optional(),
  lineas: z
    .array(
      z.object({
        descripcion: z.string().min(1).max(500),
        cantidad: z.number().positive().default(1),
        precio_unitario: z.number().min(0),
        subtotal: z.number().min(0),
      })
    )
    .optional(),
});

const facturaUpdateSchema = z.object({
  estado: z.enum(['borrador', 'emitida', 'pagada', 'cancelada', 'anulada']).optional(),
  notas: z.string().max(500).optional(),
  fecha_pago: z.string().optional(),
});

// ============ Invoice Types ============

// GET /api/facturas/tipos - List invoice types
facturasRoutes.get('/tipos', async (c) => {
  const db = c.get('db');

  const result = await db.select().from(tiposFactura).orderBy(tiposFactura.id);

  return c.json({
    success: true,
    data: result,
  });
});

// ============ Invoices CRUD ============

// GET /api/facturas - List invoices
facturasRoutes.get('/', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query();

  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [];

  // Non-admin users can only see their own invoices
  if (auth.rol !== 'admin') {
    conditions.push(eq(facturas.usuario_id, auth.userId));
  }

  // Filters
  if (query.estado) {
    conditions.push(eq(facturas.estado, query.estado as any));
  }
  if (query.tipo_factura_id) {
    conditions.push(eq(facturas.tipo_factura_id, parseInt(query.tipo_factura_id, 10)));
  }
  if (query.fecha_inicio) {
    conditions.push(gte(facturas.fecha_emision, query.fecha_inicio));
  }
  if (query.fecha_fin) {
    conditions.push(lte(facturas.fecha_emision, query.fecha_fin));
  }
  if (query.numero) {
    conditions.push(like(facturas.numero, `%${query.numero}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Execute queries
  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(facturas)
      .where(where)
      .orderBy(desc(facturas.fecha_emision))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(facturas)
      .where(where),
  ]);

  // Enrich with tipo and usuario info
  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const [tipo, usuario, remesa] = await Promise.all([
        db
          .select({ nombre: tiposFactura.nombre })
          .from(tiposFactura)
          .where(eq(tiposFactura.id, item.tipo_factura_id))
          .limit(1),
        item.usuario_id
          ? db
              .select({ nombre: usuarios.nombre })
              .from(usuarios)
              .where(eq(usuarios.id, item.usuario_id))
              .limit(1)
          : Promise.resolve([]),
        item.remesa_id
          ? db
              .select({ codigo: remesas.codigo })
              .from(remesas)
              .where(eq(remesas.id, item.remesa_id))
              .limit(1)
          : Promise.resolve([]),
      ]);

      return {
        ...item,
        tipo_nombre: tipo[0]?.nombre || '',
        usuario_nombre: usuario[0]?.nombre || null,
        remesa_codigo: remesa[0]?.codigo || null,
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

// GET /api/facturas/:id - Get invoice by ID
facturasRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID inválido' },
      400
    );
  }

  const [factura] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!factura) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Factura no encontrada' },
      404
    );
  }

  // Check access
  if (auth.rol !== 'admin' && factura.usuario_id !== auth.userId) {
    return c.json(
      { success: false, error: 'Forbidden', message: 'No autorizado' },
      403
    );
  }

  // Get related data
  const [tipo, lineas, remesa, usuario] = await Promise.all([
    db
      .select()
      .from(tiposFactura)
      .where(eq(tiposFactura.id, factura.tipo_factura_id))
      .limit(1),
    db
      .select()
      .from(lineasFactura)
      .where(eq(lineasFactura.factura_id, id))
      .orderBy(lineasFactura.orden),
    factura.remesa_id
      ? db
          .select()
          .from(remesas)
          .where(eq(remesas.id, factura.remesa_id))
          .limit(1)
      : Promise.resolve([]),
    factura.usuario_id
      ? db
          .select({
            id: usuarios.id,
            nombre: usuarios.nombre,
            telefono: usuarios.telefono,
          })
          .from(usuarios)
          .where(eq(usuarios.id, factura.usuario_id))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return c.json({
    success: true,
    data: {
      ...factura,
      tipo: tipo[0] || null,
      lineas,
      remesa: remesa[0] || null,
      usuario: usuario[0] || null,
    },
  });
});

// POST /api/facturas - Create invoice (admin only)
facturasRoutes.post('/', adminMiddleware, validateBody(facturaCreateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  // Get tipo to generate numero
  const [tipo] = await db
    .select()
    .from(tiposFactura)
    .where(eq(tiposFactura.id, body.tipo_factura_id))
    .limit(1);

  if (!tipo) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Tipo de factura no encontrado' },
      404
    );
  }

  // Generate invoice number
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');

  // Get count for this type this month
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(facturas)
    .where(
      and(
        eq(facturas.tipo_factura_id, body.tipo_factura_id),
        like(facturas.numero, `${tipo.prefijo_numero}-${year}${month}%`)
      )
    );

  const sequence = String((countResult?.count || 0) + 1).padStart(4, '0');
  const numero = `${tipo.prefijo_numero}-${year}${month}-${sequence}`;

  // Calculate due date (30 days default)
  const fechaVencimiento = new Date();
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

  // Create invoice
  const [created] = await db
    .insert(facturas)
    .values({
      numero,
      tipo_factura_id: body.tipo_factura_id,
      remesa_id: body.remesa_id || null,
      usuario_id: body.usuario_id || null,
      pago_revendedor_id: body.pago_revendedor_id || null,
      subtotal: body.subtotal,
      descuento: body.descuento || 0,
      impuesto: body.impuesto || 0,
      total: body.total,
      moneda: body.moneda || 'USD',
      notas: body.notas || null,
      condiciones: body.condiciones || null,
      fecha_vencimiento: fechaVencimiento.toISOString(),
      creado_por: auth.userId,
    })
    .returning();

  // Create line items if provided
  if (body.lineas && body.lineas.length > 0) {
    await db.insert(lineasFactura).values(
      body.lineas.map((linea: any, index: number) => ({
        factura_id: created.id,
        descripcion: linea.descripcion,
        cantidad: linea.cantidad || 1,
        precio_unitario: linea.precio_unitario,
        subtotal: linea.subtotal,
        orden: index,
      }))
    );
  }

  return c.json(
    {
      success: true,
      data: created,
      message: 'Factura creada correctamente',
    },
    201
  );
});

// PUT /api/facturas/:id - Update invoice (admin only)
facturasRoutes.put('/:id', adminMiddleware, validateBody(facturaUpdateSchema), async (c) => {
  const db = c.get('db');
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
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!existing) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Factura no encontrada' },
      404
    );
  }

  // Build update object
  const updateData: any = {};

  if (body.estado) {
    updateData.estado = body.estado;

    // Set anulación date if anulada
    if (body.estado === 'anulada') {
      updateData.fecha_anulacion = new Date().toISOString();
    }

    // Set payment date if pagada
    if (body.estado === 'pagada') {
      updateData.fecha_pago = body.fecha_pago || new Date().toISOString();
    }
  }

  if (body.notas !== undefined) updateData.notas = body.notas;

  if (Object.keys(updateData).length === 0) {
    return c.json({
      success: true,
      data: existing,
      message: 'No hay cambios',
    });
  }

  const [updated] = await db
    .update(facturas)
    .set(updateData)
    .where(eq(facturas.id, id))
    .returning();

  return c.json({
    success: true,
    data: updated,
    message: 'Factura actualizada',
  });
});

// ============ Invoice Generation Helpers ============

// POST /api/facturas/generar-remesa/:remesaId - Generate invoice for remittance
facturasRoutes.post('/generar-remesa/:remesaId', adminMiddleware, async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const remesaId = parseInt(c.req.param('remesaId'), 10);

  if (isNaN(remesaId)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID de remesa inválido' },
      400
    );
  }

  // Get remesa
  const [remesa] = await db
    .select()
    .from(remesas)
    .where(eq(remesas.id, remesaId))
    .limit(1);

  if (!remesa) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Remesa no encontrada' },
      404
    );
  }

  // Check if invoice already exists
  const [existingInvoice] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.remesa_id, remesaId))
    .limit(1);

  if (existingInvoice) {
    return c.json({
      success: true,
      data: existingInvoice,
      message: 'Factura ya existe para esta remesa',
    });
  }

  // Get tipo factura for remesa
  const [tipoRemesa] = await db
    .select()
    .from(tiposFactura)
    .where(eq(tiposFactura.codigo, 'remesa'))
    .limit(1);

  if (!tipoRemesa) {
    return c.json(
      { success: false, error: 'Config Error', message: 'Tipo de factura no configurado' },
      500
    );
  }

  // Generate invoice number
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(facturas)
    .where(
      and(
        eq(facturas.tipo_factura_id, tipoRemesa.id),
        like(facturas.numero, `${tipoRemesa.prefijo_numero}-${year}${month}%`)
      )
    );
  const sequence = String((countResult?.count || 0) + 1).padStart(4, '0');
  const numero = `${tipoRemesa.prefijo_numero}-${year}${month}-${sequence}`;

  // Calculate due date
  const fechaVencimiento = new Date();
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

  // Create invoice
  const [created] = await db
    .insert(facturas)
    .values({
      numero,
      tipo_factura_id: tipoRemesa.id,
      remesa_id: remesaId,
      usuario_id: remesa.revendedor_id || remesa.creado_por,
      subtotal: remesa.monto_envio,
      descuento: 0,
      impuesto: 0,
      total: remesa.total_cobrado,
      moneda: 'USD',
      fecha_vencimiento: fechaVencimiento.toISOString(),
      creado_por: auth.userId,
    })
    .returning();

  // Add line items
  const lineas = [
    {
      factura_id: created.id,
      descripcion: `Remesa ${remesa.codigo} - ${remesa.beneficiario_nombre}`,
      cantidad: 1,
      precio_unitario: remesa.monto_envio,
      subtotal: remesa.monto_envio,
      orden: 0,
    },
  ];

  if (remesa.total_comision > 0) {
    lineas.push({
      factura_id: created.id,
      descripcion: 'Comisión de servicio',
      cantidad: 1,
      precio_unitario: remesa.total_comision,
      subtotal: remesa.total_comision,
      orden: 1,
    });
  }

  await db.insert(lineasFactura).values(lineas);

  return c.json(
    {
      success: true,
      data: created,
      message: 'Factura generada correctamente',
    },
    201
  );
});

// ============ Statistics (Admin) ============

// GET /api/facturas/estadisticas - Get invoice statistics
facturasRoutes.get('/estadisticas', adminMiddleware, async (c) => {
  const db = c.get('db');

  const [
    totalEmitidas,
    totalPagadas,
    totalPendientes,
    montoTotal,
    montoPendiente,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(facturas)
      .where(eq(facturas.estado, 'emitida')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(facturas)
      .where(eq(facturas.estado, 'pagada')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(facturas)
      .where(eq(facturas.estado, 'emitida')),
    db
      .select({ sum: sql<number>`sum(total)` })
      .from(facturas)
      .where(eq(facturas.estado, 'pagada')),
    db
      .select({ sum: sql<number>`sum(total)` })
      .from(facturas)
      .where(eq(facturas.estado, 'emitida')),
  ]);

  return c.json({
    success: true,
    data: {
      total_emitidas: totalEmitidas[0]?.count || 0,
      total_pagadas: totalPagadas[0]?.count || 0,
      total_pendientes: totalPendientes[0]?.count || 0,
      monto_total_cobrado: montoTotal[0]?.sum || 0,
      monto_pendiente: montoPendiente[0]?.sum || 0,
    },
  });
});

// ============ PDF Generation ============

// GET /api/facturas/:id/pdf - Get invoice as HTML (for PDF generation)
facturasRoutes.get('/:id/pdf', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'), 10);
  const format = c.req.query('format') || 'html';

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID inválido' },
      400
    );
  }

  // Check invoice exists and user has access
  const [factura] = await db
    .select()
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1);

  if (!factura) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Factura no encontrada' },
      404
    );
  }

  // Check access
  if (auth.rol !== 'admin' && factura.usuario_id !== auth.userId) {
    return c.json(
      { success: false, error: 'Forbidden', message: 'No autorizado' },
      403
    );
  }

  try {
    const pdfService = createPDFService(db, c.env.STORAGE);
    const html = await pdfService.generateInvoiceHTML(id);

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
        'Content-Disposition': `inline; filename="factura-${factura.numero}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return c.json(
      { success: false, error: 'Generation Failed', message: 'Error al generar factura' },
      500
    );
  }
});
