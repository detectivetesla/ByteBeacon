import { pino, LoggerOptions } from 'pino';

export const sensitiveKeys = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'apiSecret',
  'paystackSecret',
  'databaseUrl',
  'connectionString',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.authorization',
  '*.cookie',
  '*.secret',
  '*.apiKey',
  '*.apiSecret',
  '*.paystackSecret',
  '*.databaseUrl',
  '*.connectionString',
];

export function createLogger(options?: { isDevelopment?: boolean; level?: string }) {
  const pinoConfig: LoggerOptions = {
    level: options?.level || process.env.LOG_LEVEL || 'info',
    redact: {
      paths: sensitiveKeys,
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return pino(pinoConfig);
}

export const logger = createLogger({
  isDevelopment: process.env.NODE_ENV === 'development',
});
