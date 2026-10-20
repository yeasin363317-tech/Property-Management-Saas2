import { randomBytes } from 'crypto';
import { Router, type Response } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env, isTest } from '../../config/env';
import { prisma } from '../../db';
import { SESSION_COOKIE, hashToken, requireAuth, ownerOf } from '../../middleware/auth';
import { AppError, asyncHandler, conflict, forbidden, unauthorized } from '../../utils/errors';
import { audit } from '../../utils/audit';
import { isMailConfigured, sendMail } from '../../utils/mailer';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

const passwordSchema = z.string().min(10, 'At least 10 characters').max(128);
const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Used to keep login timing similar when the email does not exist.
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmE';

const hashPassword = (pw: string) => argon2.hash(pw, { type: argon2.argon2id });

async function startSession(res: Response, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600 * 1000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    expires: expiresAt,
    path: '/',
  });
}

const publicUser = (u: { id: string; email: string; name: string; role: string }) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

authRouter.post(
  '/register',
  limiter,
  asyncHandler(async (req, res) => {
    if (!env.ENABLE_REGISTRATION) throw forbidden('Registration is disabled');
    const body = z.object({ email: emailSchema, password: passwordSchema, name: z.string().trim().min(1).max(120) }).parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) throw conflict('Email is already registered');
    // Role is always LANDLORD here; the client can never choose a role.
    const user = await prisma.user.create({ data: { email: body.email, name: body.name, passwordHash: await hashPassword(body.password) } });
    await audit({ ownerId: user.id, userId: user.id, action: 'auth.register', entity: 'User', entityId: user.id });
    await startSession(res, user.id);
    res.status(201).json({ data: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  limiter,
  asyncHandler(async (req, res) => {
    const body = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, body.password).catch(() => false);
    if (!user || !ok || user.disabledAt) throw unauthorized('Invalid email or password');
    await startSession(res, user.id);
    await audit({ ownerId: user.id, userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id });
    res.json({ data: publicUser(user) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  }),
);

authRouter.post(
  '/forgot-password',
  limiter,
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: emailSchema }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.disabledAt && isMailConfigured) {
      const token = randomBytes(32).toString('base64url');
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600 * 1000) },
      });
      await sendMail(user.email, 'Reset your password', `Open this link within 1 hour:\n${env.APP_ORIGIN}/reset-password?token=${token}`);
    }
    // Same response for every email so accounts cannot be enumerated.
    res.json({ data: { emailConfigured: isMailConfigured } });
  }),
);

authRouter.post(
  '/reset-password',
  limiter,
  asyncHandler(async (req, res) => {
    const body = z.object({ token: z.string().min(20).max(200), password: passwordSchema }).parse(req.body);
    const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(body.token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) throw new AppError(400, 'INVALID_TOKEN', 'Reset link is invalid or expired');
    const passwordHash = await hashPassword(body.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: rec.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: rec.userId } }),
    ]);
    await audit({ ownerId: rec.userId, userId: rec.userId, action: 'auth.password_reset', entity: 'User', entityId: rec.userId });
    res.status(204).end();
  }),
);

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: publicUser(req.user!) });
});

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        currentPassword: z.string().max(128).optional(),
        newPassword: passwordSchema.optional(),
      })
      .parse(req.body);
    const data: { name?: string; passwordHash?: string } = {};
    if (body.name) data.name = body.name;
    if (body.newPassword) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerOf(req) } });
      if (!body.currentPassword || !(await argon2.verify(user.passwordHash, body.currentPassword).catch(() => false))) {
        throw new AppError(400, 'WRONG_PASSWORD', 'Current password is incorrect');
      }
      data.passwordHash = await hashPassword(body.newPassword);
    }
    const updated = await prisma.user.update({ where: { id: ownerOf(req) }, data });
    if (data.passwordHash) await audit({ ownerId: updated.id, userId: updated.id, action: 'auth.password_change', entity: 'User', entityId: updated.id });
    res.json({ data: publicUser(updated) });
  }),
);
