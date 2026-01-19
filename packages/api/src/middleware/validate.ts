import { createMiddleware } from 'hono/factory';
import type { z } from 'zod';
import type { Env, Variables } from '../types';

// Generic validation middleware factory
export function validateBody<T extends z.ZodType>(schema: T) {
  return createMiddleware<{
    Bindings: Env;
    Variables: Variables & { validatedBody: z.infer<T> };
  }>(async (c, next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        const errors = result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        return c.json(
          {
            success: false,
            error: 'Validation Error',
            message: 'Invalid request body',
            details: errors,
          },
          400
        );
      }

      // Store validated body in context
      c.set('validatedBody' as any, result.data);
      await next();
    } catch (err) {
      return c.json(
        {
          success: false,
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON',
        },
        400
      );
    }
  });
}

// Query parameter validation
export function validateQuery<T extends z.ZodType>(schema: T) {
  return createMiddleware<{
    Bindings: Env;
    Variables: Variables & { validatedQuery: z.infer<T> };
  }>(async (c, next) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      return c.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: errors,
        },
        400
      );
    }

    c.set('validatedQuery' as any, result.data);
    await next();
  });
}

// Path parameter validation
export function validateParams<T extends z.ZodType>(schema: T) {
  return createMiddleware<{
    Bindings: Env;
    Variables: Variables & { validatedParams: z.infer<T> };
  }>(async (c, next) => {
    const params = c.req.param();
    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      return c.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Invalid path parameters',
          details: errors,
        },
        400
      );
    }

    c.set('validatedParams' as any, result.data);
    await next();
  });
}
