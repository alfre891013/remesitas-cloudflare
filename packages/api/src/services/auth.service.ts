import * as jose from 'jose';
import { eq, and, gt } from 'drizzle-orm';
import { usuarios, sessions } from '../db/schema';
import type { Database } from '../types';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Simple hash function for passwords (in production, use proper bcrypt)
// Note: For Cloudflare Workers, we use Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Generate random token for refresh tokens
function generateRefreshToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: number;
    username: string;
    nombre: string;
    rol: string;
  };
  error?: string;
}

export class AuthService {
  constructor(
    private db: Database,
    private jwtSecret: string
  ) {}

  async login(username: string, password: string): Promise<AuthResult> {
    // Find user
    const [user] = await this.db
      .select()
      .from(usuarios)
      .where(and(eq(usuarios.username, username), eq(usuarios.activo, true)))
      .limit(1);

    if (!user) {
      return { success: false, error: 'Usuario o contraseña incorrectos' };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'Usuario o contraseña incorrectos' };
    }

    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.db.insert(sessions).values({
      usuario_id: user.id,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString(),
    });

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    // Find valid session
    const now = new Date().toISOString();
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refresh_token, refreshToken),
          gt(sessions.expires_at, now)
        )
      )
      .limit(1);

    if (!session) {
      return { success: false, error: 'Token de actualización inválido' };
    }

    // Get user
    const [user] = await this.db
      .select()
      .from(usuarios)
      .where(and(eq(usuarios.id, session.usuario_id), eq(usuarios.activo, true)))
      .limit(1);

    if (!user) {
      return { success: false, error: 'Usuario no encontrado o inactivo' };
    }

    // Generate new access token
    const accessToken = await this.generateAccessToken(user);

    // Generate new refresh token and update session
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.db
      .update(sessions)
      .set({
        refresh_token: newRefreshToken,
        expires_at: expiresAt.toISOString(),
      })
      .where(eq(sessions.id, session.id));

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db
      .delete(sessions)
      .where(eq(sessions.refresh_token, refreshToken));
  }

  async logoutAll(userId: number): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.usuario_id, userId));
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const [user] = await this.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, userId))
      .limit(1);

    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'Contraseña actual incorrecta' };
    }

    const newHash = await hashPassword(newPassword);
    await this.db
      .update(usuarios)
      .set({
        password_hash: newHash,
        debe_cambiar_password: false,
      })
      .where(eq(usuarios.id, userId));

    // Invalidate all sessions
    await this.logoutAll(userId);

    return { success: true };
  }

  private async generateAccessToken(user: {
    id: number;
    username: string;
    rol: string;
  }): Promise<string> {
    const secret = new TextEncoder().encode(this.jwtSecret);

    const token = await new jose.SignJWT({
      sub: String(user.id),
      username: user.username,
      rol: user.rol,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(secret);

    return token;
  }

  // Utility method to hash password for creating users
  static async hashPassword(password: string): Promise<string> {
    return hashPassword(password);
  }
}
