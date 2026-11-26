/** Platform lookups that run before a tenant is known. Each one is a SECURITY DEFINER function. */
import { rawSql } from './client';

export type HostTenant = { tenantId: string; slug: string; status: string };

export async function resolveHostInDb(host: string): Promise<HostTenant | null> {
  const rows = await rawSql()<{ tenant_id: string; slug: string; status: string }[]>`select * from resolve_host(${host})`;
  const r = rows[0];
  return r ? { tenantId: r.tenant_id, slug: r.slug, status: r.status } : null;
}

export type UserMembership = { tenantId: string; slug: string; name: string; roleKey: string; primaryHost: string | null };

export async function userMemberships(userId: string): Promise<UserMembership[]> {
  const rows = await rawSql()<{ tenant_id: string; slug: string; name: string; role_key: string; primary_host: string | null }[]>`select * from user_memberships(${userId})`;
  return rows.map((r) => ({ tenantId: r.tenant_id, slug: r.slug, name: r.name, roleKey: r.role_key, primaryHost: r.primary_host }));
}

export async function createTenantRow(slug: string, name: string, host: string, ownerUserId: string): Promise<string> {
  const rows = await rawSql()<{ id: string }[]>`select create_tenant(${slug}, ${name}, ${host}, ${ownerUserId}) as id`;
  return rows[0]!.id;
}
