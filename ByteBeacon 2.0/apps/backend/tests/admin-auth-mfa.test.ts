import { describe, it, expect, vi } from 'vitest';
import { MfaService } from '../src/core/security/mfa.service.js';
import { RbacService } from '../src/core/security/rbac.service.js';
import { Permission, UserRole } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Admin Authentication, TOTP MFA & Granular RBAC', () => {
  it('should generate valid base32 TOTP secret and OTPAuth URI', () => {
    const secret = MfaService.generateSecret();
    expect(secret).toHaveLength(20);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);

    const uri = MfaService.generateOtpAuthUri('admin@bytebeacon.com', 'ByteBeacon', secret);
    expect(uri).toContain('otpauth://totp/ByteBeacon:admin%40bytebeacon.com');
    expect(uri).toContain(`secret=${secret}`);
  });

  it('should generate and verify backup recovery codes', () => {
    const { rawCodes, hashedCodes } = MfaService.generateRecoveryCodes(5);
    expect(rawCodes).toHaveLength(5);
    expect(hashedCodes).toHaveLength(5);

    for (const code of rawCodes) {
      expect(code).toMatch(/^[0-9A-F]{6}-[0-9A-F]{6}$/);
    }
  });

  it('should evaluate granular RBAC permissions correctly', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        const role = params[0] as string;
        if (role === 'customer') {
          return Promise.resolve({
            rows: [{ permissionId: Permission.ORDERS_READ }, { permissionId: Permission.ORDERS_CREATE }],
          });
        }
        if (role === 'admin') {
          return Promise.resolve({
            rows: [
              { permissionId: Permission.ORDERS_READ },
              { permissionId: Permission.ORDERS_CREATE },
              { permissionId: Permission.ORDERS_REFUND },
              { permissionId: Permission.AGENTS_SUSPEND },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const rbacService = new RbacService(mockDb);

    const customerCanRead = await rbacService.hasPermission(UserRole.CUSTOMER, Permission.ORDERS_READ);
    expect(customerCanRead).toBe(true);

    const customerCanRefund = await rbacService.hasPermission(UserRole.CUSTOMER, Permission.ORDERS_REFUND);
    expect(customerCanRefund).toBe(false);

    const adminCanRefund = await rbacService.hasPermission(UserRole.ADMIN, Permission.ORDERS_REFUND);
    expect(adminCanRefund).toBe(true);

    const adminCanSuspend = await rbacService.hasPermission(UserRole.ADMIN, Permission.AGENTS_SUSPEND);
    expect(adminCanSuspend).toBe(true);
  });
});
