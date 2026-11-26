import Link from 'next/link';
import { asc, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { clients } from '@/db/schema';
import { withTenant } from '@/db/tenant-tx';
import { requireMember } from '@/tenancy/admin';

export default async function ClientsPage() {
  const { ctx } = await requireMember();
  if (!ctx.capabilities.has('clients.view')) notFound();
  const rows = await withTenant(ctx, (tx) => tx.select().from(clients).where(isNull(clients.deletedAt)).orderBy(asc(clients.name)));
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Clients</h1>
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/clients/${c.id}`} className="block rounded-[var(--radius-card)] border border-border bg-surface p-4">
              <p className="font-medium">{c.name}</p>
              <p className="tabular text-sm text-muted">{c.phone}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
