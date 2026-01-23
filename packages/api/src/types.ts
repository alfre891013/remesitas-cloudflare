import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './db/schema';

// Cloudflare bindings
export interface Env {
  // D1 Database
  DB: D1Database;
  // R2 Storage
  STORAGE: R2Bucket;
  // KV Cache
  CACHE: KVNamespace;
  // Secrets
  JWT_SECRET: string;
  ELTOQUE_JWT: string;
  CAMBIOCUBA_TOKEN: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_SMS_FROM: string;
  TWILIO_WHATSAPP_FROM: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_EMAIL: string;
  // Email providers
  RESEND_API_KEY: string;
  SENDGRID_API_KEY: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
  // Base URL
  URL_BASE: string;
  // Environment
  ENVIRONMENT: string;
}

// Database type with schema
export type Database = DrizzleD1Database<typeof schema>;

// Auth context for authenticated requests
export interface AuthContext {
  userId: number;
  username: string;
  rol: 'admin' | 'repartidor' | 'revendedor';
}

// Hono context variables
export interface Variables {
  db: Database;
  auth?: AuthContext;
}
