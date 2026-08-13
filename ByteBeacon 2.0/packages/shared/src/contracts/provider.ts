/**
 * Provider Result contracts for external integrations.
 */

export interface ProviderSuccessResult<T> {
  success: true;
  data: T;
  providerTransactionId?: string;
  rawResponse?: Record<string, unknown>;
}

export interface ProviderErrorResult {
  success: false;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  rawResponse?: Record<string, unknown>;
}

export type ProviderResult<T> = ProviderSuccessResult<T> | ProviderErrorResult;

export enum ProviderExecutionMode {
  LIVE = 'LIVE',
  MOCK = 'MOCK',
}
