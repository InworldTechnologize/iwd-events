import { rawSql } from './client';

export type TenantOverview = { tenantId: string; slug: string; name: string; status: string; trialEndsAt: Date | null; createdAt: Date; members: number; primaryHost: string | null };

/** Call only after checking that the signed-in user is platform staff. */
export async function tenantOverview(): Promise<TenantOverview[]> {
  const rows = await rawSql()<{ tenant_id: string; slug: string; name: string; status: string; trial_ends_at: Date | null; created_at: Date; members: string; primary_host: string | null }[]>`select * from platform_tenant_overview()`;
  return rows.map((r) => ({ tenantId: r.tenant_id, slug: r.slug, name: r.name, status: r.status, trialEndsAt: r.trial_ends_at, createdAt: r.created_at, members: Number(r.members), primaryHost: r.primary_host }));
}
