/**
 * Shared Type Primitives
 */

export interface SystemHealthCheck {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
  timestamp: string;
}

export type UUID = string;
export type ISODateString = string;
