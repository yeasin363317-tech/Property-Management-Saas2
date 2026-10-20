import { beforeAll, describe, expect, it } from 'vitest';
import { newLandlord, obligationFor, resetDb, setupLease } from './helpers';

beforeAll(resetDb);

describe('cross-landlord isolation', () => {
  it("landlord B cannot read, change or use landlord A's records by id", async () => {
    const a = await newLandlord('A');
    const b = await newLandlord('B');
    const { property, unit, tenant, lease } = await setupLease(a.c);
    const ob = await obligationFor(a.c, '2030-01');
    const pay = await a.c.post('/payments', { obligationId: ob.id, amount: '100', paidAt: '2030-01-05', method: 'CASH', idempotencyKey: 'a-key-00001' });
    expect(pay.status).toBe(201);
    const exp = (await a.c.post('/expenses', { propertyId: property.id, category: 'REPAIRS', amount: '50', incurredAt: '2030-01-10' })).body.data;
    const mr = (await a.c.post('/maintenance', { propertyId: property.id, title: 'Leak', description: 'Drip' })).body.data;

    const reads = [`/properties/${property.id}`, `/units/${unit.id}`, `/tenants/${tenant.id}`, `/leases/${lease.id}`, `/rent/obligations/${ob.id}`, `/payments/${pay.body.data.id}/receipt`];
    for (const p of reads) expect((await b.c.get(p)).status, p).toBe(404);

    expect((await b.c.patch(`/properties/${property.id}`, { name: 'hacked' })).status).toBe(404);
    expect((await b.c.patch(`/units/${unit.id}`, { monthlyRent: '1' })).status).toBe(404);
    expect((await b.c.patch(`/tenants/${tenant.id}`, { fullName: 'hacked' })).status).toBe(404);
    expect((await b.c.patch(`/expenses/${exp.id}`, { amount: '1' })).status).toBe(404);
    expect((await b.c.delete(`/expenses/${exp.id}`)).status).toBe(404);
    expect((await b.c.patch(`/maintenance/${mr.id}`, { status: 'RESOLVED' })).status).toBe(404);
    expect((await b.c.post(`/leases/${lease.id}/terminate`, { date: '2030-02-01' })).status).toBe(404);
    expect((await b.c.post(`/payments/${pay.body.data.id}/reverse`, { reason: 'steal' })).status).toBe(404);
    expect((await b.c.post(`/properties/${property.id}/archive`)).status).toBe(404);

    // Writing INTO another landlord's parents is also rejected.
    expect((await b.c.post('/units', { propertyId: property.id, number: '9', monthlyRent: '1' })).status).toBe(404);
    expect((await b.c.post('/payments', { obligationId: ob.id, amount: '10', paidAt: '2030-01-06', method: 'CASH' })).status).toBe(404);
    expect((await b.c.post('/expenses', { propertyId: property.id, category: 'OTHER', amount: '5', incurredAt: '2030-01-01' })).status).toBe(404);

    // Lists and reports show nothing for B.
    for (const p of ['/properties', '/units', '/tenants', '/leases', '/rent/obligations', '/payments', '/expenses', '/maintenance']) {
      expect((await b.c.get(p)).body.data, p).toHaveLength(0);
    }
    const sum = await b.c.get('/reports/summary?from=2030-01-01&to=2030-12-31');
    expect(sum.body.data.rentCollected).toBe('0.00');
    expect(sum.body.data.outstandingBalance).toBe('0.00');

    // A's data is untouched.
    expect((await a.c.get(`/properties/${property.id}`)).body.data.name).toBe('Prop');
    expect((await a.c.get(`/rent/obligations/${ob.id}`)).body.data.paidAmount).toBe('100');
  });
});
