/**
 * withTenant: the one door to tenant data. Opens a transaction, sets app.tenant_id (and the
 * acting user) with set_config(..., true) so it lasts only for this transaction, then runs fn.
 * RLS policies compare every row's tenant_id to app.tenant_id, so a query can never see or
 * write another tenant's rows, even if the code forgets a where clause.
 */
import 'server-only';
import { sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { db } from './client';
import type * as schema from './schema';

export type Tx = PgTransaction<PostgresJsQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export type TenantContext = {
  tenantId: string;
  /** users.id of the person (or agent member) acting; null for public pages and system jobs. */
  userId: string | null;
  actorType: 'user' | 'agent' | 'platform' | 'system';
  roleKey: string | null;
  capabilities: ReadonlySet<string>;
  impersonatedBy?: string | null;
  ip?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withTenant<T>(ctx: Pick<TenantContext, 'tenantId' | 'userId'>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!ctx.tenantId || !UUID.test(ctx.tenantId)) throw new Error('withTenant: no resolved tenant');
  return db().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${ctx.tenantId}, true), set_config('app.user_id', ${ctx.userId ?? ''}, true)`);
    return fn(tx as unknown as Tx);
  });
}
