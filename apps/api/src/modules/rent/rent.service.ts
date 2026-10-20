import { Prisma, type ObligationStatus, type PaymentMethod } from '@prisma/client';
import { prisma, type Tx } from '../../db';
import { audit } from '../../utils/audit';
import { endOfMonth, firstOfMonth, today } from '../../utils/dates';
import { AppError, conflict, notFound } from '../../utils/errors';

const D = Prisma.Decimal;

/**
 * Balance rules (documented in docs/architecture.md):
 *  - balance = amountDue - sum(payments incl. negative reversals)
 *  - PAID when balance <= 0; otherwise OVERDUE if dueDate < today, else PARTIAL (paid > 0) or UNPAID
 *  - overpayment is rejected (no credits); late payments are never auto-penalised.
 */
export type DisplayStatus = ObligationStatus | 'OVERDUE';
export function displayStatus(status: ObligationStatus, dueDate: Date): DisplayStatus {
  if (status === 'PAID') return 'PAID';
  return dueDate < today() ? 'OVERDUE' : status;
}

export function withBalance<T extends { amountDue: Prisma.Decimal; paidAmount: Prisma.Decimal; status: ObligationStatus; dueDate: Date }>(o: T) {
  return { ...o, balance: o.amountDue.minus(o.paidAmount).toFixed(2), displayStatus: displayStatus(o.status, o.dueDate) };
}

/** Idempotent: unique(leaseId, periodMonth) + skipDuplicates make repeat runs create nothing new. */
export async function generateObligations(month: Date, ownerId?: string) {
  const first = firstOfMonth(month);
  const last = endOfMonth(month);
  const leases = await prisma.lease.findMany({
    where: { status: 'ACTIVE', startDate: { lte: last }, endDate: { gte: first }, ...(ownerId ? { ownerId } : {}) },
  });
  const rows = leases.map((l) => ({
    ownerId: l.ownerId,
    leaseId: l.id,
    periodMonth: first,
    dueDate: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), l.dueDay)),
    amountDue: l.monthlyRent,
  }));
  const r = await prisma.rentObligation.createMany({ data: rows, skipDuplicates: true });
  return { created: r.count, eligibleLeases: leases.length };
}

async function lockObligation(tx: Tx, ownerId: string, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "RentObligation" WHERE "id" = ${id}::uuid AND "ownerId" = ${ownerId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw notFound('Rent obligation');
}

async function recompute(tx: Tx, obligationId: string) {
  const ob = await tx.rentObligation.findUniqueOrThrow({ where: { id: obligationId } });
  const agg = await tx.rentPayment.aggregate({ where: { obligationId }, _sum: { amount: true } });
  const paid = agg._sum.amount ?? new D(0);
  const status: ObligationStatus = paid.gte(ob.amountDue) ? 'PAID' : paid.gt(0) ? 'PARTIAL' : 'UNPAID';
  return tx.rentObligation.update({ where: { id: obligationId }, data: { paidAmount: paid, status } });
}

export interface PaymentInput {
  obligationId: string;
  amount: string;
  paidAt: Date;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  idempotencyKey?: string | null;
}

export async function recordPayment(ownerId: string, userId: string, input: PaymentInput) {
  return prisma.$transaction(async (tx) => {
    await lockObligation(tx, ownerId, input.obligationId);
    if (input.idempotencyKey) {
      const existing = await tx.rentPayment.findUnique({ where: { ownerId_idempotencyKey: { ownerId, idempotencyKey: input.idempotencyKey } } });
      if (existing) {
        if (existing.obligationId !== input.obligationId || !existing.amount.equals(input.amount)) {
          throw conflict('Idempotency key was already used for a different payment');
        }
        return { payment: existing, duplicate: true };
      }
    }
    const ob = await tx.rentObligation.findUniqueOrThrow({ where: { id: input.obligationId } });
    const amount = new D(input.amount);
    const balance = ob.amountDue.minus(ob.paidAmount);
    if (balance.lte(0)) throw conflict('This rent obligation is already fully paid');
    if (amount.gt(balance)) throw new AppError(409, 'OVERPAYMENT', `Amount exceeds outstanding balance of ${balance.toFixed(2)}`);
    const payment = await tx.rentPayment.create({
      data: {
        ownerId,
        obligationId: input.obligationId,
        kind: 'PAYMENT',
        amount,
        paidAt: input.paidAt,
        method: input.method,
        reference: input.reference ?? null,
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdById: userId,
      },
    });
    await recompute(tx, input.obligationId);
    await audit({ ownerId, userId, action: 'payment.record', entity: 'RentPayment', entityId: payment.id, metadata: { amount: amount.toFixed(2), obligationId: input.obligationId } }, tx);
    return { payment, duplicate: false };
  });
}

/** Corrections never delete history: a negative REVERSAL row is appended. */
export async function reversePayment(ownerId: string, userId: string, paymentId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const orig = await tx.rentPayment.findFirst({ where: { id: paymentId, ownerId } });
    if (!orig) throw notFound('Payment');
    await lockObligation(tx, ownerId, orig.obligationId);
    if (orig.kind !== 'PAYMENT') throw conflict('Only payments can be reversed');
    if (await tx.rentPayment.findUnique({ where: { reversesId: orig.id } })) throw conflict('Payment is already reversed');
    const reversal = await tx.rentPayment.create({
      data: {
        ownerId,
        obligationId: orig.obligationId,
        kind: 'REVERSAL',
        amount: orig.amount.negated(),
        paidAt: today(),
        method: orig.method,
        reference: orig.reference,
        note: reason,
        reversesId: orig.id,
        createdById: userId,
      },
    });
    await recompute(tx, orig.obligationId);
    await audit({ ownerId, userId, action: 'payment.reverse', entity: 'RentPayment', entityId: reversal.id, metadata: { reverses: orig.id, reason } }, tx);
    return reversal;
  });
}
