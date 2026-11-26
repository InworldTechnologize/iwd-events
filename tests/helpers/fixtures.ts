import postgres from 'postgres';
import { capabilitiesFor, type Role } from '@/domain/permissions';
import type { TenantContext } from '@/db/tenant-tx';
import { TEST_OWNER_URL } from './env';

export async function demoIds() {
  const sql = postgres(TEST_OWNER_URL, { max: 1 });
  const rows = await sql<{ slug: string; id: string; owner: string }[]>`
    select t.slug, t.id, m.user_id as owner from tenants t join memberships m on m.tenant_id = t.id and m.role_key = 'owner'`;
  const clientRows = await sql<{ slug: string; id: string }[]>`select t.slug, c.id from clients c join tenants t on t.id = c.tenant_id`;
  await sql.end();
  const a = rows.find((r) => r.slug === 'kayal')!;
  const b = rows.find((r) => r.slug === 'spice-route')!;
  return {
    a: { tenantId: a.id, ownerId: a.owner, clientIds: clientRows.filter((c) => c.slug === 'kayal').map((c) => c.id) },
    b: { tenantId: b.id, ownerId: b.owner, clientIds: clientRows.filter((c) => c.slug === 'spice-route').map((c) => c.id) },
  };
}

export function ctxFor(tenantId: string, userId: string, role: Role = 'owner'): TenantContext {
  return { tenantId, userId, actorType: 'user', roleKey: role, capabilities: new Set(capabilitiesFor(role)) };
}

export async function ownerSql() {
  return postgres(TEST_OWNER_URL, { max: 1, onnotice: () => {} });
}
