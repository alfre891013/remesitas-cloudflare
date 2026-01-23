import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc, and, sql, gte } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { ubicacionesHistorial, dispositivosRepartidor, usuarios, remesas } from '../db/schema';
import { validateBody } from '../middleware/validate';
import { authMiddleware, adminMiddleware, repartidorMiddleware } from '../middleware/auth';

const ubicacion = new Hono<{ Bindings: Env; Variables: Variables }>();

// Schema for location update
const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  altitude: z.number().nullable().optional(),
  remesa_id: z.number().optional(),
  timestamp: z.string().optional(),
});

// Schema for device registration
const deviceRegisterSchema = z.object({
  device_id: z.string().min(1),
  nombre_dispositivo: z.string().optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  push_token: z.string().optional(),
});

// REPARTIDOR: Update current location
ubicacion.post('/', authMiddleware, repartidorMiddleware, validateBody(locationUpdateSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const data = c.req.valid('json' as never) as z.infer<typeof locationUpdateSchema>;

  try {
    // Insert location history
    await db.insert(ubicacionesHistorial).values({
      repartidor_id: auth.userId,
      remesa_id: data.remesa_id || null,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy || null,
      speed: data.speed || null,
      heading: data.heading || null,
      altitude: data.altitude || null,
      timestamp: data.timestamp || new Date().toISOString(),
      tipo: data.remesa_id ? 'tracking' : 'tracking',
    });

    // Update device's last known location
    await db
      .update(dispositivosRepartidor)
      .set({
        last_latitude: data.latitude,
        last_longitude: data.longitude,
        last_accuracy: data.accuracy || null,
        last_location_update: new Date().toISOString(),
      })
      .where(
        and(
          eq(dispositivosRepartidor.repartidor_id, auth.userId),
          eq(dispositivosRepartidor.activo, true)
        )
      );

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating location:', error);
    return c.json({ success: false, message: 'Error al actualizar ubicacion' }, 500);
  }
});

// REPARTIDOR: Register device for tracking
ubicacion.post('/dispositivo', authMiddleware, repartidorMiddleware, validateBody(deviceRegisterSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const data = c.req.valid('json' as never) as z.infer<typeof deviceRegisterSchema>;

  try {
    // Check if device already exists
    const existing = await db
      .select()
      .from(dispositivosRepartidor)
      .where(
        and(
          eq(dispositivosRepartidor.repartidor_id, auth.userId),
          eq(dispositivosRepartidor.device_id, data.device_id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing device
      await db
        .update(dispositivosRepartidor)
        .set({
          nombre_dispositivo: data.nombre_dispositivo || existing[0].nombre_dispositivo,
          platform: data.platform || existing[0].platform,
          push_token: data.push_token || existing[0].push_token,
          activo: true,
        })
        .where(eq(dispositivosRepartidor.id, existing[0].id));

      return c.json({ success: true, data: { id: existing[0].id } });
    }

    // Insert new device
    const [result] = await db.insert(dispositivosRepartidor).values({
      repartidor_id: auth.userId,
      device_id: data.device_id,
      nombre_dispositivo: data.nombre_dispositivo || null,
      platform: data.platform || 'web',
      push_token: data.push_token || null,
      compartir_ubicacion: false,
      activo: true,
    }).returning();

    return c.json({ success: true, data: { id: result.id } });
  } catch (error) {
    console.error('Error registering device:', error);
    return c.json({ success: false, message: 'Error al registrar dispositivo' }, 500);
  }
});

// REPARTIDOR: Toggle location sharing
ubicacion.put('/compartir', authMiddleware, repartidorMiddleware, async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const { compartir } = await c.req.json();

  try {
    await db
      .update(dispositivosRepartidor)
      .set({
        compartir_ubicacion: compartir === true,
      })
      .where(
        and(
          eq(dispositivosRepartidor.repartidor_id, auth.userId),
          eq(dispositivosRepartidor.activo, true)
        )
      );

    return c.json({ success: true });
  } catch (error) {
    console.error('Error toggling location sharing:', error);
    return c.json({ success: false, message: 'Error al cambiar configuracion' }, 500);
  }
});

// REPARTIDOR: Get own location history
ubicacion.get('/historial', authMiddleware, repartidorMiddleware, async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const remesaId = c.req.query('remesa_id');

  try {
    const conditions = [eq(ubicacionesHistorial.repartidor_id, auth.userId)];

    if (remesaId) {
      conditions.push(eq(ubicacionesHistorial.remesa_id, parseInt(remesaId, 10)));
    }

    const locations = await db
      .select()
      .from(ubicacionesHistorial)
      .where(and(...conditions))
      .orderBy(desc(ubicacionesHistorial.timestamp))
      .limit(limit);

    return c.json({ success: true, data: locations });
  } catch (error) {
    console.error('Error fetching location history:', error);
    return c.json({ success: false, message: 'Error al cargar historial' }, 500);
  }
});

