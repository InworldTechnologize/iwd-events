/** Host parsing: pure, so it is unit-tested. */
import { rootDomain } from '@/config/product';

export type HostKind = { kind: 'marketing' } | { kind: 'tenant'; host: string } | { kind: 'invalid' };

export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const h = raw.trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, '');
  if (!h || h.length > 253 || !/^[a-z0-9.-]+$/.test(h) || h.includes('..')) return null;
  return h;
}

/** Root domain and www → marketing site; anything else is a tenant host (subdomain or custom domain). */
export function classifyHost(raw: string | null | undefined, root = rootDomain()): HostKind {
  const host = normalizeHost(raw);
  if (!host) return { kind: 'invalid' };
  if (host === root || host === `www.${root}`) return { kind: 'marketing' };
  return { kind: 'tenant', host };
}

export function subdomainHost(slug: string, root = rootDomain()) {
  return `${slug}.${root}`;
}
