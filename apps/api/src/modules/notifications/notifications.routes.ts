import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, notFound } from '../../utils/errors';
import { listQuery, pageArgs, pageMeta, uuid } from '../../utils/schemas';
import { refreshNotifications } from './notifications.service';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.extend({ unread: z.enum(['true', 'false']).optional() }).parse(req.query);
    const where = { ownerId: ownerOf(req), ...(q.unread === 'true' ? { readAt: null } : {}) };
    const [data, total, unread] = await prisma.$transaction([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ownerId: ownerOf(req), readAt: null } }),
    ]);
    res.json({ data, meta: { ...pageMeta(q, total), unread } });
  }),
);

notificationsRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    res.json({ data: { created: await refreshNotifications(ownerOf(req)) } });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { ownerId: ownerOf(req), readAt: null }, data: { readAt: new Date() } });
    res.status(204).end();
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const r = await prisma.notification.updateMany({ where: { id: uuid.parse(req.params.id), ownerId: ownerOf(req) }, data: { readAt: new Date() } });
    if (r.count === 0) throw notFound('Notification');
    res.status(204).end();
  }),
);
