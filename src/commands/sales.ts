import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { clients, enquiries, tenants } from '@/db/schema';
import { takeNumber } from '@/domain/numbering';
import { DEFAULT_PREFIX } from '@/domain/settings';
import { canTransition, ENQUIRY_FLOW } from '@/domain/state-machine';
import { CommandError, defineCommand } from './core';
import { getSection } from './settings';

const phone = z.string().trim().regex(/^\+?[0-9 ]{8,16}$/, 'Phone number').optional();

export const createClient = defineCommand({
  name: 'createClient',
  capability: 'clients.edit',
  input: z.object({ name: z.string().trim().min(1).max(120), phone, email: z.string().email().optional(), notes: z.string().max(2000).optional() }),
  async run({ tx, ctx, input, emit, audit }) {
    const [row] = await tx.insert(clients).values({ tenantId: ctx.tenantId, ...input }).returning();
    audit({ entityType: 'client', entityId: row!.id, after: row });
    emit('client.created', 'client', row!.id);
    return row!;
  },
});

export const createEnquiry = defineCommand({
  name: 'createEnquiry',
  capability: 'enquiries',
  input: z.object({
    clientId: z.string().uuid().optional(),
    source: z.string().max(40).optional(),
    eventType: z.string().max(60).optional(),
    eventDate: z.string().date().optional(),
    venue: z.string().max(200).optional(),
    guests: z.number().int().min(0).max(100000).optional(),
    notes: z.string().max(4000).optional(),
  }),
  async run({ tx, ctx, input, emit, audit }) {
    if (input.clientId) {
      const [c] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.tenantId, ctx.tenantId)));
      if (!c) throw new CommandError('not_found', 'Client not found');
    }
    const [t] = await tx.select({ timezone: tenants.timezone }).from(tenants).where(eq(tenants.id, ctx.tenantId));
    const numbering = await getSection(tx, ctx.tenantId, 'numbering');
    const number = await takeNumber(tx, ctx.tenantId, 'enquiry', {
      timeZone: t?.timezone,
      defaults: numbering.enquiry ?? { prefix: DEFAULT_PREFIX.enquiry, resetYearly: false },
    });
    const [row] = await tx.insert(enquiries).values({ tenantId: ctx.tenantId, number, ...input }).returning();
    audit({ entityType: 'enquiry', entityId: row!.id, after: row });
    emit('enquiry.created', 'enquiry', row!.id, { number });
    return row!;
  },
});

export const changeEnquiryStatus = defineCommand({
  name: 'changeEnquiryStatus',
  capability: 'enquiries',
  input: z.object({ id: z.string().uuid(), status: z.enum(['new', 'contacted', 'site_visit', 'quoted', 'confirmed', 'completed', 'lost']), lostReason: z.string().max(200).optional() }),
  async run({ tx, ctx, input, emit, audit }) {
    const [cur] = await tx.select().from(enquiries).where(and(eq(enquiries.id, input.id), eq(enquiries.tenantId, ctx.tenantId))).for('update');
    if (!cur) throw new CommandError('not_found', 'Enquiry not found');
    if (!canTransition(ENQUIRY_FLOW, cur.status, input.status)) throw new CommandError('conflict', `Cannot move from ${cur.status} to ${input.status}`);
    if (input.status === 'lost' && !input.lostReason) throw new CommandError('invalid', 'A lost reason is required');
    const [row] = await tx
      .update(enquiries)
      .set({ status: input.status, lostReason: input.status === 'lost' ? input.lostReason : null, updatedAt: new Date() })
      .where(eq(enquiries.id, cur.id))
      .returning();
    audit({ entityType: 'enquiry', entityId: cur.id, before: { status: cur.status }, after: { status: row!.status } });
    emit(`enquiry.${input.status}`, 'enquiry', cur.id, { from: cur.status });
    return row!;
  },
});
