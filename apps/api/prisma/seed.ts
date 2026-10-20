/**
 * DEMO DATA ONLY. Refuses to run unless DEMO_SEED=true and DEMO_PASSWORD is set.
 * All names/addresses are fictional. Never run against a production database.
 */
import argon2 from 'argon2';
import { prisma } from '../src/db';
import { createLease } from '../src/modules/leases/lease.service';
import { generateObligations, recordPayment } from '../src/modules/rent/rent.service';
import { parseDate } from '../src/utils/dates';

async function main() {
  if (process.env.DEMO_SEED !== 'true' || !process.env.DEMO_PASSWORD) throw new Error('Set DEMO_SEED=true and DEMO_PASSWORD to seed demo data');
  const email = 'demo.landlord@example.com';
  if (await prisma.user.findUnique({ where: { email } })) return console.log('Demo data already present');
  const user = await prisma.user.create({ data: { email, name: 'Demo Landlord', passwordHash: await argon2.hash(process.env.DEMO_PASSWORD, { type: argon2.argon2id }) } });
  const ownerId = user.id;
  const p1 = await prisma.property.create({ data: { ownerId, name: 'Maple Court (demo)', address: '12 Example Street, Sampletown' } });
  const p2 = await prisma.property.create({ data: { ownerId, name: 'Harbor View (demo)', address: '48 Sample Avenue, Sampletown' } });
  const units = [];
  for (const [p, n, rent] of [[p1, '1A', '900'], [p1, '1B', '950'], [p1, '2A', '1000'], [p2, '101', '1200'], [p2, '102', '1250']] as const) {
    units.push(await prisma.unit.create({ data: { ownerId, propertyId: p.id, number: n, monthlyRent: rent } }));
  }
  const names = ['Alex Sample', 'Jordan Example', 'Taylor Demo', 'Morgan Test'];
  const year = new Date().getUTCFullYear();
  for (let i = 0; i < names.length; i++) {
    const t = await prisma.tenant.create({ data: { ownerId, fullName: names[i], email: `tenant${i + 1}@example.com`, phone: `555-010${i}` } });
    await createLease(ownerId, ownerId, { unitId: units[i].id, tenantId: t.id, startDate: parseDate(`${year}-01-01`), endDate: parseDate(`${year + 1}-12-31`), monthlyRent: units[i].monthlyRent.toFixed(2), securityDeposit: units[i].monthlyRent.toFixed(2), dueDay: 1 });
  }
  for (let m = 1; m <= new Date().getUTCMonth() + 1; m++) await generateObligations(parseDate(`${year}-${String(m).padStart(2, '0')}-01`), ownerId);
  const obs = await prisma.rentObligation.findMany({ where: { ownerId }, orderBy: { dueDate: 'asc' } });
  for (const [i, o] of obs.entries()) {
    if (i % 5 === 4) continue; // leave some unpaid on purpose
    const amount = i % 7 === 3 ? o.amountDue.div(2).toFixed(2) : o.amountDue.toFixed(2);
    await recordPayment(ownerId, ownerId, { obligationId: o.id, amount, paidAt: o.dueDate, method: 'BANK_TRANSFER', idempotencyKey: `seed-${o.id}` });
  }
  await prisma.expense.create({ data: { ownerId, propertyId: p1.id, category: 'REPAIRS', amount: '240.00', incurredAt: parseDate(`${year}-02-10`), notes: 'Plumbing repair (demo)' } });
  await prisma.maintenanceRequest.create({ data: { ownerId, propertyId: p2.id, unitId: units[3].id, title: 'Leaking tap (demo)', description: 'Kitchen tap drips constantly.', priority: 'MEDIUM' } });
  console.log(`Demo data created. Login: ${email}`);
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
