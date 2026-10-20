import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler } from '../../utils/errors';
import { addDays, firstOfMonth, fmtDate, today } from '../../utils/dates';
import { dateStr } from '../../utils/schemas';
import { summary } from '../reports/reports.service';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const owner = ownerOf(req);
    const t = today();
    const q = z.object({ from: dateStr.optional(), to: dateStr.optional() }).parse(req.query);
    const from = q.from ?? fmtDate(firstOfMonth(t));
    const to = q.to ?? fmtDate(t);
    const month = firstOfMonth(t);
    const [properties, units, occupied, vacant, maintenanceUnits, monthDue, sum, recentPayments, expiring, recentMaintenance] = await Promise.all([
      prisma.property.count({ where: { ownerId: owner, archivedAt: null } }),
      prisma.unit.count({ where: { ownerId: owner, property: { archivedAt: null } } }),
      prisma.unit.count({ where: { ownerId: owner, status: 'OCCUPIED', property: { archivedAt: null } } }),
      prisma.unit.count({ where: { ownerId: owner, status: 'VACANT', property: { archivedAt: null } } }),
      prisma.unit.count({ where: { ownerId: owner, status: 'MAINTENANCE', property: { archivedAt: null } } }),
      prisma.rentObligation.aggregate({ where: { ownerId: owner, periodMonth: month }, _sum: { amountDue: true } }),
      summary({ ownerId: owner, from, to }),
      prisma.rentPayment.findMany({
        where: { ownerId: owner },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { obligation: { select: { lease: { select: { tenant: { select: { fullName: true } }, unit: { select: { number: true } } } } } } },
      }),
      prisma.lease.findMany({
        where: { ownerId: owner, status: 'ACTIVE', endDate: { gte: t, lte: addDays(t, 60) } },
        orderBy: { endDate: 'asc' },
        take: 5,
        include: { tenant: { select: { fullName: true } }, unit: { select: { number: true } } },
      }),
      prisma.maintenanceRequest.findMany({ where: { ownerId: owner }, orderBy: { createdAt: 'desc' }, take: 5, include: { property: { select: { name: true } } } }),
    ]);
    res.json({
      data: {
        period: { from, to },
        counts: { properties, units, occupied, vacant, maintenance: maintenanceUnits },
        currentMonthRentDue: (monthDue._sum.amountDue ?? 0).toString(),
        rentCollected: sum.rentCollected,
        outstandingBalance: sum.outstandingBalance,
        recentPayments,
        upcomingLeaseExpirations: expiring,
        recentMaintenance,
      },
    });
  }),
);
