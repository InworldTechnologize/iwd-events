/**
 * Builds the TenantContext for a request: host → tenant (from middleware's trusted header),
 * then the signed-in user's membership in that tenant. No membership → no context → no data.
 */
import 'server-only';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { memberships, roles } from '@/db/schema';
import { withTenant, type TenantContext } from '@/db/tenant-tx';
import { TENANT_HEADER } from './headers';

export async function requestTenantId(): Promise<string | null> {
  const h = await headers();
  return h.get(TENANT_HEADER);
}

export async function memberContext(tenantId: string, userId: string, ip?: string | null): Promise<TenantContext | null> {
  const found = await withTenant({ tenantId, userId }, async (tx) => {
    const [m] = await tx
      .select({ roleKey: memberships.roleKey, status: memberships.status, kind: memberships.kind, caps: roles.capabilities })
      .from(memberships)
      .leftJoin(roles, and(eq(roles.tenantId, memberships.tenantId), eq(roles.key, memberships.roleKey)))
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
    return m;
  });
  if (!found || found.status !== 'active') return null;
  return {
    tenantId,
    userId,
    actorType: found.kind === 'agent' ? 'agent' : 'user',
    roleKey: found.roleKey,
    capabilities: new Set(found.caps ?? []),
    ip: ip ?? null,
  };
}
