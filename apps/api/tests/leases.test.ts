import { beforeAll, describe, expect, it } from 'vitest';
import { newLandlord, resetDb, setupLease } from './helpers';

beforeAll(resetDb);

describe('properties, units, tenants', () => {
  it('supports create, update, search and archive', async () => {
    const { c } = await newLandlord();
    const p = (await c.post('/properties', { name: 'Oak House', address: '5 Oak Rd' })).body.data;
    expect((await c.patch(`/properties/${p.id}`, { name: 'Oak House II' })).body.data.name).toBe('Oak House II');
    expect((await c.get('/properties?search=oak')).body.data).toHaveLength(1);
    expect((await c.get('/properties?search=zzz')).body.data).toHaveLength(0);
    expect((await c.post(`/properties/${p.id}/archive`)).status).toBe(204);
    expect((await c.get('/properties')).body.data).toHaveLength(0);
    expect((await c.get('/properties?archived=true')).body.data).toHaveLength(1);
  });

  it('rejects invalid input and duplicate unit numbers', async () => {
    const { c } = await newLandlord();
    expect((await c.post('/properties', { name: '', address: 'x' })).status).toBe(400);
    const p = (await c.post('/properties', { name: 'P', address: 'A' })).body.data;
    expect((await c.post('/units', { propertyId: p.id, number: '1', monthlyRent: '-5' })).status).toBe(400);
    expect((await c.post('/units', { propertyId: p.id, number: '1', monthlyRent: '10.999' })).status).toBe(400);
    expect((await c.post('/units', { propertyId: p.id, number: '1', monthlyRent: '10' })).status).toBe(201);
    expect((await c.post('/units', { propertyId: p.id, number: '1', monthlyRent: '10' })).status).toBe(409);
  });
});

describe('leases', () => {
  it('validates dates and prevents overlapping active leases', async () => {
    const { c } = await newLandlord();
    const { unit } = await setupLease(c);
    const t2 = (await c.post('/tenants', { fullName: 'Second Tenant' })).body.data;
    const base = { unitId: unit.id, tenantId: t2.id, monthlyRent: '900', dueDay: 1 };
    expect((await c.post('/leases', { ...base, startDate: '2030-06-01', endDate: '2030-07-01' })).status).toBe(409);
    expect((await c.post('/leases', { ...base, startDate: '2031-01-01', endDate: '2030-01-01' })).status).toBe(400);
    expect((await c.post('/leases', { ...base, startDate: '2031-01-01', endDate: '2031-12-31', dueDay: 31 })).status).toBe(400);
    expect((await c.post('/leases', { ...base, startDate: '2031-01-01', endDate: '2031-12-31' })).status).toBe(201);
  });

  it('marks the unit occupied, then vacant after termination, and keeps history', async () => {
    const { c } = await newLandlord();
    const { unit, lease } = await setupLease(c);
    expect((await c.get(`/units/${unit.id}`)).body.data.status).toBe('OCCUPIED');
    expect((await c.post(`/leases/${lease.id}/terminate`, { date: '2030-03-31', reason: 'Moved out' })).status).toBe(200);
    expect((await c.get(`/units/${unit.id}`)).body.data.status).toBe('VACANT');
    const l = (await c.get(`/leases/${lease.id}`)).body.data;
    expect(l.status).toBe('TERMINATED');
    expect((await c.post(`/leases/${lease.id}/terminate`, { date: '2030-04-01' })).status).toBe(409);
  });

  it('renews a lease into a linked follow-on lease', async () => {
    const { c } = await newLandlord();
    const { lease, unit } = await setupLease(c);
    const r = await c.post(`/leases/${lease.id}/renew`, { endDate: '2031-12-31', monthlyRent: '1100' });
    expect(r.status).toBe(201);
    expect(r.body.data.startDate.slice(0, 10)).toBe('2031-01-01');
    expect(r.body.data.renewedFromId).toBe(lease.id);
    expect((await c.get(`/leases/${lease.id}`)).body.data.status).toBe('RENEWED');
    expect((await c.get(`/units/${unit.id}`)).body.data.status).toBe('OCCUPIED');
  });

  it('refuses to deactivate a tenant with an active lease', async () => {
    const { c } = await newLandlord();
    const { tenant } = await setupLease(c);
    expect((await c.patch(`/tenants/${tenant.id}`, { active: false })).status).toBe(409);
  });
});
