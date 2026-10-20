import request from 'supertest';
import { expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';

export const PASSWORD = 'CorrectHorse9!';
let counter = 0;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AuditLog","Notification","MaintenanceRequest","Expense","RentPayment","RentObligation","Lease","Tenant","Unit","Property","PasswordResetToken","Session","User" CASCADE',
  );
}

export function client() {
  const agent = request.agent(app);
  const h = (r: request.Test) => r.set('X-Requested-With', 'XMLHttpRequest');
  return {
    raw: agent,
    get: (p: string) => agent.get(`/api/v1${p}`),
    post: (p: string, b?: object) => h(agent.post(`/api/v1${p}`)).send(b ?? {}),
    patch: (p: string, b?: object) => h(agent.patch(`/api/v1${p}`)).send(b ?? {}),
    delete: (p: string) => h(agent.delete(`/api/v1${p}`)),
  };
}
export type Client = ReturnType<typeof client>;

export async function newLandlord(name = 'Landlord') {
  const c = client();
  const email = `user${++counter}-${Date.now()}@example.com`;
  const r = await c.post('/auth/register', { email, password: PASSWORD, name });
  expect(r.status).toBe(201);
  return { c, email, id: r.body.data.id as string };
}

/** Creates property -> unit -> tenant -> lease (and the obligation for the lease's first month). */
export async function setupLease(c: Client, opts: { rent?: string; start?: string; end?: string; dueDay?: number } = {}) {
  const p = (await c.post('/properties', { name: 'Prop', address: '1 Test St' })).body.data;
  const u = (await c.post('/units', { propertyId: p.id, number: '1A', monthlyRent: opts.rent ?? '1000.00' })).body.data;
  const t = (await c.post('/tenants', { fullName: 'Tina Tenant' })).body.data;
  const lr = await c.post('/leases', {
    unitId: u.id,
    tenantId: t.id,
    startDate: opts.start ?? '2030-01-01',
    endDate: opts.end ?? '2030-12-31',
    monthlyRent: opts.rent ?? '1000.00',
    securityDeposit: '500',
    dueDay: opts.dueDay ?? 5,
  });
  expect(lr.status).toBe(201);
  return { property: p, unit: u, tenant: t, lease: lr.body.data };
}

export async function obligationFor(c: Client, month: string) {
  const g = await c.post('/rent/obligations/generate', { month });
  expect(g.status).toBe(200);
  const list = await c.get('/rent/obligations?pageSize=100');
  return list.body.data.find((o: any) => o.periodMonth.startsWith(month));
}
