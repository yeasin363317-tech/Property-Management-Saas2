import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../../db';
import { addDays, today } from '../../utils/dates';
import { audit } from '../../utils/audit';
import { AppError, conflict, notFound } from '../../utils/errors';

export interface LeaseInput {
  unitId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: string;
  securityDeposit: string;
  dueDay: number;
  notes?: string | null;
}

/** Occupancy is derived: OCCUPIED while any ACTIVE lease exists, else VACANT (MAINTENANCE is left alone). */
export async function syncUnitStatus(tx: Tx, unitId: string) {
  const unit = await tx.unit.findUniqueOrThrow({ where: { id: unitId } });
  if (unit.status === 'MAINTENANCE') return;
  const active = await tx.lease.count({ where: { unitId, status: 'ACTIVE' } });
  const status = active > 0 ? 'OCCUPIED' : 'VACANT';
  if (status !== unit.status) await tx.unit.update({ where: { id: unitId }, data: { status } });
}

async function assertNoOverlap(tx: Tx, unitId: string, start: Date, end: Date, ignoreId?: string) {
  const clash = await tx.lease.findFirst({
    where: { unitId, status: 'ACTIVE', startDate: { lte: end }, endDate: { gte: start }, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
  });
  if (clash) throw conflict('Unit already has an active lease overlapping these dates');
}

export async function createLease(ownerId: string, userId: string, input: LeaseInput, renewedFromId?: string, tx?: Tx) {
  const run = async (t: Tx) => {
    const unit = await t.unit.findFirst({ where: { id: input.unitId, ownerId, property: { archivedAt: null } } });
    if (!unit) throw notFound('Unit');
    if (unit.status === 'MAINTENANCE') throw conflict('Unit is under maintenance and cannot be leased');
    const tenant = await t.tenant.findFirst({ where: { id: input.tenantId, ownerId, active: true } });
    if (!tenant) throw notFound('Active tenant');
    await assertNoOverlap(t, input.unitId, input.startDate, input.endDate);
    const lease = await t.lease.create({ data: { ...input, ownerId, renewedFromId: renewedFromId ?? null } });
    await syncUnitStatus(t, input.unitId);
    await audit({ ownerId, userId, action: renewedFromId ? 'lease.renew' : 'lease.create', entity: 'Lease', entityId: lease.id }, t);
    return lease;
  };
  return tx ? run(tx) : prisma.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function terminateLease(ownerId: string, userId: string, id: string, date: Date, reason?: string | null) {
  return prisma.$transaction(async (tx) => {
    const lease = await tx.lease.findFirst({ where: { id, ownerId } });
    if (!lease) throw notFound('Lease');
    if (lease.status !== 'ACTIVE') throw conflict('Only active leases can be terminated');
    if (date < lease.startDate) throw new AppError(400, 'BAD_REQUEST', 'Termination date is before the lease start');
    const updated = await tx.lease.update({
      where: { id },
      data: { status: 'TERMINATED', terminatedAt: date, endDate: date < lease.endDate ? date : lease.endDate, notes: reason ? `${lease.notes ?? ''}\nTerminated: ${reason}`.trim() : lease.notes },
    });
    await syncUnitStatus(tx, lease.unitId);
    await audit({ ownerId, userId, action: 'lease.terminate', entity: 'Lease', entityId: id, metadata: { date: date.toISOString().slice(0, 10) } }, tx);
    return updated;
  });
}

export async function renewLease(ownerId: string, userId: string, id: string, endDate: Date, monthlyRent?: string) {
  return prisma.$transaction(
    async (tx) => {
      const old = await tx.lease.findFirst({ where: { id, ownerId } });
      if (!old) throw notFound('Lease');
      if (old.status !== 'ACTIVE') throw conflict('Only active leases can be renewed');
      const startDate = addDays(old.endDate, 1);
      if (endDate <= startDate) throw new AppError(400, 'BAD_REQUEST', 'New end date must be after the day following the current end date');
      await tx.lease.update({ where: { id }, data: { status: 'RENEWED' } });
      return createLease(
        ownerId,
        userId,
        {
          unitId: old.unitId,
          tenantId: old.tenantId,
          startDate,
          endDate,
          monthlyRent: monthlyRent ?? old.monthlyRent.toFixed(2),
          securityDeposit: old.securityDeposit.toFixed(2),
          dueDay: old.dueDay,
        },
        old.id,
        tx,
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Closes ACTIVE leases whose end date has passed. Safe to run repeatedly. */
export async function closeExpiredLeases() {
  const expired = await prisma.lease.findMany({ where: { status: 'ACTIVE', endDate: { lt: today() } }, select: { id: true, unitId: true } });
  if (expired.length === 0) return 0;
  await prisma.$transaction(async (tx) => {
    await tx.lease.updateMany({ where: { id: { in: expired.map((l) => l.id) } }, data: { status: 'ENDED' } });
    for (const unitId of new Set(expired.map((l) => l.unitId))) await syncUnitStatus(tx, unitId);
  });
  return expired.length;
}
