/**
 * Utility validators for input validation and business rules
 */

// Valid remittance state transitions
const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  solicitud: ['pendiente', 'cancelada'],
  pendiente: ['en_proceso', 'cancelada'],
  en_proceso: ['entregada', 'pendiente', 'cancelada'], // Can go back to pendiente if unassigned
  entregada: ['facturada'],
  facturada: [], // Final state
  cancelada: [], // Final state
};

/**
 * Check if a state transition is valid
 */
export function isValidStateTransition(
  currentState: string,
  newState: string
): boolean {
  const allowedStates = VALID_STATE_TRANSITIONS[currentState];
  if (!allowedStates) return false;
  return allowedStates.includes(newState);
}

/**
 * Get allowed next states for a given state
 */
export function getAllowedNextStates(currentState: string): string[] {
  return VALID_STATE_TRANSITIONS[currentState] || [];
}

/**
 * Validate integer ID from string
 * Returns parsed ID or null if invalid
 */
export function parseId(value: string | undefined): number | null {
  if (!value) return null;
  const id = parseInt(value, 10);
  if (isNaN(id) || id <= 0) return null;
  return id;
}

/**
 * Validate and parse pagination params with bounds
 */
export function parsePagination(
  query: { page?: string; limit?: string },
  maxLimit: number = 100
): { page: number; limit: number; offset: number } {
  let page = parseInt(query.page || '1', 10);
  let limit = parseInt(query.limit || '20', 10);

  // Ensure valid bounds
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > maxLimit) limit = maxLimit;

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

/**
 * Validate monetary amount
 * Returns rounded amount or null if invalid
 */
export function parseMonetaryAmount(
  value: number | string | undefined,
  options: { min?: number; max?: number } = {}
): number | null {
  const { min = 0.01, max = 100000 } = options;

  if (value === undefined || value === null) return null;

  const amount = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(amount) || !isFinite(amount)) return null;
  if (amount < min || amount > max) return null;

  // Round to 2 decimal places for money
  return Math.round(amount * 100) / 100;
}

/**
 * Validate phone number (basic format check)
 * Returns cleaned phone or null if invalid
 */
export function parsePhoneNumber(phone: string | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Must be between 10-15 digits (international format)
  if (cleaned.length < 10 || cleaned.length > 15) return null;

  return cleaned;
}

/**
 * Validate search query with length limits
 */
export function parseSearchQuery(
  query: string | undefined,
  maxLength: number = 100
): string | null {
  if (!query) return null;

  const trimmed = query.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return trimmed.substring(0, maxLength);

  return trimmed;
}

/**
 * Validate date string (ISO format)
 */
export function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Validate exchange rate is within reasonable bounds
 */
export function isValidExchangeRate(rate: number, currency: string): boolean {
  // Define reasonable bounds for different currencies to CUP
  const bounds: Record<string, { min: number; max: number }> = {
    USD: { min: 100, max: 1000 },
    EUR: { min: 100, max: 1200 },
    MLC: { min: 50, max: 500 },
  };

  const currencyBounds = bounds[currency.toUpperCase()];
  if (!currencyBounds) return false;

  return rate >= currencyBounds.min && rate <= currencyBounds.max;
}

/**
 * Validate user role
 */
export function isValidRole(role: string): role is 'admin' | 'repartidor' | 'revendedor' {
  return ['admin', 'repartidor', 'revendedor'].includes(role);
}

/**
 * Validate delivery type
 */
export function isValidDeliveryType(type: string): type is 'MN' | 'USD' {
  return ['MN', 'USD'].includes(type);
}

/**
 * Sanitize string for SQL LIKE queries (escape wildcards)
 */
export function sanitizeForLike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}
