import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { audit } from '../../utils/audit';
import { listQuery, moneyNonNeg, pageArgs, pageMeta, uuid } from '../../utils/schemas';

export const maintenanceRouter = Router();

const priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const status = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']);
const cost = moneyNonNeg.optional().nullable();

const createSchema = z.object({
  propertyId: uuid,
  unitId: uuid.optional().nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  priority: priority.default('MEDIUM'),
  estimatedCost: cost,
});
const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  priority: priority.optional(),
  status: status.optional(),
  estimatedCost: cost,
  actualCost: cost,
});

const include = { property: { select: { id: true, name: true } }, unit: { select: { id: true, number: true } } } satisfies Prisma.MaintenanceRequestInclude;

maintenanceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.extend({ status: status.optional(), priority: priority.optional(), propertyId: uuid.optional() }).parse(req.query);
    const where: Prisma.MaintenanceRequestWhereInput = {
      ownerId: ownerOf(req),
      ...(q.status ? { status: q.status } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.maintenanceRequest.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      prisma.maintenanceRequest.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q, total) });
  }),
);

maintenanceRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    const owner = ownerOf(req);
    if (!(await prisma.property.findFirst({ where: { id: b.propertyId, ownerId: owner } }))) throw notFound('Property');
    if (b.unitId && !(await prisma.unit.findFirst({ where: { id: b.unitId, ownerId: owner, propertyId: b.propertyId } }))) throw badRequest('Unit does not belong to that property');
    const data = await prisma.maintenanceRequest.create({ data: { ...b, ownerId: owner } });
    res.status(201).json({ data });
  }),
);

maintenanceRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const owner = ownerOf(req);
    const b = updateSchema.parse(req.body);
    const current = await prisma.maintenanceRequest.findFirst({ where: { id, ownerId: owner } });
    if (!current) throw notFound('Maintenance request');
    const statusChanged = b.status && b.status !== current.status;
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceRequest.updateMany({
        where: { id, ownerId: owner },
        data: { ...b, resolvedAt: statusChanged ? (b.status === 'RESOLVED' ? new Date() : null) : undefined },
      });
      if (statusChanged) {
        await tx.notification.createMany({
          data: [{ ownerId: owner, type: 'MAINTENANCE_UPDATE', title: 'Maintenance status changed', message: `"${current.title}" is now ${b.status!.replace('_', ' ').toLowerCase()}.`, dedupeKey: `maint:${id}:${b.status}:${Date.now()}` }],
        });
        await audit({ ownerId: owner, userId: owner, action: 'maintenance.status', entity: 'MaintenanceRequest', entityId: id, metadata: { from: current.status, to: b.status! } }, tx);
      }
    });
    res.json({ data: await prisma.maintenanceRequest.findFirstOrThrow({ where: { id, ownerId: owner }, include }) });
  }),
);
