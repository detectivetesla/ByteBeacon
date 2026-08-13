import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { BadRequestError } from '../src/core/errors/app-error.js';

describe('Error Handling and Formatting', () => {
  it('should format custom AppError in standard JSON envelope', async () => {
    const app = createApp();

    app.get('/test-error', async () => {
      throw new BadRequestError('Invalid query field', [
        { field: 'phone', code: 'INVALID_FORMAT', message: 'Phone format invalid' },
      ]);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INVALID_INPUT');
    expect(body.error.message).toBe('Invalid query field');
    expect(body.error.details).toHaveLength(1);
    expect(body.error.details[0].field).toBe('phone');
    expect(body.error.requestId).toBeDefined();
  });

  it('should return standardized 404 error envelope for missing routes', async () => {
    const app = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-route',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBeDefined();
  });
});
