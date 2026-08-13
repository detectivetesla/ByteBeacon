/**
 * Authentication and Security Interfaces for ByteBeacon.
 * Note: Complete authentication flows are deferred to future phases.
 * These abstractions define security boundaries for future implementation.
 */

export interface AuthenticatedPrincipal {
  id: string;
  role: 'CUSTOMER' | 'AGENT' | 'ADMIN' | 'SYSTEM';
  scopes: string[];
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: string;
  principalId: string;
  createdAt: Date;
  expiresAt: Date;
  revoked: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthenticationContext {
  principal: AuthenticatedPrincipal | null;
  session: Session | null;
  isAuthenticated: boolean;
  token?: string;
}

export interface TokenVerifier {
  verifyAccessToken(token: string): Promise<AuthenticatedPrincipal>;
  verifyRefreshToken(token: string): Promise<Session>;
}
