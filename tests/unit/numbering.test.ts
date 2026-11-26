import { beforeAll, describe, expect, it } from 'vitest';
import { execute } from '@/commands/core';
import { createEnquiry } from '@/commands/sales';
import { financialYear } from '@/domain/fy';
import { formatNumber } from '@/domain/numbering';
import { ctxFor, demoIds } from '../helpers/fixtures';

describe('financial year', () => {
  it('runs April to March in India time', () => {
    expect(financialYear(new Date('2026-03-31T18:30:00Z'))).toBe('2026-27'); // 1 April 2026, 00:00 IST
    expect(financialYear(new Date('2026-03-31T18:29:00Z'))).toBe('2025-26');
    expect(financialYear(new Date('2027-01-15T00:00:00Z'))).toBe('2026-27');
    expect(financialYear(new Date('2099-12-31T00:00:00Z'))).toBe('2099-00');
  });
});

describe('formatNumber', () => {
  it('keeps prefixes and formats exactly (imported series carry over)', () => {
    const at = new Date('2026-11-26T00:00:00Z');
    expect(formatNumber('{prefix}{seq}', { prefix: 'DM/', fy: 'ALL', seq: 7, pad: 3, at })).toBe('DM/007');
    expect(formatNumber('{prefix}{seq}', { prefix: 'DM-RC-', fy: 'ALL', seq: 12, pad: 4, at })).toBe('DM-RC-0012');
    expect(formatNumber('{prefix}{yyyy}-{seq}', { prefix: 'DM-PKG-', fy: 'ALL', seq: 3, pad: 4, at })).toBe('DM-PKG-2026-0003');
    expect(formatNumber('{prefix}{fy}/{seq}', { prefix: 'INV/', fy: '2026-27', seq: 12345, pad: 3, at })).toBe('INV/2026-27/12345');
  });
});

describe('numbering under concurrency', () => {
  let ids: Awaited<ReturnType<typeof demoIds>>;
  beforeAll(async () => {
    ids = await demoIds();
  });

  it('50 parallel enquiries get 50 different, gap-free numbers', async () => {
    const ctx = ctxFor(ids.a.tenantId, ids.a.ownerId);
    const made = await Promise.all(Array.from({ length: 50 }, () => execute(createEnquiry, ctx, { source: 'test' })));
    const seqs = made.map((e) => Number(e.number.replace('KW-E-', ''))).sort((x, y) => x - y);
    expect(new Set(seqs).size).toBe(50);
    expect(seqs[49]! - seqs[0]!).toBe(49);
  });

  it('series are per tenant: B’s numbering is untouched by A', async () => {
    const e = await execute(createEnquiry, ctxFor(ids.b.tenantId, ids.b.ownerId), { source: 'test' });
    expect(e.number).toMatch(/^SR\/E\/\d{4}-\d{2}\/\d{3}$/);
  });

  it('a failed command gives its number back', async () => {
    const ctx = ctxFor(ids.b.tenantId, ids.b.ownerId);
    const before = await execute(createEnquiry, ctx, {});
    await execute(createEnquiry, ctx, { clientId: '00000000-0000-4000-8000-000000000000' }).catch(() => null);
    const after = await execute(createEnquiry, ctx, {});
    const n = (s: string) => Number(s.split('/').pop());
    expect(n(after.number) - n(before.number)).toBe(1);
  });
});
