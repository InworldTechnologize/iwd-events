import { PRODUCT } from '@/config/product';
import { tenants } from '@/db/schema';
import { withTenant } from '@/db/tenant-tx';
import { requireMember } from '@/tenancy/admin';
import { SignOut } from './SignOut';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ctx, user } = await requireMember();
  const [t] = await withTenant(ctx, (tx) => tx.select({ name: tenants.name }).from(tenants));
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{t?.name}</p>
          <p className="truncate text-sm text-muted">{user.name} · {ctx.roleKey}</p>
        </div>
        <SignOut />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">
        {PRODUCT.name} {PRODUCT.version} · <a href={PRODUCT.maker.url} rel="noopener" className="hover:underline">{PRODUCT.maker.line}</a>
      </footer>
    </div>
  );
}
