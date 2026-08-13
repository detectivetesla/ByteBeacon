import { ProviderResult } from '@bytebeacon/shared';

export interface NotificationSendParams {
  recipient: string;
  channel: 'SMS' | 'EMAIL' | 'PUSH';
  subject?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationSendData {
  deliveryId: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
}

export interface INotificationProvider {
  readonly providerName: string;
  sendNotification(params: NotificationSendParams): Promise<ProviderResult<NotificationSendData>>;
}
