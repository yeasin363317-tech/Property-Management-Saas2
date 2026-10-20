import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, conflict, notFound } from '../../utils/errors';
import { audit } from '../../utils/audit';
import { listQuery, optionalText, pageArgs, pageMeta, uuid } from '../../utils/schemas';

export const propertiesRouter = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(300),
  description: optionalText(2000),
});
const updateSchema = createSchema.partial();

propertiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.extend({ search: z.string().trim().max(100).optional(), archived: z.enum(['true', 'false']).default('false') }).parse(req.query);
    const where: Prisma.PropertyWhereInput = {
      ownerId: ownerOf(req),
      archivedAt: q.archived === 'true' ? { not: null } : null,
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { address: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.property.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { units: true } } }, ...pageArgs(q) }),
      prisma.property.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q, total) });
  }),
);

propertiesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const data = await prisma.property.create({ data: { ...body, ownerId: ownerOf(req) } });
    await audit({ ownerId: ownerOf(req), userId: ownerOf(req), action: 'property.create', entity: 'Property', entityId: data.id });
    res.status(201).json({ data });
  }),
);

propertiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await prisma.property.findFirst({
      where: { id: uuid.parse(req.params.id), ownerId: ownerOf(req) },
      include: { units: { orderBy: { number: 'asc' } } },
    });
    if (!data) throw notFound('Property');
    res.json({ data });
  }),
);

propertiesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const body = updateSchema.parse(req.body);
    const r = await prisma.property.updateMany({ where: { id, ownerId: ownerOf(req) }, data: body });
    if (r.count === 0) throw notFound('Property');
    res.json({ data: await prisma.property.findFirstOrThrow({ where: { id, ownerId: ownerOf(req) } }) });
  }),
);

propertiesRouter.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const owner = ownerOf(req);
    const prop = await prisma.property.findFirst({ where: { id, ownerId: owner } });
    if (!prop) throw notFound('Property');
    const active = await prisma.lease.count({ where: { ownerId: owner, status: 'ACTIVE', unit: { propertyId: id } } });
    if (active > 0) throw conflict('Property has active leases; end them before archiving');
    await prisma.property.updateMany({ where: { id, ownerId: owner }, data: { archivedAt: new Date() } });
    await audit({ ownerId: owner, userId: owner, action: 'property.archive', entity: 'Property', entityId: id });
    res.status(204).end();
  }),
);

propertiesRouter.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const r = await prisma.property.updateMany({ where: { id, ownerId: ownerOf(req) }, data: { archivedAt: null } });
    if (r.count === 0) throw notFound('Property');
    res.status(204).end();
  }),
);
