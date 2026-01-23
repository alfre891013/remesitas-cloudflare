/**
 * Contacts API Routes
 * Manages frequent senders and beneficiaries
 */

import { Hono } from 'hono';
import { eq, and, like, or, desc, sql } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  remitentesFrecuentes,
  beneficiariosFrecuentes,
  provincias,
  municipios,
} from '../db/schema';
import { z } from 'zod';

export const contactosRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth to all routes
contactosRoutes.use('*', authMiddleware);

// ============ Validation Schemas ============

const remitenteCreateSchema = z.object({
  nombre: z.string().min(2).max(100),
  telefono: z.string().min(8).max(20),
  email: z.string().email().optional().nullable(),
});

const beneficiarioCreateSchema = z.object({
  nombre: z.string().min(2).max(100),
  telefono: z.string().min(8).max(20),
  direccion: z.string().min(5).max(300),
  provincia_id: z.number().positive().optional().nullable(),
  municipio_id: z.number().positive().optional().nullable(),
});

// ============ Remitentes (Senders) ============

// GET /api/contactos/remitentes - List frequent senders
contactosRoutes.get('/remitentes', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query('q');
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);

  let conditions = [eq(remitentesFrecuentes.usuario_id, auth.userId)];

  if (query && query.length >= 2) {
    conditions.push(
      or(
        like(remitentesFrecuentes.nombre, `%${query}%`),
        like(remitentesFrecuentes.telefono, `%${query}%`)
      )!
    );
  }

  const result = await db
    .select()
    .from(remitentesFrecuentes)
    .where(and(...conditions))
    .orderBy(desc(remitentesFrecuentes.total_remesas), remitentesFrecuentes.nombre)
    .limit(limit);

  return c.json({
    success: true,
    data: result,
  });
});

// POST /api/contactos/remitentes - Create/update frequent sender
contactosRoutes.post('/remitentes', validateBody(remitenteCreateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  // Check if already exists
  const [existing] = await db
    .select()
    .from(remitentesFrecuentes)
    .where(
      and(
        eq(remitentesFrecuentes.telefono, body.telefono),
        eq(remitentesFrecuentes.usuario_id, auth.userId)
      )
    )
    .limit(1);

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(remitentesFrecuentes)
      .set({
        nombre: body.nombre,
        email: body.email || null,
        total_remesas: existing.total_remesas + 1,
        ultima_remesa: new Date().toISOString(),
      })
      .where(eq(remitentesFrecuentes.id, existing.id))
      .returning();

    return c.json({
      success: true,
      data: updated,
      message: 'Remitente actualizado',
    });
  }

  // Create new
  const [created] = await db
    .insert(remitentesFrecuentes)
    .values({
      nombre: body.nombre,
      telefono: body.telefono,
      email: body.email || null,
      usuario_id: auth.userId,
      total_remesas: 1,
      ultima_remesa: new Date().toISOString(),
    })
    .returning();

  return c.json(
    {
      success: true,
      data: created,
      message: 'Remitente creado',
    },
    201
  );
});

// DELETE /api/contactos/remitentes/:id
contactosRoutes.delete('/remitentes/:id', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID inválido' },
      400
    );
  }

  const result = await db
    .delete(remitentesFrecuentes)
    .where(
      and(
        eq(remitentesFrecuentes.id, id),
        eq(remitentesFrecuentes.usuario_id, auth.userId)
      )
    )
    .returning();

  if (result.length === 0) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Remitente no encontrado' },
      404
    );
  }

  return c.json({
    success: true,
    message: 'Remitente eliminado',
  });
});

// ============ Beneficiarios ============

