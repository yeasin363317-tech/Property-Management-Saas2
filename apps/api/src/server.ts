import { app } from './app';
import { env } from './config/env';
import { prisma } from './db';

const server = app.listen(env.PORT, () => console.log(`API listening on :${env.PORT}`));

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
