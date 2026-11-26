import Link from 'next/link';
import { count, desc } from 'drizzle-orm';
import { clients, enquiries } from '@/db/schema';
import { withTenant } from '@/db/tenant-tx';
import { userMemberships } from '@/db/platform';
import { requireMember } from '@/tenancy/admin';

export default async function AdminHome() {
  const { ctx, user } = await requireMember();
  const { counts, recent } = await withTenant(ctx, async (tx) => {
    const [c] = await tx.select({ n: count() }).from(clients);
    const [e] = await tx.select({ n: count() }).from(enquiries);
    const recent = await tx.select({ id: enquiries.id, number: enquiries.number, status: enquiries.status, eventType: enquiries.eventType }).from(enquiries).orderBy(desc(enquiries.createdAt)).limit(5);
    return { counts: { clients: c?.n ?? 0, enquiries: e?.n ?? 0 }, recent };
  });
  const others = (await userMemberships(user.id)).filter((m) => m.tenantId !== ctx.tenantId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Today</h1>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin/clients" className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <p className="text-sm text-muted">Clients</p>
          <p className="tabular text-3xl font-semibold">{counts.clients}</p>
        </Link>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <p className="text-sm text-muted">Enquiries</p>
          <p className="tabular text-3xl font-semibold">{counts.enquiries}</p>
        </div>
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Latest enquiries</h2>
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="tabular font-medium">{r.number}</span>
              <span className="truncate text-sm text-muted">{r.eventType ?? ''}</span>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs">{r.status}</span>
            </li>
          ))}
        </ul>
      </section>
      {others.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Your other businesses</h2>
          <ul className="space-y-2">
            {others.map((m) => (
              <li key={m.tenantId}>
                <a className="text-primary underline-offset-4 hover:underline" href={m.primaryHost ? `//${m.primaryHost}${process.env.NODE_ENV === 'production' ? '' : ':' + (process.env.PORT ?? '3000')}/admin` : '#'}>
                  {m.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
