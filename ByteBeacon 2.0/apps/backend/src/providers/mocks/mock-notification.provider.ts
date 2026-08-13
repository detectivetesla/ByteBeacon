import { ProviderResult } from '@bytebeacon/shared';
import {
  INotificationProvider,
  NotificationSendParams,
  NotificationSendData,
} from '../notification/notification-provider.interface.js';
import { logger } from '../../core/logging/logger.js';

export class MockNotificationProvider implements INotificationProvider {
  public readonly providerName = 'MOCK_NOTIFICATION_PROVIDER (NON-PRODUCTION)';

  constructor() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PROVIDERS !== 'true') {
      throw new Error('FATAL SECURITY INVARIANT: MockNotificationProvider cannot be initialized in production environment.');
    }
    logger.warn('MockNotificationProvider initialized for local/test double use only.');
  }

  public async sendNotification(
    params: NotificationSendParams,
  ): Promise<ProviderResult<NotificationSendData>> {
    logger.info({ recipient: params.recipient, channel: params.channel }, 'Mock notification sent');
    return {
      success: true,
      data: {
        deliveryId: `mock_notif_${Date.now()}`,
        status: 'SENT',
      },
    };
  }
}
