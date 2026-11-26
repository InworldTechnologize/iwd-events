import { afterAll, describe, expect, it } from 'vitest';
import { ownerSql } from '../helpers/fixtures';

/** Tables allowed to have no tenant_id: global identities and the plan catalogue. Nothing else. */
const GLOBAL_TABLES = new Set(['tenants', 'plans', 'users', 'sessions', 'auth_accounts', 'verifications', 'platform_staff', '_migrations']);

const sqlP = ownerSql();
afterAll(async () => (await sqlP).end());

describe('RLS coverage', () => {
  it('every table with tenant_id has NOT NULL, RLS enabled + forced, and a tenant policy', async () => {
    const sql = await sqlP;
    const rows = await sql<{ table: string; nullable: string; rls: boolean; force: boolean; policies: number }[]>`
      select c.relname as table, col.is_nullable as nullable, c.relrowsecurity as rls, c.relforcerowsecurity as force,
             (select count(*)::int from pg_policies p where p.tablename = c.relname and p.qual like '%app_tenant_id()%' and p.with_check like '%app_tenant_id()%') as policies
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      join information_schema.columns col on col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'tenant_id'
      where c.relkind = 'r'`;
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) {
      expect({ table: r.table, nullable: r.nullable, rls: r.rls, force: r.force, policy: r.policies > 0 }).toEqual({ table: r.table, nullable: 'NO', rls: true, force: true, policy: true });
    }
  });

  it('every other table is an approved global table', async () => {
    const sql = await sqlP;
    const rows = await sql<{ table: string }[]>`
      select c.relname as table from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where c.relkind = 'r' and not exists (select 1 from information_schema.columns col where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'tenant_id')`;
    for (const r of rows) expect(GLOBAL_TABLES.has(r.table), `${r.table} has no tenant_id and is not an approved global table`).toBe(true);
  });

  it('the tenants table itself is RLS-protected', async () => {
    const sql = await sqlP;
    const [r] = await sql<{ rls: boolean; force: boolean }[]>`select relrowsecurity as rls, relforcerowsecurity as force from pg_class where relname = 'tenants'`;
    expect(r).toEqual({ rls: true, force: true });
  });

  it('the app role cannot bypass RLS and owns no tables', async () => {
    const sql = await sqlP;
    const [role] = await sql<{ super: boolean; bypass: boolean }[]>`select rolsuper as super, rolbypassrls as bypass from pg_roles where rolname = 'iwd_app'`;
    expect(role).toEqual({ super: false, bypass: false });
    const owned = await sql`select tablename from pg_tables where schemaname = 'public' and tableowner = 'iwd_app'`;
    expect(owned.length).toBe(0);
  });

  it('every tenant table index leads with tenant_id (or is a unique key on a global id)', async () => {
    const sql = await sqlP;
    const rows = await sql<{ table: string; index: string; def: string }[]>`
      select i.tablename as table, i.indexname as index, i.indexdef as def from pg_indexes i
      where i.schemaname = 'public' and exists (select 1 from information_schema.columns col where col.table_schema = 'public' and col.table_name = i.tablename and col.column_name = 'tenant_id')`;
    // Allowed exceptions: primary keys on id, and globally unique hashes/keys/hosts.
    // memberships_user_idx serves the cross-tenant switcher (user_memberships()).
    const allowed = /_pkey$|_host_key$|_hash_key$|files_key_key$|^memberships_user_idx$/;
    for (const r of rows) {
      if (allowed.test(r.index)) continue;
      expect(r.def, `${r.index} should lead with tenant_id`).toMatch(/\(tenant_id[,)]/);
    }
  });
});
