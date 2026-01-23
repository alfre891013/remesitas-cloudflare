/**
 * Phone number validation and formatting utilities
 * Supports US (+1) and Cuban (+53) phone numbers
 */

import { COUNTRY_CODES } from '../constants';

// Phone number patterns
export const PHONE_PATTERNS = {
  // USA: 10 digits, area code can't start with 0 or 1
  // Format: +1AAANNNNNNN where AAA is area code (2-9xx), NNN is exchange (2-9xx not ending 11)
  USA: /^\+?1?([2-9]\d{2})([2-9](?!11)\d{2})(\d{4})$/,

  // Cuba: 8 digits, mobile starts with 5, landline varies
  // Format: +53NNNNNNNN where N is 8 digits
  CUBA: /^\+?53?([5-9]\d{7})$/,

  // Cuba mobile specifically (starts with 5)
  CUBA_MOBILE: /^\+?53?(5\d{7})$/,

  // Cuba landline (starts with area code like 7 for Havana)
  CUBA_LANDLINE: /^\+?53?([2-4679]\d{7})$/,
} as const;

export type PhoneCountry = keyof typeof COUNTRY_CODES;

/**
 * Validate a US phone number
 * @param phone - Phone number to validate (with or without country code)
 * @returns true if valid US phone number
 */
export function validateUSPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return PHONE_PATTERNS.USA.test(cleaned);
}

/**
 * Validate a Cuban phone number
 * @param phone - Phone number to validate (with or without country code)
 * @returns true if valid Cuban phone number
 */
export function validateCubanPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return PHONE_PATTERNS.CUBA.test(cleaned);
}

/**
 * Validate a Cuban mobile phone number specifically
 * @param phone - Phone number to validate
 * @returns true if valid Cuban mobile phone
 */
export function validateCubanMobile(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return PHONE_PATTERNS.CUBA_MOBILE.test(cleaned);
}

/**
 * Validate any phone number (US or Cuba)
 * @param phone - Phone number to validate
 * @returns true if valid phone number for either country
 */
export function validatePhone(phone: string): boolean {
  return validateUSPhone(phone) || validateCubanPhone(phone);
}

/**
 * Detect the country of a phone number
 * @param phone - Phone number to detect
 * @returns 'USA', 'CUBA', or null if unknown
 */
export function detectPhoneCountry(phone: string): PhoneCountry | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Check for explicit country code first
  if (cleaned.startsWith('+1') || cleaned.startsWith('1')) {
    if (validateUSPhone(cleaned)) return 'USA';
  }
  if (cleaned.startsWith('+53') || cleaned.startsWith('53')) {
    if (validateCubanPhone(cleaned)) return 'CUBA';
  }

  // Try to detect based on pattern
  if (validateUSPhone(cleaned)) return 'USA';
  if (validateCubanPhone(cleaned)) return 'CUBA';

  return null;
}

/**
 * Normalize a phone number to E.164 format
 * @param phone - Phone number to normalize
 * @param country - Country for the phone number
 * @returns Normalized phone number with country code
 */
export function normalizePhone(phone: string, country: PhoneCountry): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  switch (country) {
    case 'USA': {
      const match = cleaned.match(PHONE_PATTERNS.USA);
      if (match) {
        return `+1${match[1]}${match[2]}${match[3]}`;
      }
      // Fallback: remove leading 1 or +1 and prepend +1
      const digits = cleaned.replace(/^\+?1?/, '');
      if (digits.length === 10) {
        return `+1${digits}`;
      }
      break;
    }
    case 'CUBA': {
      const match = cleaned.match(PHONE_PATTERNS.CUBA);
      if (match) {
        return `+53${match[1]}`;
      }
      // Fallback: remove leading 53 or +53 and prepend +53
      const digits = cleaned.replace(/^\+?53?/, '');
      if (digits.length === 8) {
        return `+53${digits}`;
      }
      break;
    }
  }

  return cleaned;
}

/**
 * Format a phone number for display
 * @param phone - Phone number to format
 * @param country - Country for formatting
 * @returns Formatted phone number string
 */
export function formatPhoneForDisplay(phone: string, country: PhoneCountry): string {
  const normalized = normalizePhone(phone, country);

  switch (country) {
    case 'USA': {
      // Format: +1 (AAA) NNN-NNNN
      const match = normalized.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
      }
      break;
    }
    case 'CUBA': {
      // Format: +53 NNNN NNNN
      const match = normalized.match(/^\+53(\d{4})(\d{4})$/);
      if (match) {
        return `+53 ${match[1]} ${match[2]}`;
      }
      break;
    }
  }

  return normalized;
}

/**
 * Get the raw digits from a phone number
 * @param phone - Phone number
 * @returns Only the digits
 */
export function getPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Check if a phone number is likely to be WhatsApp-capable
 * In Cuba, only mobile phones (starting with 5) support WhatsApp
 * In US, all mobile phones support WhatsApp
 * @param phone - Phone number to check
 * @returns true if likely WhatsApp-capable
 */
export function isWhatsAppCapable(phone: string): boolean {
  const country = detectPhoneCountry(phone);

  if (country === 'CUBA') {
    // Only Cuban mobile phones (starting with 5) support WhatsApp
    return validateCubanMobile(phone);
  }

  if (country === 'USA') {
    // Assume US phones are WhatsApp-capable
    return true;
  }

  return false;
}

/**
 * Get the appropriate notification channel for a phone number
 * @param phone - Phone number
 * @returns 'whatsapp', 'sms', or null
 */
export function getPreferredNotificationChannel(phone: string): 'whatsapp' | 'sms' | null {
  const country = detectPhoneCountry(phone);

  if (country === 'CUBA') {
    // For Cuba, prefer WhatsApp for mobile, no SMS option
    return validateCubanMobile(phone) ? 'whatsapp' : null;
  }

  if (country === 'USA') {
    // For US, prefer SMS (more reliable)
    return 'sms';
  }

  return null;
}
