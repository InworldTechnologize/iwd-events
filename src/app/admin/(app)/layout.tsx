import { PRODUCT } from '@/config/product';
import { tenants } from '@/db/schema';
import { withTenant } from '@/db/tenant-tx';
import { requireMember } from '@/tenancy/admin';
import Link from 'next/link';
import { userTwoFactor } from '@/auth/session';
import { SignOut } from './SignOut';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ctx, user } = await requireMember();
  const [t] = await withTenant(ctx, (tx) => tx.select({ name: tenants.name }).from(tenants));
  const needsTwoStep = ctx.roleKey === 'owner' && !(await userTwoFactor(user.id));
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{t?.name}</p>
          <p className="truncate text-sm text-muted">{user.name} · {ctx.roleKey}</p>
        </div>
        <SignOut />
      </header>
      {needsTwoStep && (
        <div role="status" className="border-b border-border bg-surface-2 px-4 py-3 text-sm">
          Owners should turn on two-step login. <Link href="/admin/security" className="font-semibold text-primary underline-offset-4 hover:underline">Set it up</Link>
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">
        {PRODUCT.name} {PRODUCT.version} · <a href={PRODUCT.maker.url} rel="noopener" className="hover:underline">{PRODUCT.maker.line}</a>
      </footer>
    </div>
  );
}
