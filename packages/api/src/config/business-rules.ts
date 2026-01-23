/**
 * Business Rules Configuration
 * Loads configurable business rules from database
 * Falls back to constants if not configured
 */

import { eq } from 'drizzle-orm';
import { configuracion } from '../db/schema';
import type { Database } from '../types';
import { BUSINESS_RULES } from '@remesitas/shared';

/**
 * Business rules interface
 */
export interface BusinessRules {
  /** Commission percentage for USD deliveries (e.g., 5 = 5%) */
  COMISION_USD_PORCENTAJE: number;
  /** Discount in CUP per USD for MN deliveries */
  DESCUENTO_MN_CUP: number;
  /** Minimum transfer amount in USD */
  MONTO_MINIMO: number;
  /** Maximum transfer amount in USD */
  MONTO_MAXIMO: number;
  /** Default reseller commission percentage */
  COMISION_REVENDEDOR_DEFAULT: number;
  /** Days until invoice is due */
  DIAS_VENCIMIENTO_FACTURA: number;
  /** Base URL for tracking links */
  URL_BASE: string;
  /** Enable SMS notifications */
  HABILITAR_SMS: boolean;
  /** Enable WhatsApp notifications */
  HABILITAR_WHATSAPP: boolean;
  /** Enable push notifications */
  HABILITAR_PUSH: boolean;
  /** Enable GPS tracking for delivery */
  HABILITAR_GPS: boolean;
}

// Default values matching constants
const DEFAULT_RULES: BusinessRules = {
  COMISION_USD_PORCENTAJE: BUSINESS_RULES.COMISION_USD_PORCENTAJE,
  DESCUENTO_MN_CUP: BUSINESS_RULES.DESCUENTO_MN_CUP,
  MONTO_MINIMO: 10,
  MONTO_MAXIMO: 10000,
  COMISION_REVENDEDOR_DEFAULT: BUSINESS_RULES.DEFAULT_COMISION_REVENDEDOR,
  DIAS_VENCIMIENTO_FACTURA: 30,
  URL_BASE: 'https://remesitas-web.pages.dev',
  HABILITAR_SMS: true,
  HABILITAR_WHATSAPP: true,
  HABILITAR_PUSH: true,
  HABILITAR_GPS: true,
};

// Cache for business rules (invalidated periodically)
let rulesCache: BusinessRules | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Load business rules from database
 * Returns cached value if available and not stale
 */
export async function loadBusinessRules(db: Database): Promise<BusinessRules> {
  const now = Date.now();

  // Return cached value if fresh
  if (rulesCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return rulesCache;
  }

  try {
    // Load all configuration values
    const configs = await db.select().from(configuracion);

    // Build rules object from database
    const configMap = new Map(configs.map((c) => [c.clave, c.valor]));

    const rules: BusinessRules = {
      COMISION_USD_PORCENTAJE: parseFloat(
        configMap.get('COMISION_USD_PORCENTAJE') || String(DEFAULT_RULES.COMISION_USD_PORCENTAJE)
      ),
      DESCUENTO_MN_CUP: parseFloat(
        configMap.get('DESCUENTO_MN_CUP') || String(DEFAULT_RULES.DESCUENTO_MN_CUP)
      ),
      MONTO_MINIMO: parseFloat(
        configMap.get('MONTO_MINIMO') || String(DEFAULT_RULES.MONTO_MINIMO)
      ),
      MONTO_MAXIMO: parseFloat(
        configMap.get('MONTO_MAXIMO') || String(DEFAULT_RULES.MONTO_MAXIMO)
      ),
      COMISION_REVENDEDOR_DEFAULT: parseFloat(
        configMap.get('COMISION_REVENDEDOR_DEFAULT') ||
          String(DEFAULT_RULES.COMISION_REVENDEDOR_DEFAULT)
      ),
      DIAS_VENCIMIENTO_FACTURA: parseInt(
        configMap.get('DIAS_VENCIMIENTO_FACTURA') ||
          String(DEFAULT_RULES.DIAS_VENCIMIENTO_FACTURA),
        10
      ),
      URL_BASE: configMap.get('URL_BASE') || DEFAULT_RULES.URL_BASE,
      HABILITAR_SMS: configMap.get('HABILITAR_NOTIFICACIONES_SMS') !== '0',
      HABILITAR_WHATSAPP: configMap.get('HABILITAR_NOTIFICACIONES_WHATSAPP') !== '0',
      HABILITAR_PUSH: configMap.get('HABILITAR_NOTIFICACIONES_PUSH') !== '0',
      HABILITAR_GPS: configMap.get('HABILITAR_GPS_TRACKING') !== '0',
    };

    // Update cache
    rulesCache = rules;
    cacheTimestamp = now;

    return rules;
  } catch {
    // Return defaults on error
    console.warn('Failed to load business rules from database, using defaults');
    return DEFAULT_RULES;
  }
}

/**
 * Get a single business rule value
 */
export async function getBusinessRule<K extends keyof BusinessRules>(
  db: Database,
  key: K
): Promise<BusinessRules[K]> {
  const rules = await loadBusinessRules(db);
  return rules[key];
}

/**
 * Update a business rule in the database
 */
export async function updateBusinessRule(
  db: Database,
  key: string,
  value: string
): Promise<void> {
  await db
    .insert(configuracion)
    .values({ clave: key, valor: value })
    .onConflictDoUpdate({
      target: configuracion.clave,
      set: { valor: value },
    });

  // Invalidate cache
  rulesCache = null;
}

/**
 * Invalidate the business rules cache
 * Call this when rules are updated
 */
export function invalidateRulesCache(): void {
  rulesCache = null;
  cacheTimestamp = 0;
}

/**
 * Get default business rules (for use when DB is unavailable)
 */
export function getDefaultRules(): BusinessRules {
  return { ...DEFAULT_RULES };
}
