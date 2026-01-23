import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { AuthService } from '../services/auth.service';
import { create2FAService } from '../services/2fa.service';
import { validateBody } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rate-limit';
import { loginSchema, passwordChangeSchema, refreshTokenSchema } from '@remesitas/shared';
import { z } from 'zod';

// 2FA validation schemas
const twoFAEnableSchema = z.object({
  secret: z.string().min(16),
  code: z.string().length(6),
  backup_codes: z.array(z.string()).length(10),
});

const twoFAVerifySchema = z.object({
  code: z.string().min(6).max(9),
});

const twoFADisableSchema = z.object({
  password: z.string().min(1),
});

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/auth/login (rate limited: 5 attempts per minute)
authRoutes.post('/login', authRateLimiter, validateBody(loginSchema), async (c) => {
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

// ============ Two-Factor Authentication Routes ============

// GET /api/auth/2fa/status - Check 2FA status
authRoutes.get('/2fa/status', authMiddleware, async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  const twoFAService = create2FAService(db);
  const enabled = await twoFAService.has2FA(auth.userId);

  return c.json({
    success: true,
    data: { enabled },
  });
});

// POST /api/auth/2fa/setup - Generate setup information
authRoutes.post('/2fa/setup', authMiddleware, async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;

  const twoFAService = create2FAService(db);

  // Check if already enabled
  const alreadyEnabled = await twoFAService.has2FA(auth.userId);
  if (alreadyEnabled) {
    return c.json({
      success: false,
      error: 'Already Enabled',
      message: '2FA ya esta habilitado para esta cuenta',
    }, 400);
  }

  try {
    const setup = await twoFAService.generateSecret(auth.userId);

    return c.json({
      success: true,
      data: setup,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return c.json({
      success: false,
      error: 'Setup Failed',
      message: 'Error al configurar 2FA',
    }, 500);
  }
});

// POST /api/auth/2fa/enable - Enable 2FA after verification
authRoutes.post('/2fa/enable', authMiddleware, validateBody(twoFAEnableSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const body = await c.req.json();

  const twoFAService = create2FAService(db);

  // Check if already enabled
  const alreadyEnabled = await twoFAService.has2FA(auth.userId);
  if (alreadyEnabled) {
    return c.json({
      success: false,
      error: 'Already Enabled',
      message: '2FA ya esta habilitado para esta cuenta',
    }, 400);
  }

  const result = await twoFAService.enable2FA(
    auth.userId,
    body.secret,
    body.code,
    body.backup_codes
  );

  if (!result.success) {
    return c.json({
      success: false,
      error: 'Verification Failed',
      message: result.message,
    }, 400);
  }

  return c.json({
    success: true,
    message: result.message,
  });
});

// POST /api/auth/2fa/disable - Disable 2FA
authRoutes.post('/2fa/disable', authMiddleware, validateBody(twoFADisableSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const { password } = await c.req.json();

  // Verify password first
  const authService = new AuthService(db, c.env.JWT_SECRET);
  const passwordValid = await authService.verifyPassword(auth.userId, password);

  if (!passwordValid) {
    return c.json({
      success: false,
      error: 'Invalid Password',
      message: 'Contraseña incorrecta',
    }, 401);
  }

  const twoFAService = create2FAService(db);
  const result = await twoFAService.disable2FA(auth.userId);

  return c.json({
    success: true,
    message: result.message,
  });
});

// POST /api/auth/2fa/verify - Verify 2FA code during login
authRoutes.post('/2fa/verify', authMiddleware, validateBody(twoFAVerifySchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const { code } = await c.req.json();

  const twoFAService = create2FAService(db);
  const result = await twoFAService.verify2FA(auth.userId, code);

  if (!result.success) {
    return c.json({
      success: false,
      error: 'Verification Failed',
      message: result.message,
    }, 401);
  }

  return c.json({
    success: true,
    message: result.message,
    data: { usedBackup: result.usedBackup || false },
  });
});

// POST /api/auth/2fa/backup-codes - Regenerate backup codes
authRoutes.post('/2fa/backup-codes', authMiddleware, validateBody(twoFADisableSchema), async (c) => {
  const db = c.get('db');
  const auth = c.get('auth')!;
  const { password } = await c.req.json();

  // Verify password first
  const authService = new AuthService(db, c.env.JWT_SECRET);
  const passwordValid = await authService.verifyPassword(auth.userId, password);

  if (!passwordValid) {
    return c.json({
      success: false,
      error: 'Invalid Password',
      message: 'Contraseña incorrecta',
    }, 401);
  }

  const twoFAService = create2FAService(db);

  // Check if 2FA is enabled
  const enabled = await twoFAService.has2FA(auth.userId);
  if (!enabled) {
    return c.json({
      success: false,
      error: '2FA Not Enabled',
      message: '2FA no esta habilitado',
    }, 400);
  }

  const backupCodes = await twoFAService.regenerateBackupCodes(auth.userId);

  return c.json({
    success: true,
    message: 'Codigos de respaldo regenerados',
    data: { backup_codes: backupCodes },
  });
});
