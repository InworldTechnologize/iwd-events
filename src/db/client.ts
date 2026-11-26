/**
 * The only place that holds the app's database pool. It is not exported outside src/db:
 * all tenant work goes through withTenant(); platform lookups use the SECURITY DEFINER
 * functions in drizzle/0001_rls.sql via platform.ts.
 */
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;
const g = globalThis as unknown as { __iwdSql?: postgres.Sql; __iwdDb?: Db };

export function rawSql(): postgres.Sql {
  if (!g.__iwdSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    g.__iwdSql = postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 10), onnotice: () => {} });
  }
  return g.__iwdSql;
}

export function db(): Db {
  g.__iwdDb ??= drizzle(rawSql(), { schema });
  return g.__iwdDb;
}

export async function closeDb() {
  await g.__iwdSql?.end();
  g.__iwdSql = undefined;
  g.__iwdDb = undefined;
}
