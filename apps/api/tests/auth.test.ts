import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { PASSWORD, client, newLandlord, resetDb } from './helpers';

beforeAll(resetDb);

describe('auth', () => {
  it('registers, reads profile, logs out and loses access', async () => {
    const { c, email } = await newLandlord('Ann');
    const me = await c.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
    expect(me.body.data.role).toBe('LANDLORD');
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
    expect((await c.post('/auth/logout')).status).toBe(204);
    expect((await c.get('/auth/me')).status).toBe(401);
  });

  it('ignores a client-supplied role on registration', async () => {
    const c = client();
    const r = await c.post('/auth/register', { email: 'sneaky@example.com', password: PASSWORD, name: 'S', role: 'ADMIN' });
    expect(r.status).toBe(201);
    expect(r.body.data.role).toBe('LANDLORD');
  });

  it('rejects wrong password and duplicate email', async () => {
    const { c, email } = await newLandlord();
    const other = client();
    expect((await other.post('/auth/login', { email, password: 'wrong-password-1' })).status).toBe(401);
    expect((await c.post('/auth/register', { email, password: PASSWORD, name: 'Dup' })).status).toBe(409);
  });

  it('rejects weak passwords with a validation error', async () => {
    const r = await client().post('/auth/register', { email: 'w@example.com', password: 'short', name: 'W' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('protects data routes without a session', async () => {
    for (const path of ['/properties', '/tenants', '/dashboard', '/payments', '/reports/summary']) {
      expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
    }
  });

  it('blocks state-changing requests that lack the CSRF header or come from a foreign origin', async () => {
    const { c } = await newLandlord();
    expect((await c.raw.post('/api/v1/properties').send({ name: 'x', address: 'y' })).status).toBe(403);
    const evil = await c.raw.post('/api/v1/properties').set('X-Requested-With', 'XMLHttpRequest').set('Origin', 'https://evil.example').send({ name: 'x', address: 'y' });
    expect(evil.status).toBe(403);
  });

  it('forbids non-admins from admin routes', async () => {
    const { c } = await newLandlord();
    expect((await c.get('/admin/users')).status).toBe(403);
  });

  it('does not reveal whether an email exists on password reset requests', async () => {
    const a = await client().post('/auth/forgot-password', { email: 'nobody@example.com' });
    expect(a.status).toBe(200);
  });
});
