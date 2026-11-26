import postgres from 'postgres';
import { TEST_APP_URL, TEST_OWNER_URL } from './env';

export default async function setup() {
  const admin = new URL(TEST_OWNER_URL);
  admin.pathname = '/postgres';
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  await sql.unsafe('drop database if exists iwd_test with (force)');
  await sql.unsafe('create database iwd_test');
  await sql.end();
  process.env.DATABASE_URL = TEST_APP_URL;
  process.env.ROOT_DOMAIN = 'localhost';
  process.env.REDIS_URL = '';
  const { runMigrations } = await import('../../src/db/migrate');
  await runMigrations(TEST_OWNER_URL, TEST_APP_URL);
  const { seedDemo } = await import('../../src/seed/demo');
  const { staffUserId } = await seedDemo();
  const owner = postgres(TEST_OWNER_URL, { max: 1, onnotice: () => {} });
  await owner`insert into platform_staff (user_id, role) values (${staffUserId}, 'admin') on conflict do nothing`;
  await owner.end();
  const { closeDb } = await import('../../src/db/client');
  await closeDb();
}
