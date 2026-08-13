import { ProviderResult } from '@bytebeacon/shared';
import {
  ITelecomProvider,
  TelecomOrderDispatchParams,
  TelecomOrderDispatchData,
  TelecomOrderStatusData,
} from '../telecom/telecom-provider.interface.js';
import { logger } from '../../core/logging/logger.js';

/**
 * MockTelecomProvider for testing and local contract verification only.
 * MUST NOT be activated in production.
 *
 * NOTE: Vendor-specific behaviors for DataHouse are AUTHORITATIVE SOURCE NOT VERIFIED.
 * This mock contains only abstract generic test doubles.
 */
export class MockTelecomProvider implements ITelecomProvider {
  public readonly providerName = 'MOCK_TELECOM_PROVIDER (GENERIC TEST DOUBLE)';

  constructor() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PROVIDERS !== 'true') {
      throw new Error('FATAL SECURITY INVARIANT: MockTelecomProvider cannot be initialized in production environment.');
    }
    logger.warn('MockTelecomProvider initialized for local/test double use only.');
  }

  public async dispatchOrder(
    params: TelecomOrderDispatchParams,
  ): Promise<ProviderResult<TelecomOrderDispatchData>> {
    return {
      success: true,
      data: {
        providerReference: `mock_telco_ref_${params.clientReference}`,
        status: 'PROCESSING',
      },
      providerTransactionId: `mock_dispatch_${Date.now()}`,
    };
  }

  public async checkOrderStatus(
    providerReference: string,
  ): Promise<ProviderResult<TelecomOrderStatusData>> {
    return {
      success: true,
      data: {
        providerReference,
        clientReference: 'mock_client_ref',
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      },
      providerTransactionId: `mock_status_${Date.now()}`,
    };
  }

  public verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    return signature === 'mock-telco-signature';
  }
}
