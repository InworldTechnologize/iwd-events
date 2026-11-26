import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { clients } from '@/db/schema';
import { withTenant } from '@/db/tenant-tx';
import { requireMember } from '@/tenancy/admin';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireMember();
  if (!ctx.capabilities.has('clients.view') || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  // RLS: another tenant's client id returns no row, so the page is a 404.
  const [c] = await withTenant(ctx, (tx) => tx.select().from(clients).where(eq(clients.id, id)));
  if (!c) notFound();
  return (
    <div>
      <h1 className="text-2xl font-semibold">{c.name}</h1>
      <p className="tabular mt-2 text-muted">{c.phone}</p>
      {c.email && <p className="text-muted">{c.email}</p>}
    </div>
  );
}
