import { prisma } from '../../db';
import { addDays, fmtDate, today } from '../../utils/dates';

/** Creates in-app notifications. Deduplicated by (ownerId, dedupeKey), so repeat runs add nothing. */
export async function refreshNotifications(ownerId?: string) {
  const t = today();
  const scope = ownerId ? { ownerId } : {};
  const open = { ...scope, status: { not: 'PAID' as const } };
  const include = { lease: { select: { tenant: { select: { fullName: true } }, unit: { select: { number: true } } } } };

  const [due, overdue, expiring] = await Promise.all([
    prisma.rentObligation.findMany({ where: { ...open, dueDate: { gte: t, lte: addDays(t, 7) } }, include }),
    prisma.rentObligation.findMany({ where: { ...open, dueDate: { lt: t } }, include }),
    prisma.lease.findMany({ where: { ...scope, status: 'ACTIVE', endDate: { gte: t, lte: addDays(t, 60) } }, include: { tenant: true, unit: true } }),
  ]);

  const data = [
    ...due.map((o) => ({
      ownerId: o.ownerId,
      type: 'RENT_DUE' as const,
      title: 'Rent due soon',
      message: `${o.lease.tenant.fullName} (unit ${o.lease.unit.number}) owes ${o.amountDue.minus(o.paidAmount).toFixed(2)} by ${fmtDate(o.dueDate)}.`,
      dedupeKey: `due:${o.id}`,
    })),
    ...overdue.map((o) => ({
      ownerId: o.ownerId,
      type: 'RENT_OVERDUE' as const,
      title: 'Rent overdue',
      message: `${o.lease.tenant.fullName} (unit ${o.lease.unit.number}) is overdue by ${o.amountDue.minus(o.paidAmount).toFixed(2)} (due ${fmtDate(o.dueDate)}).`,
      dedupeKey: `overdue:${o.id}`,
    })),
    ...expiring.map((l) => ({
      ownerId: l.ownerId,
      type: 'LEASE_EXPIRING' as const,
      title: 'Lease expiring',
      message: `Lease for ${l.tenant.fullName} (unit ${l.unit.number}) ends on ${fmtDate(l.endDate)}.`,
      dedupeKey: `lease-exp:${l.id}`,
    })),
  ];
  const r = await prisma.notification.createMany({ data, skipDuplicates: true });
  return r.count;
}
