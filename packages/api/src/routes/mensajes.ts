import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc, sql, and, like, or } from 'drizzle-orm';
import type { Env, Variables } from '../types';
import { mensajesContacto, asuntosContacto, usuarios } from '../db/schema';
import { validateBody } from '../middleware/validate';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const mensajes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Schema for contact form submission
const contactFormSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('El correo electronico no es valido'),
  telefono: z.string().optional(),
  asunto: z.string().min(1, 'Debe seleccionar un asunto'),
  mensaje: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres').max(5000),
});

// PUBLIC: Submit contact form (no auth required)
mensajes.post('/contacto', validateBody(contactFormSchema), async (c) => {
  const data = c.req.valid('json' as never) as z.infer<typeof contactFormSchema>;
  const db = c.get('db');

  try {
    // Get IP and User-Agent for spam protection
    const ipOrigen = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';

    // Rate limiting check - max 5 messages per hour from same email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentMessages = await db
      .select({ count: sql<number>`count(*)` })
      .from(mensajesContacto)
      .where(
        and(
          eq(mensajesContacto.email, data.email),
          sql`${mensajesContacto.fecha_creacion} > ${oneHourAgo}`
        )
      );

    if (recentMessages[0]?.count >= 5) {
      return c.json(
        { success: false, message: 'Has enviado demasiados mensajes. Intenta de nuevo mas tarde.' },
        429
      );
    }

    // Generate message number
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7).replace('-', '');

    // Get the last message number for this month
    const lastMessage = await db
      .select({ numero: mensajesContacto.numero })
      .from(mensajesContacto)
      .where(like(mensajesContacto.numero, `MSG-${yearMonth}-%`))
      .orderBy(desc(mensajesContacto.id))
      .limit(1);

    let nextNumber = 1;
    if (lastMessage.length > 0) {
      const lastNum = lastMessage[0].numero.split('-').pop();
      nextNumber = (parseInt(lastNum || '0', 10) || 0) + 1;
    }

    const numero = `MSG-${yearMonth}-${nextNumber.toString().padStart(4, '0')}`;

    // Insert the message
    const result = await db.insert(mensajesContacto).values({
      numero,
      nombre: data.nombre,
      email: data.email,
      telefono: data.telefono || null,
      asunto: data.asunto,
      mensaje: data.mensaje,
      ip_origen: ipOrigen,
      user_agent: userAgent,
      estado: 'nuevo',
    });

    return c.json({
      success: true,
      message: 'Mensaje enviado exitosamente. Te responderemos pronto.',
      data: { numero },
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    return c.json(
      { success: false, message: 'Error al enviar el mensaje. Intenta de nuevo.' },
      500
    );
  }
});

// PUBLIC: Get contact form subjects
mensajes.get('/asuntos', async (c) => {
  const db = c.get('db');

  try {
    const asuntos = await db
      .select()
      .from(asuntosContacto)
      .where(eq(asuntosContacto.activo, true))
      .orderBy(asuntosContacto.orden);

    return c.json({ success: true, data: asuntos });
  } catch (error) {
    console.error('Error fetching contact subjects:', error);
    return c.json({ success: false, message: 'Error al cargar los asuntos' }, 500);
  }
});

// ADMIN: List all messages with filtering
mensajes.get('/', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const estado = c.req.query('estado');
  const search = c.req.query('search');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  try {
    const conditions = [];

    if (estado) {
      conditions.push(eq(mensajesContacto.estado, estado as any));
    }

    if (search) {
      conditions.push(
        or(
          like(mensajesContacto.nombre, `%${search}%`),
          like(mensajesContacto.email, `%${search}%`),
          like(mensajesContacto.numero, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        id: mensajesContacto.id,
        numero: mensajesContacto.numero,
        nombre: mensajesContacto.nombre,
        email: mensajesContacto.email,
        telefono: mensajesContacto.telefono,
        asunto: mensajesContacto.asunto,
        mensaje: mensajesContacto.mensaje,
        estado: mensajesContacto.estado,
        fecha_creacion: mensajesContacto.fecha_creacion,
        fecha_lectura: mensajesContacto.fecha_lectura,
        fecha_respuesta: mensajesContacto.fecha_respuesta,
        respondido_por: mensajesContacto.respondido_por,
      })
      .from(mensajesContacto)
      .where(whereClause)
      .orderBy(desc(mensajesContacto.fecha_creacion))
      .limit(limit)
      .offset(offset);

    // Get counts by estado
    const counts = await db
      .select({
        estado: mensajesContacto.estado,
        count: sql<number>`count(*)`,
      })
      .from(mensajesContacto)
      .groupBy(mensajesContacto.estado);

    const countByEstado: Record<string, number> = {};
    counts.forEach((item) => {
      countByEstado[item.estado] = item.count;
    });

    return c.json({
      success: true,
      data: results,
      counts: countByEstado,
      total: counts.reduce((sum, item) => sum + item.count, 0),
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ success: false, message: 'Error al cargar los mensajes' }, 500);
  }
});

// ADMIN: Get single message
mensajes.get('/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);

  try {
    const result = await db
      .select()
      .from(mensajesContacto)
      .where(eq(mensajesContacto.id, id))
      .limit(1);

    if (result.length === 0) {
      return c.json({ success: false, message: 'Mensaje no encontrado' }, 404);
    }

    // Mark as read if nuevo
    if (result[0].estado === 'nuevo') {
      await db
        .update(mensajesContacto)
        .set({
          estado: 'leido',
          fecha_lectura: new Date().toISOString(),
        })
        .where(eq(mensajesContacto.id, id));
    }

    return c.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error fetching message:', error);
    return c.json({ success: false, message: 'Error al cargar el mensaje' }, 500);
  }
});

// Schema for updating message
const updateMessageSchema = z.object({
  estado: z.enum(['nuevo', 'leido', 'respondido', 'cerrado', 'spam']).optional(),
  respuesta: z.string().optional(),
});

// ADMIN: Update message (respond, change status)
mensajes.put('/:id', authMiddleware, adminMiddleware, validateBody(updateMessageSchema), async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);
  const data = c.req.valid('json' as never) as z.infer<typeof updateMessageSchema>;
  const auth = c.get('auth')!;

  try {
    const existing = await db
      .select()
      .from(mensajesContacto)
      .where(eq(mensajesContacto.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ success: false, message: 'Mensaje no encontrado' }, 404);
    }

    const updates: Record<string, any> = {};

    if (data.estado) {
      updates.estado = data.estado;
    }

    if (data.respuesta) {
      updates.respuesta = data.respuesta;
      updates.estado = 'respondido';
      updates.fecha_respuesta = new Date().toISOString();
      updates.respondido_por = auth.userId;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(mensajesContacto)
        .set(updates)
        .where(eq(mensajesContacto.id, id));
    }

    return c.json({
      success: true,
      message: 'Mensaje actualizado exitosamente',
    });
  } catch (error) {
    console.error('Error updating message:', error);
    return c.json({ success: false, message: 'Error al actualizar el mensaje' }, 500);
  }
});

