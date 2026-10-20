import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, notFound } from '../../utils/errors';
import { audit } from '../../utils/audit';
import { parseDate, today } from '../../utils/dates';
import { dateStr, listQuery, pageArgs, pageMeta, uuid } from '../../utils/schemas';
import { generateObligations, withBalance } from './rent.service';

export const rentRouter = Router();

const include = {
  lease: {
    select: {
      id: true,
      tenant: { select: { id: true, fullName: true } },
      unit: { select: { id: true, number: true, property: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.RentObligationInclude;

rentRouter.get(
  '/obligations',
  asyncHandler(async (req, res) => {
    const q = listQuery
      .extend({
        status: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE']).optional(),
        leaseId: uuid.optional(),
        tenantId: uuid.optional(),
        propertyId: uuid.optional(),
        from: dateStr.optional(),
        to: dateStr.optional(),
      })
      .parse(req.query);
    const t = today();
    const where: Prisma.RentObligationWhereInput = {
      ownerId: ownerOf(req),
      ...(q.leaseId ? { leaseId: q.leaseId } : {}),
      ...(q.tenantId || q.propertyId
        ? { lease: { ...(q.tenantId ? { tenantId: q.tenantId } : {}), ...(q.propertyId ? { unit: { propertyId: q.propertyId } } : {}) } }
        : {}),
      ...(q.from || q.to ? { dueDate: { ...(q.from ? { gte: parseDate(q.from) } : {}), ...(q.to ? { lte: parseDate(q.to) } : {}) } } : {}),
    };
    if (q.status === 'PAID') where.status = 'PAID';
    else if (q.status === 'OVERDUE') Object.assign(where, { status: { not: 'PAID' }, dueDate: { ...(where.dueDate as object), lt: t } });
    else if (q.status) Object.assign(where, { status: q.status, dueDate: { ...(where.dueDate as object), gte: t } });
    const [rows, total] = await prisma.$transaction([
      prisma.rentObligation.findMany({ where, include, orderBy: { dueDate: 'desc' }, ...pageArgs(q) }),
      prisma.rentObligation.count({ where }),
    ]);
    res.json({ data: rows.map(withBalance), meta: pageMeta(q, total) });
  }),
);

rentRouter.get(
  '/obligations/:id',
  asyncHandler(async (req, res) => {
    const row = await prisma.rentObligation.findFirst({
      where: { id: uuid.parse(req.params.id), ownerId: ownerOf(req) },
      include: { ...include, payments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw notFound('Rent obligation');
    res.json({ data: withBalance(row) });
  }),
);

// Generates obligations for one month for the caller's own active leases. Idempotent.
rentRouter.post(
  '/obligations/generate',
  asyncHandler(async (req, res) => {
    const { month } = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.body);
    const result = await generateObligations(parseDate(`${month}-01`), ownerOf(req));
    await audit({ ownerId: ownerOf(req), userId: ownerOf(req), action: 'rent.generate', entity: 'RentObligation', metadata: { month, ...result } });
    res.json({ data: result });
  }),
);
