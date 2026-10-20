import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { allowedOrigins } from '../config/env';
import { prisma } from '../db';
import { AppError, asyncHandler, forbidden, unauthorized } from '../utils/errors';

export const SESSION_COOKIE = 'pms_sid';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string') throw unauthorized();
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.disabledAt) throw unauthorized();
  const { id, email, name, role } = session.user;
  req.user = { id, email, name, role };
  next();
});

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && roles.includes(req.user.role) ? next() : next(forbidden('Insufficient permissions'));

/**
 * CSRF defence for cookie sessions: SameSite=Lax cookie + required custom header
 * (cannot be sent cross-site without a CORS preflight, which only allowed origins pass)
 * + Origin allow-list check when the browser sends an Origin header.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !allowedOrigins.includes(origin)) return next(new AppError(403, 'CSRF_ORIGIN', 'Origin not allowed'));
  if (req.get('x-requested-with') !== 'XMLHttpRequest') return next(new AppError(403, 'CSRF_HEADER', 'Missing CSRF header'));
  next();
}

/** The authenticated user's id; every data query MUST be scoped with this. */
export const ownerOf = (req: Request) => req.user!.id;
