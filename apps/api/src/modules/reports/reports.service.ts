import { Prisma } from '@prisma/client';
import { prisma } from '../../db';

const D = Prisma.Decimal;
const money = (v: string | null | undefined) => new D(v ?? 0);
type Scope = { ownerId: string; from: string; to: string; propertyId?: string | null };

const propFilterObl = (s: Scope) => (s.propertyId ? Prisma.sql`AND u."propertyId" = ${s.propertyId}::uuid` : Prisma.empty);

/**
 * Definitions:
 *  rentDue            = sum of obligations whose due date is in [from, to]
 *  rentCollected      = sum of payments (net of reversals) with paidAt in [from, to]
 *  outstandingBalance = current unpaid balance of obligations due on or before `to`
 *  expenses           = sum of expenses incurred in [from, to]
 *  netOperatingCashFlow = rentCollected - expenses   (NOT profit)
 */
export async function summary(s: Scope) {
  const pf = propFilterObl(s);
  const [due, collected, outstanding, expenses] = await Promise.all([
    prisma.$queryRaw<{ v: string }[]>`SELECT COALESCE(SUM(o."amountDue"),0)::text AS v FROM "RentObligation" o JOIN "Lease" l ON l."id"=o."leaseId" JOIN "Unit" u ON u."id"=l."unitId" WHERE o."ownerId"=${s.ownerId}::uuid AND o."dueDate" BETWEEN ${s.from}::date AND ${s.to}::date ${pf}`,
    prisma.$queryRaw<{ v: string }[]>`SELECT COALESCE(SUM(p."amount"),0)::text AS v FROM "RentPayment" p JOIN "RentObligation" o ON o."id"=p."obligationId" JOIN "Lease" l ON l."id"=o."leaseId" JOIN "Unit" u ON u."id"=l."unitId" WHERE p."ownerId"=${s.ownerId}::uuid AND p."paidAt" BETWEEN ${s.from}::date AND ${s.to}::date ${pf}`,
    prisma.$queryRaw<{ v: string }[]>`SELECT COALESCE(SUM(o."amountDue"-o."paidAmount"),0)::text AS v FROM "RentObligation" o JOIN "Lease" l ON l."id"=o."leaseId" JOIN "Unit" u ON u."id"=l."unitId" WHERE o."ownerId"=${s.ownerId}::uuid AND o."status"<>'PAID' AND o."dueDate" <= ${s.to}::date ${pf}`,
    prisma.$queryRaw<{ v: string }[]>`SELECT COALESCE(SUM(e."amount"),0)::text AS v FROM "Expense" e WHERE e."ownerId"=${s.ownerId}::uuid AND e."incurredAt" BETWEEN ${s.from}::date AND ${s.to}::date ${s.propertyId ? Prisma.sql`AND e."propertyId"=${s.propertyId}::uuid` : Prisma.empty}`,
  ]);
  const rentCollected = money(collected[0]?.v);
  const exp = money(expenses[0]?.v);
  return {
    from: s.from,
    to: s.to,
    rentDue: money(due[0]?.v).toFixed(2),
    rentCollected: rentCollected.toFixed(2),
    outstandingBalance: money(outstanding[0]?.v).toFixed(2),
    expenses: exp.toFixed(2),
    netOperatingCashFlow: rentCollected.minus(exp).toFixed(2),
  };
}

export async function monthly(s: Scope) {
  const pf = propFilterObl(s);
  const [due, coll, exp] = await Promise.all([
    prisma.$queryRaw<{ m: string; v: string }[]>`SELECT to_char(date_trunc('month', o."dueDate"),'YYYY-MM') AS m, SUM(o."amountDue")::text AS v FROM "RentObligation" o JOIN "Lease" l ON l."id"=o."leaseId" JOIN "Unit" u ON u."id"=l."unitId" WHERE o."ownerId"=${s.ownerId}::uuid AND o."dueDate" BETWEEN ${s.from}::date AND ${s.to}::date ${pf} GROUP BY 1`,
    prisma.$queryRaw<{ m: string; v: string }[]>`SELECT to_char(date_trunc('month', p."paidAt"),'YYYY-MM') AS m, SUM(p."amount")::text AS v FROM "RentPayment" p JOIN "RentObligation" o ON o."id"=p."obligationId" JOIN "Lease" l ON l."id"=o."leaseId" JOIN "Unit" u ON u."id"=l."unitId" WHERE p."ownerId"=${s.ownerId}::uuid AND p."paidAt" BETWEEN ${s.from}::date AND ${s.to}::date ${pf} GROUP BY 1`,
    prisma.$queryRaw<{ m: string; v: string }[]>`SELECT to_char(date_trunc('month', e."incurredAt"),'YYYY-MM') AS m, SUM(e."amount")::text AS v FROM "Expense" e WHERE e."ownerId"=${s.ownerId}::uuid AND e."incurredAt" BETWEEN ${s.from}::date AND ${s.to}::date ${s.propertyId ? Prisma.sql`AND e."propertyId"=${s.propertyId}::uuid` : Prisma.empty} GROUP BY 1`,
  ]);
  const months = new Map<string, { month: string; rentDue: Prisma.Decimal; rentCollected: Prisma.Decimal; expenses: Prisma.Decimal }>();
  const row = (m: string) => {
    if (!months.has(m)) months.set(m, { month: m, rentDue: new D(0), rentCollected: new D(0), expenses: new D(0) });
    return months.get(m)!;
  };
  due.forEach((r) => (row(r.m).rentDue = money(r.v)));
  coll.forEach((r) => (row(r.m).rentCollected = money(r.v)));
  exp.forEach((r) => (row(r.m).expenses = money(r.v)));
  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ month: r.month, rentDue: r.rentDue.toFixed(2), rentCollected: r.rentCollected.toFixed(2), expenses: r.expenses.toFixed(2), netOperatingCashFlow: r.rentCollected.minus(r.expenses).toFixed(2) }));
}

