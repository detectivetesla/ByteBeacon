import { describe, it, expect } from 'vitest';
import { PasswordHasher } from '../src/core/security/password-hasher.js';
import { runArgon2Benchmark } from '../src/core/security/password-hasher.bench.js';

describe('Password Hashing (Argon2id)', () => {
  const testHasher = new PasswordHasher({
    memoryCost: 4096,
    timeCost: 1,
    parallelism: 1,
  });

  it('should hash a password and verify correctly', async () => {
    const rawPassword = 'SecurePassword2026!';
    const hash = await testHasher.hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const isValid = await testHasher.verifyPassword(hash, rawPassword);
    expect(isValid).toBe(true);

    const isInvalid = await testHasher.verifyPassword(hash, 'WrongPassword!');
    expect(isInvalid).toBe(false);
  });

  it('should run benchmark and record latency and resource utilization', async () => {
    const benchmark = await runArgon2Benchmark(
      { memoryCost: 4096, timeCost: 1, parallelism: 1 },
      2,
    );

    expect(benchmark.iterations).toBe(2);
    expect(benchmark.medianLatencyMs).toBeGreaterThan(0);
    expect(benchmark.p95LatencyMs).toBeGreaterThan(0);
    expect(benchmark.options.memoryCost).toBe(4096);
  });
});
