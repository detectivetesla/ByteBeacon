import { describe, it, expect, vi } from 'vitest';
import { BeneficiaryService } from '../src/core/commerce/beneficiary.service.js';
import { NetworkProvider, BeneficiaryValidationStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Beneficiary Validation (MTN / Telecom Pre-Check)', () => {
  it('should reject invalid phone number formats', async () => {
    const service = new BeneficiaryService({} as pg.Pool);

    await expect(service.validatePhoneNumber('12345', NetworkProvider.MTN)).rejects.toThrow(
      'Invalid Ghana phone number format',
    );
    await expect(service.validatePhoneNumber('0123456789', NetworkProvider.MTN)).rejects.toThrow(
      'Invalid Ghana phone number format',
    );
  });

  it('should validate valid Ghana numbers and return decoupled validation records', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('SELECT id, phone_number')) {
          return Promise.resolve({ rows: [] }); // Not cached
        }
        if (q.includes('INSERT INTO beneficiary_validation')) {
          return Promise.resolve({
            rows: [
              {
                id: 'val_123',
                phoneNumber: params[0],
                network: params[1],
                status: 'VALID',
                providerReference: null,
                validatedAt: new Date(),
                expiresAt: params[2],
                createdAt: new Date(),
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const service = new BeneficiaryService(mockDb);
    const result = await service.validatePhoneNumber('0244123456', NetworkProvider.MTN);

    expect(result.id).toBe('val_123');
    expect(result.phoneNumber).toBe('0244123456');
    expect(result.network).toBe(NetworkProvider.MTN);
    expect(result.status).toBe(BeneficiaryValidationStatus.VALID);
  });
});
