/** Host → tenant, cached (Redis) for 5 minutes; unknown hosts are cached for 1 minute. */
import { resolveHostInDb, type HostTenant } from '@/db/platform';
import { cacheDel, cacheGet, cacheSet } from '@/lib/cache';
import { classifyHost } from './host';

const key = (host: string) => `host:${host}`;

export async function resolveTenantByHost(rawHost: string | null | undefined): Promise<{ kind: 'marketing' } | { kind: 'platform' } | { kind: 'tenant'; tenant: HostTenant; host: string } | { kind: 'unknown' }> {
  const c = classifyHost(rawHost);
  if (c.kind === 'marketing' || c.kind === 'platform') return c;
  if (c.kind === 'invalid') return { kind: 'unknown' };
  const cached = await cacheGet(key(c.host));
  if (cached !== null) {
    if (cached === '') return { kind: 'unknown' };
    return { kind: 'tenant', tenant: JSON.parse(cached) as HostTenant, host: c.host };
  }
  const t = await resolveHostInDb(c.host);
  await cacheSet(key(c.host), t ? JSON.stringify(t) : '', t ? 300 : 60);
  return t ? { kind: 'tenant', tenant: t, host: c.host } : { kind: 'unknown' };
}

export async function forgetHost(host: string) {
  await cacheDel(key(host));
}
