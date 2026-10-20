import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('health', () => {
  it('reports liveness and database readiness', async () => {
    expect((await request(app).get('/api/v1/health')).body.status).toBe('ok');
    expect((await request(app).get('/api/v1/ready')).body.status).toBe('ready');
  });
  it('returns JSON 404 for unknown routes without leaking internals', async () => {
    const r = await request(app).get('/nope');
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toMatch(/stack|prisma/i);
  });
});