// ADMIN: Get all repartidor locations
ubicacion.get('/repartidores', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');

  try {
    const repartidores = await db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        telefono: usuarios.telefono,
        last_latitude: dispositivosRepartidor.last_latitude,
        last_longitude: dispositivosRepartidor.last_longitude,
        last_accuracy: dispositivosRepartidor.last_accuracy,
        last_location_update: dispositivosRepartidor.last_location_update,
        compartir_ubicacion: dispositivosRepartidor.compartir_ubicacion,
      })
      .from(usuarios)
      .leftJoin(
        dispositivosRepartidor,
        and(
          eq(usuarios.id, dispositivosRepartidor.repartidor_id),
          eq(dispositivosRepartidor.activo, true)
        )
      )
      .where(
        and(
          eq(usuarios.rol, 'repartidor'),
          eq(usuarios.activo, true)
        )
      );

    return c.json({ success: true, data: repartidores });
  } catch (error) {
    console.error('Error fetching repartidor locations:', error);
    return c.json({ success: false, message: 'Error al cargar ubicaciones' }, 500);
  }
});

// ADMIN: Get specific repartidor location
ubicacion.get('/repartidor/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const repartidorId = parseInt(c.req.param('id'), 10);

  try {
    // Get current location
    const device = await db
      .select()
      .from(dispositivosRepartidor)
      .where(
        and(
          eq(dispositivosRepartidor.repartidor_id, repartidorId),
          eq(dispositivosRepartidor.activo, true)
        )
      )
      .limit(1);

    // Get recent history (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const history = await db
      .select()
      .from(ubicacionesHistorial)
      .where(
        and(
          eq(ubicacionesHistorial.repartidor_id, repartidorId),
          gte(ubicacionesHistorial.timestamp, oneHourAgo)
        )
      )
      .orderBy(desc(ubicacionesHistorial.timestamp))
      .limit(100);

    return c.json({
      success: true,
      data: {
        current: device[0] || null,
        history,
      },
    });
  } catch (error) {
    console.error('Error fetching repartidor location:', error);
    return c.json({ success: false, message: 'Error al cargar ubicacion' }, 500);
  }
});

// PUBLIC: Get remesa delivery location (for tracking)
ubicacion.get('/remesa/:codigo', async (c) => {
  const db = c.get('db');
  const codigo = c.req.param('codigo');

  try {
    // Find the remesa
    const remesa = await db
      .select({
        id: remesas.id,
        codigo: remesas.codigo,
        estado: remesas.estado,
        repartidor_id: remesas.repartidor_id,
        beneficiario_direccion: remesas.beneficiario_direccion,
      })
      .from(remesas)
      .where(eq(remesas.codigo, codigo))
      .limit(1);

    if (remesa.length === 0) {
      return c.json({ success: false, message: 'Remesa no encontrada' }, 404);
    }

    // Only show location for remesas that are en_proceso
    if (remesa[0].estado !== 'en_proceso' || !remesa[0].repartidor_id) {
      return c.json({
        success: true,
        data: {
          estado: remesa[0].estado,
          tracking_available: false,
          message: 'Ubicacion no disponible para esta remesa',
        },
      });
    }

    // Check if repartidor is sharing location
    const device = await db
      .select()
      .from(dispositivosRepartidor)
      .where(
        and(
          eq(dispositivosRepartidor.repartidor_id, remesa[0].repartidor_id),
          eq(dispositivosRepartidor.activo, true),
          eq(dispositivosRepartidor.compartir_ubicacion, true)
        )
      )
      .limit(1);

    if (device.length === 0 || !device[0].last_latitude) {
      return c.json({
        success: true,
        data: {
          estado: remesa[0].estado,
          tracking_available: false,
          message: 'El repartidor no esta compartiendo ubicacion',
        },
      });
    }

    // Get last few location points for route
    const recentLocations = await db
      .select({
        latitude: ubicacionesHistorial.latitude,
        longitude: ubicacionesHistorial.longitude,
        timestamp: ubicacionesHistorial.timestamp,
      })
      .from(ubicacionesHistorial)
      .where(eq(ubicacionesHistorial.remesa_id, remesa[0].id))
      .orderBy(desc(ubicacionesHistorial.timestamp))
      .limit(10);

    return c.json({
      success: true,
      data: {
        estado: remesa[0].estado,
        tracking_available: true,
        current_location: {
          latitude: device[0].last_latitude,
          longitude: device[0].last_longitude,
          accuracy: device[0].last_accuracy,
          updated_at: device[0].last_location_update,
        },
        route: recentLocations.reverse(),
      },
    });
  } catch (error) {
    console.error('Error fetching remesa location:', error);
    return c.json({ success: false, message: 'Error al cargar ubicacion' }, 500);
  }
});

export default ubicacion;
