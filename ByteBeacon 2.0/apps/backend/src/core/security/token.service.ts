import crypto from 'node:crypto';
import { SecurityDomain, UserRole } from '@bytebeacon/shared';
import { UnauthorizedError } from '../errors/app-error.js';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  domain: SecurityDomain;
  sessionId?: string;
  iat: number;
  exp: number;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export class TokenService {
  private readonly jwtSecret: string;
  private readonly accessTokenTtlSeconds: number;

  constructor(jwtSecret: string, accessTokenTtlSeconds = 900) {
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT Secret must be at least 32 characters long for cryptographic security');
    }
    this.jwtSecret = jwtSecret;
    this.accessTokenTtlSeconds = accessTokenTtlSeconds;
  }

  public signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + this.accessTokenTtlSeconds,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(dataToSign)
      .digest('base64url');

    return `${dataToSign}.${signature}`;
  }

  public verifyAccessToken(token: string): JwtPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Authentication token missing or invalid format');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedError('Invalid token structure');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(dataToSign)
      .digest('base64url');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      throw new UnauthorizedError('Invalid token signature');
    }

    try {
      const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as JwtPayload;

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new UnauthorizedError('Token has expired');
      }

      return payload;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Malformed token payload');
    }
  }

  public generateRefreshToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  public getAccessTokenTtl(): number {
    return this.accessTokenTtlSeconds;
  }
}
