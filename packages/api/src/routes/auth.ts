import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { AuthService } from '../services/auth.service';
import { validateBody } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';
import { loginSchema, passwordChangeSchema, refreshTokenSchema } from '@remesitas/shared';

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/auth/login
authRoutes.post('/login', validateBody(loginSchema), async (c) => {
  const { username, password } = await c.req.json();
  const db = c.get('db');

  const authService = new AuthService(db, c.env.JWT_SECRET);
  const result = await authService.login(username, password);

  if (!result.success) {
    return c.json(
      {
        success: false,
        error: 'Authentication Failed',
        message: result.error,
      },
      401
    );
  }

  return c.json({
    success: true,
    data: {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user: result.user,
    },
  });
});

// POST /api/auth/refresh
authRoutes.post('/refresh', validateBody(refreshTokenSchema), async (c) => {
  const { refresh_token } = await c.req.json();
  const db = c.get('db');

  const authService = new AuthService(db, c.env.JWT_SECRET);
  const result = await authService.refresh(refresh_token);

  if (!result.success) {
    return c.json(
      {
        success: false,
        error: 'Token Refresh Failed',
        message: result.error,
      },
      401
    );
  }

  return c.json({
    success: true,
    data: {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user: result.user,
    },
  });
});

// POST /api/auth/logout
authRoutes.post('/logout', async (c) => {
  try {
    const { refresh_token } = await c.req.json();
    const db = c.get('db');

    if (refresh_token) {
      const authService = new AuthService(db, c.env.JWT_SECRET);
      await authService.logout(refresh_token);
    }

    return c.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch {
    return c.json({
      success: true,
      message: 'Sesión cerrada',
    });
  }
});

// POST /api/auth/change-password (requires auth)
authRoutes.post(
  '/change-password',
  authMiddleware,
  validateBody(passwordChangeSchema),
  async (c) => {
    const { current_password, new_password } = await c.req.json();
    const auth = c.get('auth')!;
    const db = c.get('db');

    const authService = new AuthService(db, c.env.JWT_SECRET);
    const result = await authService.changePassword(
      auth.userId,
      current_password,
      new_password
    );

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: 'Password Change Failed',
          message: result.error,
        },
        400
      );
    }

    return c.json({
      success: true,
      message: 'Contraseña actualizada correctamente. Por favor, inicie sesión nuevamente.',
    });
  }
);

// GET /api/auth/me (requires auth)
authRoutes.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth')!;
  const db = c.get('db');

  const { usuarios } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');

  const [user] = await db
    .select({
      id: usuarios.id,
      username: usuarios.username,
      nombre: usuarios.nombre,
      rol: usuarios.rol,
      telefono: usuarios.telefono,
      saldo_usd: usuarios.saldo_usd,
      saldo_cup: usuarios.saldo_cup,
      saldo_pendiente: usuarios.saldo_pendiente,
      comision_revendedor: usuarios.comision_revendedor,
    })
    .from(usuarios)
    .where(eq(usuarios.id, auth.userId))
    .limit(1);

  if (!user) {
    return c.json(
      {
        success: false,
        error: 'Not Found',
        message: 'Usuario no encontrado',
      },
      404
    );
  }

  return c.json({
    success: true,
    data: user,
  });
});
