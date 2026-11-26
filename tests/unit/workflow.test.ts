import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { CommandError, execute } from '@/commands/core';
import { changeEnquiryStatus, createClient, createEnquiry } from '@/commands/sales';
import { auditLog, outboxEvents } from '@/db/schema';
import { withTenant } from '@/db/tenant-tx';
import { canTransition, ENQUIRY_FLOW } from '@/domain/state-machine';
import { classifyHost, normalizeHost } from '@/tenancy/host';
import { ctxFor, demoIds } from '../helpers/fixtures';

describe('enquiry state machine', () => {
  it('allows the forward flow and blocks jumps', () => {
    expect(canTransition(ENQUIRY_FLOW, 'new', 'contacted')).toBe(true);
    expect(canTransition(ENQUIRY_FLOW, 'new', 'completed')).toBe(false);
    expect(canTransition(ENQUIRY_FLOW, 'completed', 'lost')).toBe(false);
    expect(canTransition(ENQUIRY_FLOW, 'lost', 'new')).toBe(true);
    expect(canTransition(ENQUIRY_FLOW, 'new', 'new')).toBe(false);
  });
});

describe('commands', () => {
  let ids: Awaited<ReturnType<typeof demoIds>>;
  beforeAll(async () => {
    ids = await demoIds();
  });

  it('logs every transition to audit_log and the outbox', async () => {
    const ctx = ctxFor(ids.a.tenantId, ids.a.ownerId);
    const e = await execute(createEnquiry, ctx, {});
    await execute(changeEnquiryStatus, ctx, { id: e.id, status: 'contacted' });
    const { audits, events } = await withTenant(ctx, async (tx) => ({
      audits: await tx.select().from(auditLog).where(eq(auditLog.entityId, e.id)),
      events: await tx.select().from(outboxEvents).where(eq(outboxEvents.entityId, e.id)),
    }));
    expect(audits.map((a) => a.command)).toEqual(['createEnquiry', 'changeEnquiryStatus']);
    expect(audits[1]!.before).toEqual({ status: 'new' });
    expect(events.map((x) => x.type)).toEqual(['enquiry.created', 'enquiry.contacted']);
  });

  it('refuses an illegal transition and requires a lost reason', async () => {
    const ctx = ctxFor(ids.a.tenantId, ids.a.ownerId);
    const e = await execute(createEnquiry, ctx, {});
    await expect(execute(changeEnquiryStatus, ctx, { id: e.id, status: 'completed' })).rejects.toMatchObject({ code: 'conflict' });
    await expect(execute(changeEnquiryStatus, ctx, { id: e.id, status: 'lost' })).rejects.toMatchObject({ code: 'invalid' });
    const lost = await execute(changeEnquiryStatus, ctx, { id: e.id, status: 'lost', lostReason: 'Budget' });
    expect(lost.lostReason).toBe('Budget');
  });

  it('checks the role: accounts cannot create enquiries’ clients? (they can) but staff cannot edit clients', async () => {
    await expect(execute(createClient, ctxFor(ids.a.tenantId, ids.a.ownerId, 'staff'), { name: 'X' })).rejects.toBeInstanceOf(CommandError);
    const ok = await execute(createClient, ctxFor(ids.a.tenantId, ids.a.ownerId, 'accounts'), { name: 'Y' });
    expect(ok.name).toBe('Y');
  });

  it('validates input', async () => {
    await expect(execute(createClient, ctxFor(ids.a.tenantId, ids.a.ownerId), { name: '' })).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('host parsing', () => {
  it('normalises and classifies', () => {
    expect(normalizeHost('Kayal.LocalHost:3000')).toBe('kayal.localhost');
    expect(normalizeHost('a..b')).toBeNull();
    expect(normalizeHost('a/b')).toBeNull();
    expect(classifyHost('www.iwd.inworldtechnologize.com', 'iwd.inworldtechnologize.com')).toEqual({ kind: 'marketing' });
    expect(classifyHost('events.acme.in', 'iwd.inworldtechnologize.com')).toEqual({ kind: 'tenant', host: 'events.acme.in' });
  });
});
