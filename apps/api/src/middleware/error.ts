import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { isProd, isTest } from '../config/env';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.flatten() } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with these values already exists' } });
    if (err.code === 'P2003') return res.status(409).json({ error: { code: 'CONFLICT', message: 'Record is referenced by other data' } });
    if (err.code === 'P2025') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  }
  if (err instanceof Error && err.message.includes('lease_no_overlap')) {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Unit already has an active lease overlapping these dates' } });
  }
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
  }
  if (!isTest) console.error(isProd ? (err as Error)?.message : err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
