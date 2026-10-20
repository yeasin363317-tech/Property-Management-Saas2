import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { addDays, parseDate, today } from '../../utils/dates';
import { dateStr, listQuery, moneyNonNeg, optionalText, pageArgs, pageMeta, uuid } from '../../utils/schemas';
import { createLease, renewLease, terminateLease } from './lease.service';

export const leasesRouter = Router();

const createSchema = z.object({
  unitId: uuid,
  tenantId: uuid,
  startDate: dateStr,
  endDate: dateStr,
  monthlyRent: moneyNonNeg,
  securityDeposit: moneyNonNeg.default('0'),
  dueDay: z.coerce.number().int().min(1).max(28),
  notes: optionalText(2000),
});

const include = {
  unit: { select: { id: true, number: true, property: { select: { id: true, name: true } } } },
  tenant: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaseInclude;

leasesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery
      .extend({
        status: z.enum(['ACTIVE', 'ENDED', 'TERMINATED', 'RENEWED']).optional(),
        unitId: uuid.optional(),
        tenantId: uuid.optional(),
        expiringInDays: z.coerce.number().int().min(1).max(365).optional(),
      })
      .parse(req.query);
    const t = today();
    const where: Prisma.LeaseWhereInput = {
      ownerId: ownerOf(req),
      ...(q.status ? { status: q.status } : {}),
      ...(q.unitId ? { unitId: q.unitId } : {}),
      ...(q.tenantId ? { tenantId: q.tenantId } : {}),
      ...(q.expiringInDays ? { status: 'ACTIVE', endDate: { gte: t, lte: addDays(t, q.expiringInDays) } } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.lease.findMany({ where, include, orderBy: { startDate: 'desc' }, ...pageArgs(q) }),
      prisma.lease.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q, total) });
  }),
);

leasesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    const start = parseDate(b.startDate);
    const end = parseDate(b.endDate);
    if (end <= start) throw badRequest('End date must be after start date');
    const lease = await createLease(ownerOf(req), ownerOf(req), { ...b, startDate: start, endDate: end });
    res.status(201).json({ data: lease });
  }),
);

leasesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await prisma.lease.findFirst({
      where: { id: uuid.parse(req.params.id), ownerId: ownerOf(req) },
      include: { ...include, obligations: { orderBy: { periodMonth: 'desc' } }, renewedFrom: { select: { id: true, startDate: true, endDate: true } } },
    });
    if (!data) throw notFound('Lease');
    res.json({ data });
  }),
);

leasesRouter.post(
  '/:id/terminate',
  asyncHandler(async (req, res) => {
    const b = z.object({ date: dateStr, reason: optionalText(500) }).parse(req.body);
    const data = await terminateLease(ownerOf(req), ownerOf(req), uuid.parse(req.params.id), parseDate(b.date), b.reason);
    res.json({ data });
  }),
);

leasesRouter.post(
  '/:id/renew',
  asyncHandler(async (req, res) => {
    const b = z.object({ endDate: dateStr, monthlyRent: moneyNonNeg.optional() }).parse(req.body);
    const data = await renewLease(ownerOf(req), ownerOf(req), uuid.parse(req.params.id), parseDate(b.endDate), b.monthlyRent);
    res.status(201).json({ data });
  }),
);
