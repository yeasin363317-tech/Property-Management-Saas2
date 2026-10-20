import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, notFound } from '../../utils/errors';
import { parseDate } from '../../utils/dates';
import { dateStr, listQuery, moneyPositive, optionalText, pageArgs, pageMeta, uuid } from '../../utils/schemas';
import { recordPayment, reversePayment } from '../rent/rent.service';

export const paymentsRouter = Router();

const createSchema = z.object({
  obligationId: uuid,
  amount: moneyPositive,
  paidAt: dateStr,
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'MOBILE_MONEY', 'CHEQUE', 'OTHER']),
  reference: optionalText(120),
  note: optionalText(500),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
});

const include = {
  obligation: {
    select: {
      id: true,
      periodMonth: true,
      lease: { select: { tenant: { select: { id: true, fullName: true } }, unit: { select: { number: true, property: { select: { name: true } } } } } },
    },
  },
} satisfies Prisma.RentPaymentInclude;

paymentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.extend({ from: dateStr.optional(), to: dateStr.optional(), obligationId: uuid.optional() }).parse(req.query);
    const where: Prisma.RentPaymentWhereInput = {
      ownerId: ownerOf(req),
      ...(q.obligationId ? { obligationId: q.obligationId } : {}),
      ...(q.from || q.to ? { paidAt: { ...(q.from ? { gte: parseDate(q.from) } : {}), ...(q.to ? { lte: parseDate(q.to) } : {}) } } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.rentPayment.findMany({ where, include, orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }], ...pageArgs(q) }),
      prisma.rentPayment.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q, total) });
  }),
);

paymentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    const headerKey = req.get('idempotency-key');
    const { payment, duplicate } = await recordPayment(ownerOf(req), ownerOf(req), { ...b, paidAt: parseDate(b.paidAt), idempotencyKey: b.idempotencyKey ?? headerKey ?? null });
    res.status(duplicate ? 200 : 201).json({ data: payment, meta: { duplicate } });
  }),
);

paymentsRouter.post(
  '/:id/reverse',
  asyncHandler(async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const data = await reversePayment(ownerOf(req), ownerOf(req), uuid.parse(req.params.id), reason);
    res.status(201).json({ data });
  }),
);

paymentsRouter.get(
  '/:id/receipt',
  asyncHandler(async (req, res) => {
    const p = await prisma.rentPayment.findFirst({
      where: { id: uuid.parse(req.params.id), ownerId: ownerOf(req) },
      include: { obligation: { include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } } } },
    });
    if (!p) throw notFound('Payment');
    const o = p.obligation;
    res.json({
      data: {
        receiptNumber: p.id.slice(0, 8).toUpperCase(),
        kind: p.kind,
        issuedBy: req.user!.name,
        tenant: o.lease.tenant.fullName,
        property: o.lease.unit.property.name,
        address: o.lease.unit.property.address,
        unit: o.lease.unit.number,
        period: o.periodMonth,
        amount: p.amount.toFixed(2),
        paidAt: p.paidAt,
        method: p.method,
        reference: p.reference,
        rentDue: o.amountDue.toFixed(2),
        totalPaid: o.paidAmount.toFixed(2),
        balance: o.amountDue.minus(o.paidAmount).toFixed(2),
      },
    });
  }),
);
