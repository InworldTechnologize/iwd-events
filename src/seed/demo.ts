/**
 * Two demo tenants with sample data. Demo data lives only in this repo; it is not any real
 * company's data. Records are marked is_sample so "Clear sample data" can remove them later.
 */
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { createClient, createEnquiry } from '@/commands/sales';
import { execute } from '@/commands/core';
import { db } from '@/db/client';
import { authAccounts, clients, enquiries, memberships, users } from '@/db/schema';
import { withTenant, type TenantContext } from '@/db/tenant-tx';
import { capabilitiesFor, type Role } from '@/domain/permissions';
import { provisionTenant } from '@/tenancy/provision';

export const DEMO_PASSWORD = 'demo-pass-123';

export const DEMO_TENANTS = [
  {
    slug: 'kayal',
    name: 'Kayal Weddings (demo)',
    owner: { name: 'Demo Owner A', email: 'owner@kayal.demo' },
    staff: { name: 'Demo Sales A', email: 'sales@kayal.demo', role: 'sales' as Role },
    numbering: { enquiry: { prefix: 'KW-E-', pad: 4, resetYearly: false, format: '{prefix}{seq}' } },
    clients: [
      { name: 'Anjali & Rahul', phone: '+91 90000 00001', eventType: 'Wedding', venue: 'Lakeside Hall', guests: 600 },
      { name: 'Meera Nair', phone: '+91 90000 00002', eventType: 'Engagement', venue: 'Home', guests: 150 },
      { name: 'Joseph Family', phone: '+91 90000 00003', eventType: 'Reception', venue: 'Parish Hall', guests: 400 },
    ],
  },
  {
    slug: 'spice-route',
    name: 'Spice Route Caterers (demo)',
    owner: { name: 'Demo Owner B', email: 'owner@spiceroute.demo' },
    staff: { name: 'Demo Accounts B', email: 'accounts@spiceroute.demo', role: 'accounts' as Role },
    numbering: { enquiry: { prefix: 'SR/E/', pad: 3, resetYearly: true, format: '{prefix}{fy}/{seq}' } },
    clients: [
      { name: 'Techpark Annual Day', phone: '+91 90000 00011', eventType: 'Corporate', venue: 'Convention Centre', guests: 1200 },
      { name: 'Fathima Birthday', phone: '+91 90000 00012', eventType: 'Birthday', venue: 'Rooftop', guests: 80 },
    ],
  },
] as const;

async function ensureUser(name: string, email: string) {
  const [existing] = await db().select().from(users).where(eq(users.email, email));
  if (existing) return existing.id;
  const id = randomUUID();
  await db().insert(users).values({ id, name, email, emailVerified: true });
  await db().insert(authAccounts).values({ id: randomUUID(), userId: id, accountId: id, providerId: 'credential', password: await hashPassword(DEMO_PASSWORD) });
  return id;
}

export async function seedDemo() {
  const out: Record<string, { tenantId: string; ownerId: string; staffId: string }> = {};
  for (const d of DEMO_TENANTS) {
    const ownerId = await ensureUser(d.owner.name, d.owner.email);
    const staffId = await ensureUser(d.staff.name, d.staff.email);
    const tenantId = await provisionTenant({ slug: d.slug, name: d.name, ownerUserId: ownerId, settings: { numbering: d.numbering, business: { name: d.name } } });
    await withTenant({ tenantId, userId: ownerId }, (tx) => tx.insert(memberships).values({ tenantId, userId: staffId, roleKey: d.staff.role }));
    const ctx: TenantContext = { tenantId, userId: ownerId, actorType: 'system', roleKey: 'owner', capabilities: new Set(capabilitiesFor('owner')) };
    for (const c of d.clients) {
      const client = await execute(createClient, ctx, { name: c.name, phone: c.phone });
      await execute(createEnquiry, ctx, { clientId: client.id, eventType: c.eventType, venue: c.venue, guests: c.guests, source: 'Sample' });
    }
    await withTenant(ctx, async (tx) => {
      await tx.update(clients).set({ isSample: true });
      await tx.update(enquiries).set({ isSample: true });
    });
    out[d.slug] = { tenantId, ownerId, staffId };
  }
  return out;
}
