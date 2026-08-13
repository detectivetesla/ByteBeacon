import { ProviderResult } from '@bytebeacon/shared';

export interface PaymentInitializationParams {
  amountPesewas: number;
  currency: 'GHS';
  email: string;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitializationData {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaymentVerificationData {
  reference: string;
  amountPesewas: number;
  currency: 'GHS';
  status: 'success' | 'failed' | 'abandoned';
  paidAt?: string;
  channel?: string;
}

export interface IPaymentProvider {
  readonly providerName: string;
  initializePayment(params: PaymentInitializationParams): Promise<ProviderResult<PaymentInitializationData>>;
  verifyPayment(reference: string): Promise<ProviderResult<PaymentVerificationData>>;
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
}
