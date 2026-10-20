/**
 * Daily maintenance job (idempotent, safe to run any number of times):
 *  1. closes expired leases, 2. generates this month's rent obligations, 3. refreshes in-app notifications.
 * Production:  node dist/jobs/daily.js   (see docs/deployment.md for cron)
 */
import { prisma } from '../db';
import { closeExpiredLeases } from '../modules/leases/lease.service';
import { refreshNotifications } from '../modules/notifications/notifications.service';
import { generateObligations } from '../modules/rent/rent.service';
import { today } from '../utils/dates';

async function main() {
  const closed = await closeExpiredLeases();
  const rent = await generateObligations(today());
  const notifications = await refreshNotifications();
  console.log(JSON.stringify({ closedLeases: closed, obligationsCreated: rent.created, notificationsCreated: notifications }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
