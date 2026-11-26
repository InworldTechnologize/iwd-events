import Link from 'next/link';
import { userTwoFactor } from '@/auth/session';
import { tenantOverview } from '@/db/platform-console';
import { requireStaff } from '@/tenancy/platform';

export default async function ConsoleHome() {
  const { user, role } = await requireStaff();
  const twoStep = await userTwoFactor(user.id);
  const tenants = await tenantOverview();
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{user.email} · {role}</p>
      {!twoStep && (
        <p role="status" className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
          Staff accounts must use two-step login. <Link href="/security" className="font-semibold text-primary">Set it up</Link>
        </p>
      )}
      <h1 className="text-2xl font-semibold">Tenants</h1>
      <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
        {tenants.map((t) => (
          <li key={t.tenantId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.name}</p>
              <p className="truncate text-sm text-muted">{t.primaryHost}</p>
            </div>
            <span className="tabular text-sm text-muted">{t.members} members</span>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs">{t.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
