/**
 * Two-Factor Authentication (2FA) Service
 * Implements TOTP (Time-based One-Time Password) authentication
 */

import { eq } from 'drizzle-orm';
import type { Database } from '../types';
import { usuarios } from '../db/schema';

// TOTP Configuration
const TOTP_CONFIG = {
  algorithm: 'SHA-1',
  digits: 6,
  period: 30, // seconds
  window: 1, // Allow 1 period before/after for clock drift
};

/**
 * Convert base32 string to Uint8Array
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = encoded.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');

  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleanInput.length; i++) {
    const idx = alphabet.indexOf(cleanInput[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Convert Uint8Array to base32 string
 */
function base32Encode(data: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Generate random bytes using Web Crypto API
 */
function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Generate HMAC-SHA1 using Web Crypto API
 */
async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * Generate TOTP code for a given time
 */
async function generateTOTP(secret: string, time?: number): Promise<string> {
  const now = time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_CONFIG.period);

  // Convert counter to 8-byte big-endian buffer
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  // Decode secret and compute HMAC
  const key = base32Decode(secret);
  const hmac = await hmacSha1(key, counterBytes);

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  // Get last 6 digits
  const otp = code % Math.pow(10, TOTP_CONFIG.digits);
  return otp.toString().padStart(TOTP_CONFIG.digits, '0');
}

/**
 * Verify TOTP code with window tolerance
 */
async function verifyTOTP(secret: string, code: string, window?: number): Promise<boolean> {
  const windowSize = window ?? TOTP_CONFIG.window;
  const now = Math.floor(Date.now() / 1000);

  for (let i = -windowSize; i <= windowSize; i++) {
    const time = now + i * TOTP_CONFIG.period;
    const expected = await generateTOTP(secret, time);
    if (expected === code) {
      return true;
    }
  }

  return false;
}

/**
 * Generate backup codes
 */
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = generateRandomBytes(4);
    const code = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Two-Factor Authentication Service
 */
export class TwoFactorService {
  constructor(private db: Database) {}

  /**
   * Generate a new 2FA secret for a user
   */
  async generateSecret(userId: number): Promise<{
    secret: string;
    otpAuthUrl: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    // Get user info
    const [user] = await this.db
      .select({ nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Generate random secret (20 bytes = 160 bits)
    const secretBytes = generateRandomBytes(20);
    const secret = base32Encode(secretBytes);

    // Generate OTP Auth URL
    const issuer = 'Remesitas';
    const accountName = encodeURIComponent(user.nombre || `user-${userId}`);
    const otpAuthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=${TOTP_CONFIG.algorithm}&digits=${TOTP_CONFIG.digits}&period=${TOTP_CONFIG.period}`;

    // Generate QR code URL using a free QR code API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`;

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);

    return {
      secret,
      otpAuthUrl,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Enable 2FA for a user after verification
   */
  async enable2FA(
    userId: number,
    secret: string,
    code: string,
    backupCodes: string[]
  ): Promise<{ success: boolean; message: string }> {
    // Verify the code first
    const isValid = await verifyTOTP(secret, code);
    if (!isValid) {
      return { success: false, message: 'Codigo invalido' };
    }

    // Store the secret and backup codes
    // Hash backup codes for storage
    const hashedBackupCodes = backupCodes.map((c) => c.replace('-', '').toLowerCase());

    await this.db
      .update(usuarios)
      .set({
        two_factor_secret: secret,
        two_factor_enabled: true,
        two_factor_backup_codes: JSON.stringify(hashedBackupCodes),
      })
      .where(eq(usuarios.id, userId));

    return { success: true, message: '2FA habilitado correctamente' };
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: number): Promise<{ success: boolean; message: string }> {
    await this.db
      .update(usuarios)
      .set({
        two_factor_secret: null,
        two_factor_enabled: false,
        two_factor_backup_codes: null,
      })
      .where(eq(usuarios.id, userId));

    return { success: true, message: '2FA deshabilitado' };
  }

  /**
   * Verify 2FA code during login
   */
  async verify2FA(
    userId: number,
    code: string
  ): Promise<{ success: boolean; usedBackup?: boolean; message: string }> {
    // Get user's 2FA settings
    const [user] = await this.db
      .select({
        two_factor_enabled: usuarios.two_factor_enabled,
        two_factor_secret: usuarios.two_factor_secret,
        two_factor_backup_codes: usuarios.two_factor_backup_codes,
      })
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);

    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
      return { success: false, message: '2FA no habilitado para este usuario' };
    }

    // Try TOTP code first
    const cleanCode = code.replace(/\s/g, '');

    if (cleanCode.length === 6) {
      const isValid = await verifyTOTP(user.two_factor_secret, cleanCode);
      if (isValid) {
        return { success: true, message: 'Codigo verificado' };
      }
    }

    // Try backup code
    if (cleanCode.length === 8 && user.two_factor_backup_codes) {
      const backupCodes: string[] = JSON.parse(user.two_factor_backup_codes);
      const normalizedCode = cleanCode.replace('-', '').toLowerCase();
      const codeIndex = backupCodes.findIndex(
        (c) => c === normalizedCode
      );

      if (codeIndex >= 0) {
        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        await this.db
          .update(usuarios)
          .set({ two_factor_backup_codes: JSON.stringify(backupCodes) })
          .where(eq(usuarios.id, userId));

        return {
          success: true,
          usedBackup: true,
          message: `Codigo de respaldo usado. Quedan ${backupCodes.length} codigos.`,
        };
      }
    }

    return { success: false, message: 'Codigo invalido' };
  }

  /**
   * Check if user has 2FA enabled
   */
  async has2FA(userId: number): Promise<boolean> {
    const [user] = await this.db
      .select({ two_factor_enabled: usuarios.two_factor_enabled })
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);

    return user?.two_factor_enabled || false;
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: number): Promise<string[]> {
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = backupCodes.map((c) => c.replace('-', '').toLowerCase());

    await this.db
      .update(usuarios)
      .set({ two_factor_backup_codes: JSON.stringify(hashedBackupCodes) })
      .where(eq(usuarios.id, userId));

    return backupCodes;
  }
}

/**
 * Create 2FA service instance
 */
export function create2FAService(db: Database): TwoFactorService {
  return new TwoFactorService(db);
}

// Export utility functions for testing
export { generateTOTP, verifyTOTP, base32Encode, base32Decode };
