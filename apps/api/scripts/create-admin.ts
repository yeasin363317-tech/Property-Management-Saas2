/** Creates (or promotes) an ADMIN user. Usage: ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='...' npm run admin:create -w apps/api */
import argon2 from 'argon2';
import { prisma } from '../src/db';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 chars)');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', passwordHash },
    create: { email, name: 'Administrator', role: 'ADMIN', passwordHash },
  });
  await prisma.auditLog.create({ data: { ownerId: user.id, action: 'admin.bootstrap', entity: 'User', entityId: user.id } });
  console.log(`Admin ready: ${email}`);
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
