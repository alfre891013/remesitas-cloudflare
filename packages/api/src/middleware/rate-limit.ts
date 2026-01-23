import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Key prefix for namespacing
}

// Rate limiting middleware using Cloudflare KV
export function rateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = config;

  return createMiddleware<{ Bindings: Env; Variables: Variables }>(
    async (c, next) => {
      // Skip rate limiting in development
      if (c.env.ENVIRONMENT === 'development') {
        return next();
      }

      // Get client identifier (IP or user ID if authenticated)
      const auth = c.get('auth');
      const clientIp = c.req.header('cf-connecting-ip') || 'unknown';
      const clientId = auth?.userId ? `user:${auth.userId}` : `ip:${clientIp}`;
      const key = `${keyPrefix}:${clientId}`;

      try {
        // Get current count from KV
        const currentData = await c.env.CACHE.get(key);
        const now = Date.now();

        let count = 0;
        let windowStart = now;

        if (currentData) {
          const data = JSON.parse(currentData);
          if (now - data.windowStart < windowMs) {
            // Still within the same window
            count = data.count;
            windowStart = data.windowStart;
          }
          // If outside window, reset count (count stays 0)
        }

        if (count >= maxRequests) {
          const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
          c.res.headers.set('Retry-After', String(retryAfter));
          c.res.headers.set('X-RateLimit-Limit', String(maxRequests));
          c.res.headers.set('X-RateLimit-Remaining', '0');
          c.res.headers.set('X-RateLimit-Reset', String(windowStart + windowMs));

          return c.json(
            {
              success: false,
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.',
              retryAfter,
            },
            429
          );
        }

        // Increment count
        const newCount = count + 1;
        await c.env.CACHE.put(
          key,
          JSON.stringify({ count: newCount, windowStart }),
          { expirationTtl: Math.ceil(windowMs / 1000) }
        );

        // Add rate limit headers
        c.res.headers.set('X-RateLimit-Limit', String(maxRequests));
        c.res.headers.set('X-RateLimit-Remaining', String(maxRequests - newCount));
        c.res.headers.set('X-RateLimit-Reset', String(windowStart + windowMs));

        return next();
      } catch (error) {
        // If KV fails, allow the request (fail open)
        if (c.env.ENVIRONMENT === 'development') {
          console.error('Rate limit error:', error);
        }
        return next();
      }
    }
  );
}

// Pre-configured rate limiters for common use cases
export const authRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 login attempts per minute
  keyPrefix: 'rl:auth',
});

export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  keyPrefix: 'rl:api',
});

export const publicRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute for public endpoints
  keyPrefix: 'rl:public',
});
