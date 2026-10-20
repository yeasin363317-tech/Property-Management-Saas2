import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, conflict, notFound } from '../../utils/errors';
import { listQuery, moneyNonNeg, optionalText, pageArgs, pageMeta, uuid } from '../../utils/schemas';

export const unitsRouter = Router();

const createSchema = z.object({
  propertyId: uuid,
  number: z.string().trim().min(1).max(40),
  description: optionalText(1000),
  monthlyRent: moneyNonNeg,
});
// Occupancy is derived from leases; users may only toggle VACANT <-> MAINTENANCE.
const updateSchema = z.object({
  number: z.string().trim().min(1).max(40).optional(),
  description: optionalText(1000),
  monthlyRent: moneyNonNeg.optional(),
  status: z.enum(['VACANT', 'MAINTENANCE']).optional(),
});

unitsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery
      .extend({
        propertyId: uuid.optional(),
        status: z.enum(['VACANT', 'OCCUPIED', 'MAINTENANCE']).optional(),
        search: z.string().trim().max(100).optional(),
      })
      .parse(req.query);
    const where: Prisma.UnitWhereInput = {
      ownerId: ownerOf(req),
      property: { archivedAt: null },
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.search ? { number: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.unit.findMany({
        where,
        orderBy: [{ propertyId: 'asc' }, { number: 'asc' }],
        include: { property: { select: { id: true, name: true } }, leases: { where: { status: 'ACTIVE' }, select: { id: true, tenant: { select: { id: true, fullName: true } } }, take: 1 } },
        ...pageArgs(q),
      }),
      prisma.unit.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q, total) });
  }),
);

unitsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const prop = await prisma.property.findFirst({ where: { id: body.propertyId, ownerId: ownerOf(req), archivedAt: null } });
    if (!prop) throw notFound('Property');
    const data = await prisma.unit.create({ data: { ...body, ownerId: ownerOf(req) } });
    res.status(201).json({ data });
  }),
);

unitsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await prisma.unit.findFirst({
      where: { id: uuid.parse(req.params.id), ownerId: ownerOf(req) },
      include: { property: true, leases: { orderBy: { startDate: 'desc' }, include: { tenant: { select: { id: true, fullName: true } } } } },
    });
    if (!data) throw notFound('Unit');
    res.json({ data });
  }),
);

unitsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const owner = ownerOf(req);
    const body = updateSchema.parse(req.body);
    const unit = await prisma.unit.findFirst({ where: { id, ownerId: owner } });
    if (!unit) throw notFound('Unit');
    if (body.status) {
      const active = await prisma.lease.count({ where: { unitId: id, ownerId: owner, status: 'ACTIVE' } });
      if (active > 0) throw conflict('Unit has an active lease; its status is managed by the lease');
    }
    await prisma.unit.updateMany({ where: { id, ownerId: owner }, data: body });
    res.json({ data: await prisma.unit.findFirstOrThrow({ where: { id, ownerId: owner } }) });
  }),
);