// ADMIN: Delete message (actually just mark as spam or delete)
mensajes.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');
  const id = parseInt(c.req.param('id'), 10);

  try {
    await db.delete(mensajesContacto).where(eq(mensajesContacto.id, id));

    return c.json({
      success: true,
      message: 'Mensaje eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return c.json({ success: false, message: 'Error al eliminar el mensaje' }, 500);
  }
});

// ADMIN: Get stats
mensajes.get('/stats/summary', authMiddleware, adminMiddleware, async (c) => {
  const db = c.get('db');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const [totalNew, totalToday, totalPending] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(mensajesContacto)
        .where(eq(mensajesContacto.estado, 'nuevo')),
      db
        .select({ count: sql<number>`count(*)` })
        .from(mensajesContacto)
        .where(sql`${mensajesContacto.fecha_creacion} >= ${todayStr}`),
      db
        .select({ count: sql<number>`count(*)` })
        .from(mensajesContacto)
        .where(
          or(
            eq(mensajesContacto.estado, 'nuevo'),
            eq(mensajesContacto.estado, 'leido')
          )
        ),
    ]);

    return c.json({
      success: true,
      data: {
        nuevos: totalNew[0]?.count || 0,
        hoy: totalToday[0]?.count || 0,
        pendientes: totalPending[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching message stats:', error);
    return c.json({ success: false, message: 'Error al cargar estadisticas' }, 500);
  }
});

export default mensajes;