export async function byProperty(s: Scope) {
  const [props, due, coll, outs, exp] = await Promise.all([
    prisma.property.findMany({ where: { ownerId: s.ownerId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.$queryRaw<{ id: string; v: string }[]>`SELECT u."propertyId"::text AS id, SUM(o."amountDue")::text AS v FROM "RentObligation" o JOIN "Lease" l ON l."id"=o."leaseId" JOIN "Unit" u ON u."id"=l."unitId" WHERE o."ownerId"=${s.ownerId}::uuid AND o."dueDate" BETWEEN ${s.from}::date AND ${s.to}::date GROUP BY 1`,
    prisma.$queryRaw<{ id: string; v: string }[]>`SELECT u."propertyId"::text AS id, SUM(p."amount")::text AS v FROM "RentPayment" p JOIN "RentObligation" o ON o."id"=p."obligationId" JOIN "Lease" l ON l."id"=o."leaseId" JOIN "Unit" u ON u."id"=l."unitId" WHERE p."ownerId"=${s.ownerId}::uuid AND p."paidAt" BETWEEN ${s.from}::date AND ${s.to}::date GROUP BY 1`,
    prisma.$queryRaw<{ id: string; v: string }[]>`SELECT u."propertyId"::text AS id, SUM(o."amountDue"-o."paidAmount")::text AS v FROM "RentObligation" o JOIN "Lease" l ON l."id"=o."leaseId" JOIN "Unit" u ON u."id"=l."unitId" WHERE o."ownerId"=${s.ownerId}::uuid AND o."status"<>'PAID' AND o."dueDate" <= ${s.to}::date GROUP BY 1`,
    prisma.$queryRaw<{ id: string; v: string }[]>`SELECT e."propertyId"::text AS id, SUM(e."amount")::text AS v FROM "Expense" e WHERE e."ownerId"=${s.ownerId}::uuid AND e."propertyId" IS NOT NULL AND e."incurredAt" BETWEEN ${s.from}::date AND ${s.to}::date GROUP BY 1`,
  ]);
  const pick = (rows: { id: string; v: string }[], id: string) => money(rows.find((r) => r.id === id)?.v);
  return props.map((p) => {
    const c = pick(coll, p.id);
    const e = pick(exp, p.id);
    return { property: p.name, rentDue: pick(due, p.id).toFixed(2), rentCollected: c.toFixed(2), outstandingBalance: pick(outs, p.id).toFixed(2), expenses: e.toFixed(2), netOperatingCashFlow: c.minus(e).toFixed(2) };
  });
}

export async function outstanding(s: Scope) {
  const rows = await prisma.rentObligation.findMany({
    where: { ownerId: s.ownerId, status: { not: 'PAID' }, dueDate: { lte: new Date(`${s.to}T00:00:00.000Z`) }, ...(s.propertyId ? { lease: { unit: { propertyId: s.propertyId } } } : {}) },
    include: { lease: { select: { tenant: { select: { fullName: true } }, unit: { select: { number: true, property: { select: { name: true } } } } } } },
    orderBy: { dueDate: 'asc' },
  });
  return rows.map((o) => ({
    tenant: o.lease.tenant.fullName,
    property: o.lease.unit.property.name,
    unit: o.lease.unit.number,
    dueDate: o.dueDate.toISOString().slice(0, 10),
    amountDue: o.amountDue.toFixed(2),
    paid: o.paidAmount.toFixed(2),
    balance: o.amountDue.minus(o.paidAmount).toFixed(2),
  }));
}

export async function collections(s: Scope) {
  const rows = await prisma.rentPayment.findMany({
    where: { ownerId: s.ownerId, paidAt: { gte: new Date(`${s.from}T00:00:00.000Z`), lte: new Date(`${s.to}T00:00:00.000Z`) }, ...(s.propertyId ? { obligation: { lease: { unit: { propertyId: s.propertyId } } } } : {}) },
    include: { obligation: { select: { periodMonth: true, lease: { select: { tenant: { select: { fullName: true } }, unit: { select: { number: true, property: { select: { name: true } } } } } } } } },
    orderBy: { paidAt: 'asc' },
  });
  return rows.map((p) => ({
    date: p.paidAt.toISOString().slice(0, 10),
    tenant: p.obligation.lease.tenant.fullName,
    property: p.obligation.lease.unit.property.name,
    unit: p.obligation.lease.unit.number,
    period: p.obligation.periodMonth.toISOString().slice(0, 7),
    type: p.kind,
    method: p.method,
    reference: p.reference ?? '',
    amount: p.amount.toFixed(2),
  }));
}

export async function expenseRows(s: Scope) {
  const rows = await prisma.expense.findMany({
    where: { ownerId: s.ownerId, incurredAt: { gte: new Date(`${s.from}T00:00:00.000Z`), lte: new Date(`${s.to}T00:00:00.000Z`) }, ...(s.propertyId ? { propertyId: s.propertyId } : {}) },
    include: { property: { select: { name: true } } },
    orderBy: { incurredAt: 'asc' },
  });
  return rows.map((e) => ({ date: e.incurredAt.toISOString().slice(0, 10), property: e.property?.name ?? '(none)', category: e.category, amount: e.amount.toFixed(2), notes: e.notes ?? '' }));
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  // Cells starting with = + - @ are prefixed to prevent spreadsheet formula injection.
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\n');
}
