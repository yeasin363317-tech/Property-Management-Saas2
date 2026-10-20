import { Router } from 'express';
import { prisma } from './db';
import { requireAuth, ownerOf } from './middleware/auth';
import { asyncHandler } from './utils/errors';
import { listQuery, pageArgs, pageMeta } from './utils/schemas';
import { authRouter } from './modules/auth/auth.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { propertiesRouter } from './modules/properties/properties.routes';
import { unitsRouter } from './modules/units/units.routes';
import { tenantsRouter } from './modules/tenants/tenants.routes';
import { leasesRouter } from './modules/leases/leases.routes';
import { rentRouter } from './modules/rent/rent.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { expensesRouter } from './modules/expenses/expenses.routes';
import { maintenanceRouter } from './modules/maintenance/maintenance.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';

export const api = Router();

api.get('/health', (_req, res) => res.json({ status: 'ok' }));
api.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'database unavailable' });
    }
  }),
);

api.use('/auth', authRouter);

// Everything below requires a valid session.
api.use(requireAuth);
api.use('/admin', adminRouter);
api.use('/dashboard', dashboardRouter);
api.use('/properties', propertiesRouter);
api.use('/units', unitsRouter);
api.use('/tenants', tenantsRouter);
api.use('/leases', leasesRouter);
api.use('/rent', rentRouter);
api.use('/payments', paymentsRouter);
api.use('/expenses', expensesRouter);
api.use('/maintenance', maintenanceRouter);
api.use('/reports', reportsRouter);
api.use('/notifications', notificationsRouter);
api.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where = { ownerId: ownerOf(req) };
    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ data, meta: pageMeta(q, total) });
  }),
);
