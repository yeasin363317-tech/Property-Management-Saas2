import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireRole } from '../../middleware/auth';
import { asyncHandler, badRequest, notFound } from '../../utils/errors';
import { audit } from '../../utils/audit';
import { listQuery, pageArgs, pageMeta, uuid } from '../../utils/schemas';

export const adminRouter = Router();
adminRouter.use(requireRole('ADMIN'));

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, disabledAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q),
      }),
      prisma.user.count(),
    ]);
    res.json({ data, meta: pageMeta(q, total) });
  }),
);

adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { disabled } = z.object({ disabled: z.boolean() }).parse(req.body);
    if (id === req.user!.id) throw badRequest('You cannot disable your own account');
    const r = await prisma.user.updateMany({ where: { id }, data: { disabledAt: disabled ? new Date() : null } });
    if (r.count === 0) throw notFound('User');
    if (disabled) await prisma.session.deleteMany({ where: { userId: id } });
    await audit({ ownerId: id, userId: req.user!.id, action: disabled ? 'admin.user_disable' : 'admin.user_enable', entity: 'User', entityId: id });
    res.status(204).end();
  }),
);
