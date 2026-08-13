import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535))
    .default('3000'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgres://postgres:postgres@localhost:5432/bytebeacon_dev'),
  REDIS_URL: z
    .string()
    .min(1, 'REDIS_URL is required')
    .default('redis://localhost:6379'),
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url('Invalid CORS origin URL')))
    .default('http://localhost:5173,http://localhost:3000'),
  ALLOW_MOCK_PROVIDERS: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default('true'),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env | null = null;

export function loadConfig(overrideEnv?: Record<string, string | undefined>): Env {
  const envToParse = overrideEnv ?? process.env;
  const result = envSchema.safeParse(envToParse);

  if (!result.success) {
    const formattedErrors = result.error.format();
    const errorMessage = `FATAL: Invalid environment configuration:\n${JSON.stringify(
      formattedErrors,
      null,
      2,
    )}`;
    throw new Error(errorMessage);
  }

  parsedEnv = result.data;
  return result.data;
}

export function getConfig(): Env {
  if (!parsedEnv) {
    return loadConfig();
  }
  return parsedEnv;
}
