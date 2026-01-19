// Service to generate unique remittance codes

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O to avoid confusion
const DIGITS = '0123456789';

export class CodeService {
  // Generate a unique remittance code
  // Format: REM-XXXXXX (e.g., REM-A3B7C9)
  static generate(): string {
    const chars = ALPHABET + DIGITS;
    let code = '';

    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      code += chars[randomIndex];
    }

    return `REM-${code}`;
  }

  // Generate a tracking-friendly code with date prefix
  // Format: YYMMDD-XXXX (e.g., 260119-A3B7)
  static generateWithDate(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');

    const chars = ALPHABET + DIGITS;
    let suffix = '';

    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      suffix += chars[randomIndex];
    }

    return `${year}${month}${day}-${suffix}`;
  }

  // Validate code format
  static isValid(code: string): boolean {
    // Accept both formats
    const remPattern = /^REM-[A-HJ-NP-Z0-9]{6}$/;
    const datePattern = /^\d{6}-[A-HJ-NP-Z0-9]{4}$/;

    return remPattern.test(code) || datePattern.test(code);
  }
}
