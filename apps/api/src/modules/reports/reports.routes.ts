import { Router } from 'express';
import { z } from 'zod';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, notFound, badRequest } from '../../utils/errors';
import { audit } from '../../utils/audit';
import { fmtDate, firstOfMonth, today } from '../../utils/dates';
import { dateStr, uuid } from '../../utils/schemas';
import { byProperty, collections, expenseRows, monthly, outstanding, summary, toCsv } from './reports.service';

export const reportsRouter = Router();

const kinds = { summary: async (s: any) => [await summary(s)], monthly, 'by-property': byProperty, outstanding, collections, expenses: expenseRows } as const;

reportsRouter.get(
  '/:kind',
  asyncHandler(async (req, res) => {
    const kind = req.params.kind as keyof typeof kinds;
    if (!(kind in kinds)) throw notFound('Report');
    const q = z.object({ from: dateStr.optional(), to: dateStr.optional(), propertyId: uuid.optional(), format: z.enum(['json', 'csv']).default('json') }).parse(req.query);
    const from = q.from ?? fmtDate(firstOfMonth(today()));
    const to = q.to ?? fmtDate(today());
    if (from > to) throw badRequest('"from" must not be after "to"');
    const rows = await kinds[kind]({ ownerId: ownerOf(req), from, to, propertyId: q.propertyId ?? null });
    if (q.format === 'csv') {
      await audit({ ownerId: ownerOf(req), userId: ownerOf(req), action: 'report.export', entity: 'Report', metadata: { kind, from, to } });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${kind}-${from}_${to}.csv"`);
      return res.send(toCsv(rows as Record<string, unknown>[]));
    }
    res.json({ data: kind === 'summary' ? (rows as unknown[])[0] : rows, meta: { from, to } });
  }),
);