// GET /api/contactos/beneficiarios - List frequent beneficiaries
contactosRoutes.get('/beneficiarios', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query('q');
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);

  let conditions = [eq(beneficiariosFrecuentes.usuario_id, auth.userId)];

  if (query && query.length >= 2) {
    conditions.push(
      or(
        like(beneficiariosFrecuentes.nombre, `%${query}%`),
        like(beneficiariosFrecuentes.telefono, `%${query}%`),
        like(beneficiariosFrecuentes.direccion, `%${query}%`)
      )!
    );
  }

  const result = await db
    .select({
      id: beneficiariosFrecuentes.id,
      nombre: beneficiariosFrecuentes.nombre,
      telefono: beneficiariosFrecuentes.telefono,
      direccion: beneficiariosFrecuentes.direccion,
      provincia_id: beneficiariosFrecuentes.provincia_id,
      municipio_id: beneficiariosFrecuentes.municipio_id,
      total_remesas: beneficiariosFrecuentes.total_remesas,
      ultima_remesa: beneficiariosFrecuentes.ultima_remesa,
    })
    .from(beneficiariosFrecuentes)
    .where(and(...conditions))
    .orderBy(desc(beneficiariosFrecuentes.total_remesas), beneficiariosFrecuentes.nombre)
    .limit(limit);

  // Enrich with province/municipality names
  const enrichedResult = await Promise.all(
    result.map(async (b) => {
      let provincia_nombre = null;
      let municipio_nombre = null;

      if (b.provincia_id) {
        const [prov] = await db
          .select({ nombre: provincias.nombre })
          .from(provincias)
          .where(eq(provincias.id, b.provincia_id))
          .limit(1);
        provincia_nombre = prov?.nombre || null;
      }

      if (b.municipio_id) {
        const [mun] = await db
          .select({ nombre: municipios.nombre })
          .from(municipios)
          .where(eq(municipios.id, b.municipio_id))
          .limit(1);
        municipio_nombre = mun?.nombre || null;
      }

      return {
        ...b,
        provincia_nombre,
        municipio_nombre,
      };
    })
  );

  return c.json({
    success: true,
    data: enrichedResult,
  });
});

// POST /api/contactos/beneficiarios - Create/update frequent beneficiary
contactosRoutes.post('/beneficiarios', validateBody(beneficiarioCreateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  // Check if already exists
  const [existing] = await db
    .select()
    .from(beneficiariosFrecuentes)
    .where(
      and(
        eq(beneficiariosFrecuentes.telefono, body.telefono),
        eq(beneficiariosFrecuentes.direccion, body.direccion),
        eq(beneficiariosFrecuentes.usuario_id, auth.userId)
      )
    )
    .limit(1);

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(beneficiariosFrecuentes)
      .set({
        nombre: body.nombre,
        provincia_id: body.provincia_id || null,
        municipio_id: body.municipio_id || null,
        total_remesas: existing.total_remesas + 1,
        ultima_remesa: new Date().toISOString(),
      })
      .where(eq(beneficiariosFrecuentes.id, existing.id))
      .returning();

    return c.json({
      success: true,
      data: updated,
      message: 'Beneficiario actualizado',
    });
  }

  // Create new
  const [created] = await db
    .insert(beneficiariosFrecuentes)
    .values({
      nombre: body.nombre,
      telefono: body.telefono,
      direccion: body.direccion,
      provincia_id: body.provincia_id || null,
      municipio_id: body.municipio_id || null,
      usuario_id: auth.userId,
      total_remesas: 1,
      ultima_remesa: new Date().toISOString(),
    })
    .returning();

  return c.json(
    {
      success: true,
      data: created,
      message: 'Beneficiario creado',
    },
    201
  );
});

// DELETE /api/contactos/beneficiarios/:id
contactosRoutes.delete('/beneficiarios/:id', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID inválido' },
      400
    );
  }

  const result = await db
    .delete(beneficiariosFrecuentes)
    .where(
      and(
        eq(beneficiariosFrecuentes.id, id),
        eq(beneficiariosFrecuentes.usuario_id, auth.userId)
      )
    )
    .returning();

  if (result.length === 0) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Beneficiario no encontrado' },
      404
    );
  }

  return c.json({
    success: true,
    message: 'Beneficiario eliminado',
  });
});

// ============ Search All ============

// GET /api/contactos/buscar - Search both senders and beneficiaries
contactosRoutes.get('/buscar', async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const query = c.req.query('q') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50);

  if (query.length < 2) {
    return c.json({
      success: true,
      data: {
        remitentes: [],
        beneficiarios: [],
      },
    });
  }

  const [remitentes, beneficiarios] = await Promise.all([
    db
      .select()
      .from(remitentesFrecuentes)
      .where(
        and(
          eq(remitentesFrecuentes.usuario_id, auth.userId),
          or(
            like(remitentesFrecuentes.nombre, `%${query}%`),
            like(remitentesFrecuentes.telefono, `%${query}%`)
          )
        )
      )
      .orderBy(desc(remitentesFrecuentes.total_remesas))
      .limit(limit),
    db
      .select()
      .from(beneficiariosFrecuentes)
      .where(
        and(
          eq(beneficiariosFrecuentes.usuario_id, auth.userId),
          or(
            like(beneficiariosFrecuentes.nombre, `%${query}%`),
            like(beneficiariosFrecuentes.telefono, `%${query}%`)
          )
        )
      )
      .orderBy(desc(beneficiariosFrecuentes.total_remesas))
      .limit(limit),
  ]);

  return c.json({
    success: true,
    data: {
      remitentes,
      beneficiarios,
    },
  });
});
