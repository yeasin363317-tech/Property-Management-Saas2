import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (msg: string) => new AppError(409, 'CONFLICT', msg);
export const badRequest = (msg: string) => new AppError(400, 'BAD_REQUEST', msg);
export const unauthorized = (msg = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Forbidden') => new AppError(403, 'FORBIDDEN', msg);

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
export const asyncHandler =
  (fn: AsyncFn): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
