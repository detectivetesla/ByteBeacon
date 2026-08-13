import { describe, it, expect } from 'vitest';
import { MockPaymentProvider } from '../src/providers/mocks/mock-payment.provider.js';
import { MockTelecomProvider } from '../src/providers/mocks/mock-telecom.provider.js';
import { MockNotificationProvider } from '../src/providers/mocks/mock-notification.provider.js';

describe('Provider Abstractions and Isolation', () => {
  it('MockPaymentProvider should fulfill IPaymentProvider contract', async () => {
    const provider = new MockPaymentProvider();
    expect(provider.providerName).toContain('MOCK');

    const initResult = await provider.initializePayment({
      amountPesewas: 1000,
      currency: 'GHS',
      email: 'test@example.com',
      reference: 'ref_123',
    });

    expect(initResult.success).toBe(true);
    if (initResult.success) {
      expect(initResult.data.reference).toBe('ref_123');
      expect(initResult.data.authorizationUrl).toContain('mock-pay');
    }

    const verifyResult = await provider.verifyPayment('ref_123');
    expect(verifyResult.success).toBe(true);
    if (verifyResult.success) {
      expect(verifyResult.data.status).toBe('success');
    }

    const validSig = provider.verifyWebhookSignature('payload', 'mock-valid-signature');
    expect(validSig).toBe(true);
  });

  it('MockTelecomProvider should fulfill ITelecomProvider contract', async () => {
    const provider = new MockTelecomProvider();
    expect(provider.providerName).toContain('MOCK');

    const dispatchResult = await provider.dispatchOrder({
      clientReference: 'telco_ref_1',
      network: 'MTN',
      recipientPhoneNumber: '0241234567',
      volumeMb: 1000,
    });

    expect(dispatchResult.success).toBe(true);
    if (dispatchResult.success) {
      expect(dispatchResult.data.providerReference).toBeDefined();
    }

    const statusResult = await provider.checkOrderStatus('telco_ref_1');
    expect(statusResult.success).toBe(true);
    if (statusResult.success) {
      expect(statusResult.data.status).toBe('COMPLETED');
    }
  });

  it('MockNotificationProvider should fulfill INotificationProvider contract', async () => {
    const provider = new MockNotificationProvider();
    const result = await provider.sendNotification({
      recipient: '0241234567',
      channel: 'SMS',
      message: 'Your code is 1234',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('SENT');
    }
  });
});
