import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db';
import { ownerOf } from '../../middleware/auth';
import { asyncHandler, notFound } from '../../utils/errors';
import { audit } from '../../utils/audit';
import { parseDate } from '../../utils/dates';
import { dateStr, listQuery, moneyPositive, optionalText, pageArgs, pageMeta, uuid } from '../../utils/schemas';

export const expensesRouter = Router();

const category = z.enum(['REPAIRS', 'UTILITIES', 'TAXES', 'INSURANCE', 'MANAGEMENT', 'CLEANING', 'OTHER']);
const createSchema = z.object({
  propertyId: uuid.optional().nullable(),
  category,
  amount: moneyPositive,
  incurredAt: dateStr,
  notes: optionalText(1000),
});

async function assertProperty(ownerId: string, propertyId?: string | null) {
  if (propertyId && !(await prisma.property.findFirst({ where: { id: propertyId, ownerId } }))) throw notFound('Property');
}

expensesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.extend({ propertyId: uuid.optional(), category: category.optional(), from: dateStr.optional(), to: dateStr.optional() }).parse(req.query);
    const where: Prisma.ExpenseWhereInput = {
      ownerId: ownerOf(req),
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.from || q.to ? { incurredAt: { ...(q.from ? { gte: parseDate(q.from) } : {}), ...(q.to ? { lte: parseDate(q.to) } : {}) } } : {}),
    };
    const [data, total, sum] = await prisma.$transaction([
      prisma.expense.findMany({ where, include: { property: { select: { id: true, name: true } } }, orderBy: { incurredAt: 'desc' }, ...pageArgs(q) }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);
    res.json({ data, meta: { ...pageMeta(q, total), totalAmount: (sum._sum.amount ?? 0).toString() } });
  }),
);

expensesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    await assertProperty(ownerOf(req), b.propertyId);
    const data = await prisma.expense.create({ data: { ...b, incurredAt: parseDate(b.incurredAt), ownerId: ownerOf(req) } });
    await audit({ ownerId: ownerOf(req), userId: ownerOf(req), action: 'expense.create', entity: 'Expense', entityId: data.id, metadata: { amount: b.amount } });
    res.status(201).json({ data });
  }),
);

expensesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const b = createSchema.partial().parse(req.body);
    await assertProperty(ownerOf(req), b.propertyId);
    const r = await prisma.expense.updateMany({ where: { id, ownerId: ownerOf(req) }, data: { ...b, incurredAt: b.incurredAt ? parseDate(b.incurredAt) : undefined } });
    if (r.count === 0) throw notFound('Expense');
    await audit({ ownerId: ownerOf(req), userId: ownerOf(req), action: 'expense.update', entity: 'Expense', entityId: id });
    res.json({ data: await prisma.expense.findFirstOrThrow({ where: { id, ownerId: ownerOf(req) } }) });
  }),
);

expensesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const r = await prisma.expense.deleteMany({ where: { id, ownerId: ownerOf(req) } });
    if (r.count === 0) throw notFound('Expense');
    await audit({ ownerId: ownerOf(req), userId: ownerOf(req), action: 'expense.delete', entity: 'Expense', entityId: id });
    res.status(204).end();
  }),
);
