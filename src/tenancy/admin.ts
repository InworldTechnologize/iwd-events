import 'server-only';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/auth/session';
import type { TenantContext } from '@/db/tenant-tx';
import { memberContext, requestTenantId } from './context';

/** For admin pages: resolved tenant + signed-in user + active membership, or out. */
export async function requireMember(): Promise<{ ctx: TenantContext; user: { id: string; name: string; email: string } }> {
  const tenantId = await requestTenantId();
  if (!tenantId) notFound();
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  const h = await headers();
  const ctx = await memberContext(tenantId, user.id, h.get('x-forwarded-for'));
  // Signed in, but not a member of this tenant: it looks like nothing is here.
  if (!ctx) notFound();
  return { ctx, user };
}
