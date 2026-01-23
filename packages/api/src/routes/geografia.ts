/**
 * Geography API Routes
 * Provides Cuba province and municipality data
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { provincias, municipios } from '../db/schema';

export const geografiaRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/geografia/provincias - List all active provinces
geografiaRoutes.get('/provincias', async (c) => {
  const db = c.get('db');

  const result = await db
    .select({
      id: provincias.id,
      nombre: provincias.nombre,
      codigo: provincias.codigo,
    })
    .from(provincias)
    .where(eq(provincias.activa, true))
    .orderBy(provincias.nombre);

  return c.json({
    success: true,
    data: result,
  });
});

// GET /api/geografia/provincias/:id - Get province by ID with municipalities
geografiaRoutes.get('/provincias/:id', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID de provincia inválido' },
      400
    );
  }

  const [provincia] = await db
    .select({
      id: provincias.id,
      nombre: provincias.nombre,
      codigo: provincias.codigo,
    })
    .from(provincias)
    .where(eq(provincias.id, id))
    .limit(1);

  if (!provincia) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Provincia no encontrada' },
      404
    );
  }

  const municipiosList = await db
    .select({
      id: municipios.id,
      nombre: municipios.nombre,
      codigo_postal: municipios.codigo_postal,
    })
    .from(municipios)
    .where(and(eq(municipios.provincia_id, id), eq(municipios.activo, true)))
    .orderBy(municipios.nombre);

  return c.json({
    success: true,
    data: {
      ...provincia,
      municipios: municipiosList,
    },
  });
});

// GET /api/geografia/provincias/:id/municipios - List municipalities for a province
geografiaRoutes.get('/provincias/:id/municipios', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID de provincia inválido' },
      400
    );
  }

  const municipiosList = await db
    .select({
      id: municipios.id,
      nombre: municipios.nombre,
      codigo_postal: municipios.codigo_postal,
    })
    .from(municipios)
    .where(and(eq(municipios.provincia_id, id), eq(municipios.activo, true)))
    .orderBy(municipios.nombre);

  return c.json({
    success: true,
    data: municipiosList,
  });
});

// GET /api/geografia/municipios/:id - Get municipality by ID
geografiaRoutes.get('/municipios/:id', async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);

  if (isNaN(id)) {
    return c.json(
      { success: false, error: 'Invalid ID', message: 'ID de municipio inválido' },
      400
    );
  }

  const [municipio] = await db
    .select({
      id: municipios.id,
      nombre: municipios.nombre,
      codigo_postal: municipios.codigo_postal,
      provincia_id: municipios.provincia_id,
    })
    .from(municipios)
    .where(eq(municipios.id, id))
    .limit(1);

  if (!municipio) {
    return c.json(
      { success: false, error: 'Not Found', message: 'Municipio no encontrado' },
      404
    );
  }

  // Get province info
  const [provincia] = await db
    .select({
      id: provincias.id,
      nombre: provincias.nombre,
      codigo: provincias.codigo,
    })
    .from(provincias)
    .where(eq(provincias.id, municipio.provincia_id))
    .limit(1);

  return c.json({
    success: true,
    data: {
      ...municipio,
      provincia,
    },
  });
});

// GET /api/geografia/buscar - Search provinces and municipalities
geografiaRoutes.get('/buscar', async (c) => {
  const db = c.get('db');
  const query = c.req.query('q')?.toLowerCase() || '';

  if (query.length < 2) {
    return c.json(
      { success: false, error: 'Invalid Query', message: 'La búsqueda debe tener al menos 2 caracteres' },
      400
    );
  }

  // Search provinces
  const allProvincias = await db
    .select({
      id: provincias.id,
      nombre: provincias.nombre,
      codigo: provincias.codigo,
    })
    .from(provincias)
    .where(eq(provincias.activa, true));

  const matchedProvincias = allProvincias.filter(
    (p) =>
      p.nombre.toLowerCase().includes(query) ||
      p.codigo.toLowerCase().includes(query)
  );

  // Search municipalities
  const allMunicipios = await db
    .select({
      id: municipios.id,
      nombre: municipios.nombre,
      provincia_id: municipios.provincia_id,
    })
    .from(municipios)
    .where(eq(municipios.activo, true));

  const matchedMunicipios = allMunicipios
    .filter((m) => m.nombre.toLowerCase().includes(query))
    .slice(0, 20);

  // Enrich municipalities with province info
  const enrichedMunicipios = matchedMunicipios.map((m) => {
    const provincia = allProvincias.find((p) => p.id === m.provincia_id);
    return {
      ...m,
      provincia_nombre: provincia?.nombre || '',
    };
  });

  return c.json({
    success: true,
    data: {
      provincias: matchedProvincias,
      municipios: enrichedMunicipios,
    },
  });
});
