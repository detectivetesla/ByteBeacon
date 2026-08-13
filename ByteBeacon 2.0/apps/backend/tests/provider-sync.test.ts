import { describe, it, expect, vi } from 'vitest';
import { ProviderSyncService } from '../src/core/commerce/provider-sync.service.js';
import { ProviderStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Provider Projection & Stale Event Protection', () => {
  it('should ignore stale out-of-order provider events and apply newer events', async () => {
    let currentProviderStatus = ProviderStatus.PROCESSING;
    let currentSyncVersion = 5;
    const initialTimestamp = new Date('2026-08-13T12:00:00Z');
    let lastEventTimestamp = initialTimestamp;
    const syncRecords: Array<Record<string, unknown>> = [];

    const mockClient = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q === 'BEGIN' || q === 'COMMIT') return Promise.resolve({});
        if (q.includes('SELECT id, provider_status')) {
          return Promise.resolve({
            rows: [
              {
                id: 'po_1',
                providerStatus: currentProviderStatus,
                syncVersion: currentSyncVersion,
                lastProviderEventAt: lastEventTimestamp,
              },
            ],
          });
        }
        if (q.includes('UPDATE provider_orders')) {
          currentProviderStatus = params[0] as ProviderStatus;
          lastEventTimestamp = params[2] as Date;
          currentSyncVersion = params[3] as number;
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('UPDATE orders SET provider_status')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO provider_sync_records')) {
          syncRecords.push({
            orderId: params[0],
            providerName: params[1],
            eventTimestamp: params[2],
            eventVersion: params[3],
            statusReceived: params[4],
            isApplied: params[5],
            reason: params[6] || null,
          });
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;

    const syncService = new ProviderSyncService(mockDb);

    // 1. Send a stale event with an older timestamp (11:00:00Z) and lower version (4)
    const staleResult = await syncService.syncProviderEvent({
      orderId: 'ord_sync_1',
      providerName: 'GMPL',
      providerStatus: ProviderStatus.RECEIVED,
      eventTimestamp: new Date('2026-08-13T11:00:00Z'),
      eventVersion: 4,
    });

    expect(staleResult.applied).toBe(false);
    expect(staleResult.newStatus).toBe(ProviderStatus.PROCESSING); // Status was not rolled back to RECEIVED!
    expect(staleResult.reason).toContain('Stale provider event ignored');

    // 2. Send a newer event with a future timestamp (13:00:00Z) and higher version (6)
    const newerResult = await syncService.syncProviderEvent({
      orderId: 'ord_sync_1',
      providerName: 'GMPL',
      providerStatus: ProviderStatus.COMPLETED,
      eventTimestamp: new Date('2026-08-13T13:00:00Z'),
      eventVersion: 6,
    });

    expect(newerResult.applied).toBe(true);
    expect(newerResult.newStatus).toBe(ProviderStatus.COMPLETED);
    expect(currentProviderStatus).toBe(ProviderStatus.COMPLETED);
    expect(currentSyncVersion).toBe(6);
  });
});
