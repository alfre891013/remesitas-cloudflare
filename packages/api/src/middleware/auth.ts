import { createMiddleware } from 'hono/factory';
import * as jose from 'jose';
import type { Env, Variables, AuthContext } from '../types';

// JWT verification middleware
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      },
      401
    );
  }

  const token = authHeader.substring(7);

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    const auth: AuthContext = {
      userId: payload.sub as unknown as number,
      username: payload.username as string,
      rol: payload.rol as AuthContext['rol'],
    };

    c.set('auth', auth);
    await next();
  } catch (err) {
    if (err instanceof jose.errors.JWTExpired) {
      return c.json(
        {
          success: false,
          error: 'Token Expired',
          message: 'Your session has expired. Please log in again.',
        },
        401
      );
    }

    return c.json(
      {
        success: false,
        error: 'Invalid Token',
        message: 'The provided token is invalid',
      },
      401
    );
  }
});

// Admin-only middleware
export const adminMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const auth = c.get('auth');

  if (!auth) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    );
  }

  if (auth.rol !== 'admin') {
    return c.json(
      {
        success: false,
        error: 'Forbidden',
        message: 'Admin access required',
      },
      403
    );
  }

  await next();
});

// Repartidor access middleware (admin or repartidor)
export const repartidorMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const auth = c.get('auth');

  if (!auth) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    );
  }

  if (auth.rol !== 'admin' && auth.rol !== 'repartidor') {
    return c.json(
      {
        success: false,
        error: 'Forbidden',
        message: 'Repartidor or admin access required',
      },
      403
    );
  }

  await next();
});

// Revendedor access middleware (admin or revendedor)
export const revendedorMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const auth = c.get('auth');

  if (!auth) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    );
  }

  if (auth.rol !== 'admin' && auth.rol !== 'revendedor') {
    return c.json(
      {
        success: false,
        error: 'Forbidden',
        message: 'Revendedor or admin access required',
      },
      403
    );
  }

  await next();
});
