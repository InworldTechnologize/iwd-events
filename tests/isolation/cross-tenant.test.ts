import { beforeAll, describe, expect, it } from 'vitest';
import { eq, sql as dsql } from 'drizzle-orm';
import { execute, CommandError } from '@/commands/core';
import { createEnquiry } from '@/commands/sales';
import { auditLog, clients, documentSequences, enquiries, files, memberships, outboxEvents, tenantSettings, tenants } from '@/db/schema';
import { rawSql } from '@/db/client';
import { withTenant } from '@/db/tenant-tx';
import { findToken, issueToken } from '@/domain/tokens';
import { fileKey, prepareUpload, signedDownloadUrl } from '@/storage/files';
import { resolveTenantByHost } from '@/tenancy/resolve';
import { memberContext } from '@/tenancy/context';
import { userMemberships } from '@/db/platform';
import { ctxFor, demoIds } from '../helpers/fixtures';

/** Drizzle wraps driver errors; the Postgres message is on the cause. */
const pgMessage = (p: Promise<unknown>) => p.then(() => 'no error', (e: { cause?: { message?: string }; message: string }) => e.cause?.message ?? e.message);

let ids: Awaited<ReturnType<typeof demoIds>>;
beforeAll(async () => {
  ids = await demoIds();
});

describe('no tenant, no data', () => {
  it('the app role sees nothing without app.tenant_id', async () => {
    const sql = rawSql();
    for (const t of ['clients', 'enquiries', 'tenants', 'tenant_settings', 'memberships', 'audit_log', 'files', 'public_tokens']) {
      const rows = await sql.unsafe(`select count(*)::int as n from ${t}`);
      expect(rows[0]!.n, t).toBe(0);
    }
  });

  it('withTenant refuses a missing or malformed tenant id', async () => {
    await expect(withTenant({ tenantId: '', userId: null }, async () => 1)).rejects.toThrow();
    await expect(withTenant({ tenantId: "x' or 1=1", userId: null }, async () => 1)).rejects.toThrow();
  });

  it('app.tenant_id does not leak to the next transaction on the same pool', async () => {
    await withTenant({ tenantId: ids.a.tenantId, userId: null }, async (tx) => tx.select().from(clients));
    const sql = rawSql();
    for (let i = 0; i < 5; i++) {
      const [r] = await sql`select count(*)::int as n from clients`;
      expect(r!.n).toBe(0);
    }
  });
});

describe('tenant A cannot read tenant B', () => {
  it('lists only its own rows in every table', async () => {
    await withTenant({ tenantId: ids.a.tenantId, userId: ids.a.ownerId }, async (tx) => {
      for (const t of [clients, enquiries, tenantSettings, memberships, auditLog, outboxEvents, documentSequences]) {
        const rows = (await tx.select().from(t)) as { tenantId: string }[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.tenantId === ids.a.tenantId)).toBe(true);
      }
      const ts = await tx.select().from(tenants);
      expect(ts.map((t) => t.id)).toEqual([ids.a.tenantId]);
    });
  });

  it('cannot fetch B rows by id (guessed URL)', async () => {
    const bClient = ids.b.clientIds[0]!;
    const rows = await withTenant({ tenantId: ids.a.tenantId, userId: ids.a.ownerId }, (tx) => tx.select().from(clients).where(eq(clients.id, bClient)));
    expect(rows).toEqual([]);
  });

  it('cannot read B rows even by naming B’s tenant_id in the query', async () => {
    const rows = await withTenant({ tenantId: ids.a.tenantId, userId: null }, (tx) => tx.select().from(clients).where(eq(clients.tenantId, ids.b.tenantId)));
    expect(rows).toEqual([]);
  });
});

describe('tenant A cannot write tenant B', () => {
  it('update and delete of B rows touch nothing', async () => {
    const bClient = ids.b.clientIds[0]!;
    const updated = await withTenant({ tenantId: ids.a.tenantId, userId: null }, (tx) => tx.update(clients).set({ name: 'hacked' }).where(eq(clients.id, bClient)).returning());
    expect(updated).toEqual([]);
    const deleted = await withTenant({ tenantId: ids.a.tenantId, userId: null }, (tx) => tx.delete(clients).where(eq(clients.id, bClient)).returning());
    expect(deleted).toEqual([]);
    const still = await withTenant({ tenantId: ids.b.tenantId, userId: null }, (tx) => tx.select().from(clients).where(eq(clients.id, bClient)));
    expect(still[0]?.name).not.toBe('hacked');
  });

  it('insert with B’s tenant_id is refused by RLS', async () => {
    expect(await pgMessage(withTenant({ tenantId: ids.a.tenantId, userId: null }, (tx) => tx.insert(clients).values({ tenantId: ids.b.tenantId, name: 'intruder' })))).toMatch(/row-level security/);
  });

  it('moving an A row into B is refused', async () => {
    const aClient = ids.a.clientIds[0]!;
    expect(await pgMessage(withTenant({ tenantId: ids.a.tenantId, userId: null }, (tx) => tx.update(clients).set({ tenantId: ids.b.tenantId }).where(eq(clients.id, aClient))))).toMatch(/row-level security/);
  });

  it('a command cannot link B’s client to an A enquiry', async () => {
    const err = await execute(createEnquiry, ctxFor(ids.a.tenantId, ids.a.ownerId), { clientId: ids.b.clientIds[0] }).catch((e) => e);
    expect(err).toBeInstanceOf(CommandError);
    expect((err as CommandError).code).toBe('not_found');
  });

  it('switching set_config inside a transaction is the only door, and it is per transaction', async () => {
    const n = await withTenant({ tenantId: ids.a.tenantId, userId: null }, async (tx) => {
      const r = await tx.execute(dsql`select current_setting('app.tenant_id', true) as t`);
      return (r as unknown as { t: string }[])[0]!.t;
    });
    expect(n).toBe(ids.a.tenantId);
  });
});

