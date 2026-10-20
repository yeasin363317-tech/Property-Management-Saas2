import { beforeAll, describe, expect, it } from 'vitest';
import { newLandlord, obligationFor, resetDb, setupLease } from './helpers';

beforeAll(resetDb);

const pay = (c: any, obligationId: string, amount: string, key?: string) =>
  c.post('/payments', { obligationId, amount, paidAt: '2030-01-06', method: 'BANK_TRANSFER', reference: 'REF', idempotencyKey: key });

describe('rent obligations and payments', () => {
  it('generates one obligation per lease-month and is idempotent', async () => {
    const { c } = await newLandlord();
    await setupLease(c);
    const first = await c.post('/rent/obligations/generate', { month: '2030-03' });
    expect(first.body.data.created).toBe(1);
    const again = await c.post('/rent/obligations/generate', { month: '2030-03' });
    expect(again.body.data.created).toBe(0);
    const list = await c.get('/rent/obligations');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].amountDue).toBe('1000');
  });

  it('handles partial payments, balances, over-payment and full payment', async () => {
    const { c } = await newLandlord();
    await setupLease(c);
    const ob = await obligationFor(c, '2030-01');
    expect(ob.displayStatus).toBe('UNPAID');
    expect((await pay(c, ob.id, '400.50', 'key-partial-1')).status).toBe(201);
    let cur = (await c.get(`/rent/obligations/${ob.id}`)).body.data;
    expect(cur.status).toBe('PARTIAL');
    expect(cur.balance).toBe('599.50');
    const over = await pay(c, ob.id, '700', 'key-over-0001');
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('OVERPAYMENT');
    expect((await pay(c, ob.id, '599.50', 'key-final-001')).status).toBe(201);
    cur = (await c.get(`/rent/obligations/${ob.id}`)).body.data;
    expect(cur.status).toBe('PAID');
    expect(cur.balance).toBe('0.00');
    expect((await pay(c, ob.id, '1', 'key-after-paid')).status).toBe(409);
  });

  it('uses exact decimal arithmetic', async () => {
    const { c } = await newLandlord();
    await setupLease(c, { rent: '100.00' });
    const ob = await obligationFor(c, '2030-01');
    for (const [i, amt] of ['0.10', '0.20', '33.33'].entries()) expect((await pay(c, ob.id, amt, `key-dec-000${i}`)).status).toBe(201);
    expect((await c.get(`/rent/obligations/${ob.id}`)).body.data.balance).toBe('66.37');
  });

  it('does not double count a repeated request (idempotency key)', async () => {
    const { c } = await newLandlord();
    await setupLease(c);
    const ob = await obligationFor(c, '2030-01');
    const r1 = await pay(c, ob.id, '300', 'key-dup-00001');
    const r2 = await pay(c, ob.id, '300', 'key-dup-00001');
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    expect(r2.body.meta.duplicate).toBe(true);
    expect(r2.body.data.id).toBe(r1.body.data.id);
    expect((await c.get(`/rent/obligations/${ob.id}`)).body.data.balance).toBe('700.00');
    expect((await c.get('/payments')).body.data).toHaveLength(1);
  });

  it('survives concurrent duplicate submissions', async () => {
    const { c } = await newLandlord();
    await setupLease(c);
    const ob = await obligationFor(c, '2030-01');
    const rs = await Promise.all([1, 2, 3, 4].map(() => pay(c, ob.id, '250', 'key-race-0001')));
    expect(rs.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect((await c.get(`/rent/obligations/${ob.id}`)).body.data.balance).toBe('750.00');
  });

  it('marks unpaid and partially paid past-due obligations OVERDUE', async () => {
    const { c } = await newLandlord();
    await setupLease(c, { start: '2020-01-01', end: '2020-12-31' });
    const ob = await obligationFor(c, '2020-01');
    expect(ob.displayStatus).toBe('OVERDUE');
    await pay(c, ob.id, '100', 'key-late-00001');
    const cur = (await c.get(`/rent/obligations/${ob.id}`)).body.data;
    expect(cur.status).toBe('PARTIAL');
    expect(cur.displayStatus).toBe('OVERDUE');
    expect((await c.get('/rent/obligations?status=OVERDUE')).body.data).toHaveLength(1);
    expect((await c.get('/rent/obligations?status=PARTIAL')).body.data).toHaveLength(0);
  });

  it('reverses a payment with a correction record instead of deleting history', async () => {
    const { c } = await newLandlord();
    await setupLease(c);
    const ob = await obligationFor(c, '2030-01');
    const p = (await pay(c, ob.id, '1000', 'key-rev-00001')).body.data;
    expect((await c.get(`/rent/obligations/${ob.id}`)).body.data.status).toBe('PAID');
    const rev = await c.post(`/payments/${p.id}/reverse`, { reason: 'Bounced cheque' });
    expect(rev.status).toBe(201);
    expect(rev.body.data.amount).toBe('-1000');
    expect((await c.post(`/payments/${p.id}/reverse`, { reason: 'again again' })).status).toBe(409);
    const cur = (await c.get(`/rent/obligations/${ob.id}`)).body.data;
    expect(cur.status).toBe('UNPAID');
    expect(cur.payments).toHaveLength(2);
  });

  it('writes audit entries for payments', async () => {
    const { c } = await newLandlord();
    await setupLease(c);
    const ob = await obligationFor(c, '2030-01');
    await pay(c, ob.id, '10', 'key-audit-0001');
    const logs = (await c.get('/audit-logs')).body.data.map((l: any) => l.action);
    expect(logs).toContain('payment.record');
  });
});

describe('financial reports', () => {
  it('reports due, collected, outstanding, expenses and net cash flow separately', async () => {
    const { c } = await newLandlord();
    const { property } = await setupLease(c, { rent: '1000.00' });
    const jan = await obligationFor(c, '2030-01');
    await obligationFor(c, '2030-02');
    await pay(c, jan.id, '1000', 'key-rep-00001');
    await c.post('/expenses', { propertyId: property.id, category: 'REPAIRS', amount: '150.25', incurredAt: '2030-01-15' });
    const r = await c.get('/reports/summary?from=2030-01-01&to=2030-02-28');
    expect(r.body.data).toMatchObject({ rentDue: '2000.00', rentCollected: '1000.00', outstandingBalance: '1000.00', expenses: '150.25', netOperatingCashFlow: '849.75' });
    const m = await c.get('/reports/monthly?from=2030-01-01&to=2030-02-28');
    expect(m.body.data).toHaveLength(2);
    const csv = await c.get('/reports/by-property?from=2030-01-01&to=2030-02-28&format=csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('netOperatingCashFlow');
  });
});
