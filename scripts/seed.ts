import { closeDb } from '../src/db/client';
import postgres from 'postgres';
import { seedDemo, DEMO_PASSWORD, DEMO_STAFF, DEMO_TENANTS } from '../src/seed/demo';

const { staffUserId } = await seedDemo();
const owner = postgres(process.env.DATABASE_URL_OWNER!, { max: 1 });
await owner`insert into platform_staff (user_id, role) values (${staffUserId}, 'admin') on conflict do nothing`;
await owner.end();
console.log(`console (platform.<root>): ${DEMO_STAFF.email}  password ${DEMO_PASSWORD}`);
for (const t of DEMO_TENANTS) console.log(`${t.slug}: ${t.owner.email} / ${t.staff.email}  password ${DEMO_PASSWORD}`);
await closeDb();
