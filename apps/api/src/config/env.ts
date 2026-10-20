import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: bool.default('false'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(168),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  ENABLE_REGISTRATION: bool.default('true'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', JSON.stringify(parsed.error.flatten().fieldErrors));
  process.exit(1);
}

export const env = parsed.data;
export const allowedOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
