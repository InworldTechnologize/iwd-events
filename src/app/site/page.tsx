import { notFound } from 'next/navigation';
import { poweredByLine } from '@/config/product';
import { getSection } from '@/commands/settings';
import { tenants } from '@/db/schema';
import { withTenant } from '@/db/tenant-tx';
import { requestTenantId } from '@/tenancy/context';

export const dynamic = 'force-dynamic';

export default async function TenantHome() {
  const tenantId = await requestTenantId();
  if (!tenantId) notFound();
  const data = await withTenant({ tenantId, userId: null }, async (tx) => {
    const [t] = await tx.select({ name: tenants.name, poweredByHidden: tenants.poweredByHidden }).from(tenants);
    const business = await getSection(tx, tenantId, 'business');
    return { t, business };
  });
  if (!data.t) notFound();
  const name = data.business.name || data.t.name;
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <h1 className="text-4xl font-semibold">{name}</h1>
        <p className="mt-4 text-muted">Website coming soon. Templates arrive in the website phase.</p>
      </main>
      {!data.t.poweredByHidden && <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">{poweredByLine()}</footer>}
    </div>
  );
}
