import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, conflict, notFound } from '../../utils/errors';
import { listQuery, optionalText, pageArgs, pageMeta, uuid } from '../../utils/schemas';

export const tenantsRouter = Router();

const createSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).optional().nullable().or(z.literal('').transform(() => null)),
  phone: optionalText(40),
  emergencyContact: optionalText(300),
});
const updateSchema = createSchema.partial().extend({ active: z.boolean().optional() });

tenantsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.extend({ search: z.string().trim().max(100).optional(), active: z.enum(['true', 'false']).optional() }).parse(req.query);
    const where: Prisma.TenantWhereInput = {
      ownerId: ownerOf(req),
      ...(q.active ? { active: q.active === 'true' } : {}),
      ...(q.search
        ? { OR: [{ fullName: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }, { phone: { contains: q.search } }] }
        : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.tenant.findMany({ where, orderBy: { fullName: 'asc' }, ...pageArgs(q) }),
      prisma.tenant.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q, total) });
  }),
);

tenantsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = await prisma.tenant.create({ data: { ...createSchema.parse(req.body), ownerId: ownerOf(req) } });
    res.status(201).json({ data });
  }),
);

tenantsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await prisma.tenant.findFirst({
      where: { id: uuid.parse(req.params.id), ownerId: ownerOf(req) },
      include: { leases: { orderBy: { startDate: 'desc' }, include: { unit: { select: { id: true, number: true, property: { select: { name: true } } } } } } },
    });
    if (!data) throw notFound('Tenant');
    res.json({ data });
  }),
);

tenantsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const owner = ownerOf(req);
    const body = updateSchema.parse(req.body);
    if (!(await prisma.tenant.findFirst({ where: { id, ownerId: owner } }))) throw notFound('Tenant');
    if (body.active === false && (await prisma.lease.count({ where: { tenantId: id, ownerId: owner, status: 'ACTIVE' } })) > 0) {
      throw conflict('Tenant has an active lease; terminate it first');
    }
    await prisma.tenant.updateMany({ where: { id, ownerId: owner }, data: body });
    res.json({ data: await prisma.tenant.findFirstOrThrow({ where: { id, ownerId: owner } }) });
  }),
);
