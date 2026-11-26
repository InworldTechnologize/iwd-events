/** Creates a tenant with its subdomain, owner membership, built-in roles, default branch and settings. */
import 'server-only';
import { createTenantRow } from '@/db/platform';
import { branches, roles, tenantSettings } from '@/db/schema';
import { withTenant } from '@/db/tenant-tx';
import { capabilitiesFor, ROLE_INFO, ROLES } from '@/domain/permissions';
import { SETTINGS_SCHEMAS, type SettingsSection } from '@/domain/settings';
import { subdomainHost } from './host';

export const RESERVED_SLUGS = new Set(['www', 'admin', 'api', 'app', 'mail', 'static', 'assets', 'platform', 'help', 'status', 'docs', 'blog']);

export async function provisionTenant(a: { slug: string; name: string; ownerUserId: string; settings?: Partial<Record<SettingsSection, unknown>> }) {
  const slug = a.slug.toLowerCase();
  if (RESERVED_SLUGS.has(slug)) throw new Error('That address is reserved');
  const tenantId = await createTenantRow(slug, a.name, subdomainHost(slug), a.ownerUserId);
  await withTenant({ tenantId, userId: a.ownerUserId }, async (tx) => {
    await tx.insert(roles).values(ROLES.map((r) => ({ tenantId, key: r, name: ROLE_INFO[r].label, builtin: true, capabilities: capabilitiesFor(r) })));
    await tx.insert(branches).values({ tenantId, name: 'Main', code: 'MAIN', isDefault: true });
    const sections = { business: { name: a.name }, ...(a.settings ?? {}) } as Partial<Record<SettingsSection, unknown>>;
    const rows = (Object.keys(SETTINGS_SCHEMAS) as SettingsSection[]).map((s) => ({ tenantId, section: s, data: SETTINGS_SCHEMAS[s].parse(sections[s] ?? {}) as object, updatedBy: a.ownerUserId }));
    await tx.insert(tenantSettings).values(rows);
  });
  return tenantId;
}