describe('tokens, files and hosts', () => {
  it('a public token from B does not open on A', async () => {
    const entity = ids.b.clientIds[0]!;
    const token = await withTenant({ tenantId: ids.b.tenantId, userId: null }, (tx) => issueToken(tx, ids.b.tenantId, 'quotation', entity));
    const onA = await withTenant({ tenantId: ids.a.tenantId, userId: null }, (tx) => findToken(tx, ids.a.tenantId, 'quotation', token));
    expect(onA).toBeNull();
    const onB = await withTenant({ tenantId: ids.b.tenantId, userId: null }, (tx) => findToken(tx, ids.b.tenantId, 'quotation', token));
    expect(onB?.entityId).toBe(entity);
    const wrongKind = await withTenant({ tenantId: ids.b.tenantId, userId: null }, (tx) => findToken(tx, ids.b.tenantId, 'invoice', token));
    expect(wrongKind).toBeNull();
  });

  it('a file id from B gives A no download URL', async () => {
    const { file } = await withTenant({ tenantId: ids.b.tenantId, userId: null }, (tx) => prepareUpload(tx, ids.b.tenantId, { area: 'gallery', ext: 'jpg', contentType: 'image/jpeg', bytes: 10, userId: null }));
    expect(file.key.startsWith(`tenants/${ids.b.tenantId}/gallery/`)).toBe(true);
    const onA = await withTenant({ tenantId: ids.a.tenantId, userId: null }, (tx) => signedDownloadUrl(tx, ids.a.tenantId, file.id));
    expect(onA).toBeNull();
    const onB = await withTenant({ tenantId: ids.b.tenantId, userId: null }, (tx) => signedDownloadUrl(tx, ids.b.tenantId, file.id));
    expect(onB).toContain(encodeURI(file.key).split('/').slice(0, 2).join('/'));
  });

  it('a file row cannot point into another tenant’s folder', async () => {
    const badKey = fileKey(ids.b.tenantId, 'gallery', 'jpg');
    expect(await pgMessage(withTenant({ tenantId: ids.a.tenantId, userId: null }, (tx) => tx.insert(files).values({ tenantId: ids.a.tenantId, area: 'gallery', key: badKey, contentType: 'image/jpeg' })))).toMatch(/files_key_prefix_check/);
  });

  it('hosts resolve to their own tenant only', async () => {
    const a = await resolveTenantByHost('kayal.localhost:3000');
    expect(a.kind === 'tenant' && a.tenant.tenantId).toBe(ids.a.tenantId);
    const b = await resolveTenantByHost('SPICE-ROUTE.localhost');
    expect(b.kind === 'tenant' && b.tenant.tenantId).toBe(ids.b.tenantId);
    expect((await resolveTenantByHost('nobody.localhost')).kind).toBe('unknown');
    expect((await resolveTenantByHost('localhost')).kind).toBe('marketing');
    expect((await resolveTenantByHost('evil.com/../kayal.localhost')).kind).toBe('unknown');
  });

  it('B’s owner has no membership context in A', async () => {
    expect(await memberContext(ids.a.tenantId, ids.b.ownerId)).toBeNull();
    const ctx = await memberContext(ids.a.tenantId, ids.a.ownerId);
    expect(ctx?.roleKey).toBe('owner');
    expect(ctx?.capabilities.has('settings')).toBe(true);
  });

  it('the switcher lists only the user’s own memberships', async () => {
    const list = await userMemberships(ids.a.ownerId);
    expect(list.map((m) => m.tenantId)).toEqual([ids.a.tenantId]);
  });
});

describe('platform console boundary', () => {
  it('the app role cannot make itself platform staff', async () => {
    const sql = rawSql();
    const msg = await sql`insert into platform_staff (user_id, role) values (${ids.a.ownerId}, 'admin')`.then(() => 'no error', (e: Error) => e.message);
    expect(msg).toMatch(/permission denied/);
  });

  it('platform.<root> is the console, never a tenant', async () => {
    expect((await resolveTenantByHost('platform.localhost')).kind).toBe('platform');
  });
});
