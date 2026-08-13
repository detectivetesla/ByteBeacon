import { ProviderResult } from '@bytebeacon/shared';
import {
  IPaymentProvider,
  PaymentInitializationParams,
  PaymentInitializationData,
  PaymentVerificationData,
} from '../payment/payment-provider.interface.js';
import { logger } from '../../core/logging/logger.js';

/**
 * MockPaymentProvider for testing and local development only.
 * MUST NOT be activated in production.
 */
export class MockPaymentProvider implements IPaymentProvider {
  public readonly providerName = 'MOCK_PAYMENT_PROVIDER (NON-PRODUCTION)';

  constructor() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PROVIDERS !== 'true') {
      throw new Error('FATAL SECURITY INVARIANT: MockPaymentProvider cannot be initialized in production environment.');
    }
    logger.warn('MockPaymentProvider initialized. This provider is for local/test use only.');
  }

  public async initializePayment(
    params: PaymentInitializationParams,
  ): Promise<ProviderResult<PaymentInitializationData>> {
    return {
      success: true,
      data: {
        authorizationUrl: `https://checkout.bytebeacon.dev/mock-pay/${params.reference}`,
        accessCode: `mock_code_${Date.now()}`,
        reference: params.reference,
      },
      providerTransactionId: `mock_tx_${Date.now()}`,
    };
  }

  public async verifyPayment(reference: string): Promise<ProviderResult<PaymentVerificationData>> {
    return {
      success: true,
      data: {
        reference,
        amountPesewas: 5000,
        currency: 'GHS',
        status: 'success',
        paidAt: new Date().toISOString(),
        channel: 'mobile_money',
      },
      providerTransactionId: `mock_tx_verified_${Date.now()}`,
    };
  }

  public verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    return signature === 'mock-valid-signature';
  }
}
