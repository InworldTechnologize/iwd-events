import { closeDb } from '../src/db/client';
import { seedDemo, DEMO_PASSWORD, DEMO_TENANTS } from '../src/seed/demo';

await seedDemo();
for (const t of DEMO_TENANTS) console.log(`${t.slug}: ${t.owner.email} / ${t.staff.email}  password ${DEMO_PASSWORD}`);
await closeDb();
