import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  // Used only to draft DDL (npx drizzle-kit generate --out tmp/ddl); real migrations are hand-checked files in migrations/.
  out: './tmp/ddl',
  dbCredentials: { url: process.env.DATABASE_URL_OWNER ?? 'postgres://postgres:postgres@localhost:5432/iwd' },
  strict: true,
});
