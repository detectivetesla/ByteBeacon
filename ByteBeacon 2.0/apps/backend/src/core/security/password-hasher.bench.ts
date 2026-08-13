import { PasswordHasher, Argon2Options } from './password-hasher.js';

export interface BenchmarkResult {
  options: Argon2Options;
  iterations: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
}

export async function runArgon2Benchmark(
  options: Argon2Options = { memoryCost: 65536, timeCost: 3, parallelism: 4 },
  iterations = 10,
): Promise<BenchmarkResult> {
  const hasher = new PasswordHasher(options);
  const samplePassword = 'BenchmarkPasswordSecret123!';
  const latencies: number[] = [];

  const startMemory = process.memoryUsage().heapUsed;
  const startCpu = process.cpuUsage();
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now();
    await hasher.hashPassword(samplePassword);
    const iterEnd = performance.now();
    latencies.push(iterEnd - iterStart);
  }

  const endTime = Date.now();
  const endCpu = process.cpuUsage(startCpu);
  const endMemory = process.memoryUsage().heapUsed;

  latencies.sort((a, b) => a - b);
  const medianLatencyMs = latencies[Math.floor(latencies.length / 2)];
  const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)];

  const totalCpuMicroseconds = endCpu.user + endCpu.system;
  const totalWallMicroseconds = (endTime - startTime) * 1000;
  const cpuUsagePercent = (totalCpuMicroseconds / totalWallMicroseconds) * 100;
  const memoryUsageMb = (endMemory - startMemory) / (1024 * 1024);

  return {
    options,
    iterations,
    medianLatencyMs: parseFloat(medianLatencyMs.toFixed(2)),
    p95LatencyMs: parseFloat(p95LatencyMs.toFixed(2)),
    memoryUsageMb: parseFloat(memoryUsageMb.toFixed(2)),
    cpuUsagePercent: parseFloat(cpuUsagePercent.toFixed(2)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  /* eslint-disable no-console */
  console.log('Running Argon2id Benchmark...');
  runArgon2Benchmark()
    .then((res) => {
      console.log('Benchmark Result:', JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error('Benchmark Error:', err);
      process.exit(1);
    });
}
