import { z } from 'zod';
import { parseDate } from './dates';

export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(parseDate(s).getTime()) && parseDate(s).toISOString().startsWith(s), 'Invalid date');

const moneyString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Amount must be a non-negative number with at most 2 decimals'));

export const moneyNonNeg = moneyString;
export const moneyPositive = moneyString.refine((v) => Number(v) > 0, 'Amount must be greater than zero');

export const uuid = z.string().uuid();

export const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v === '' ? null : v));

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const pageArgs = (q: { page: number; pageSize: number }) => ({ skip: (q.page - 1) * q.pageSize, take: q.pageSize });
export const pageMeta = (q: { page: number; pageSize: number }, total: number) => ({ page: q.page, pageSize: q.pageSize, total });
