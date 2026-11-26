import 'server-only';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { staffRole } from '@/auth/platform-users';
import { currentUser } from '@/auth/session';
import { PLATFORM_HEADER } from './headers';

/** Super-admin pages: platform host + signed-in user + platform_staff row. Anyone else: 404. */
export async function requireStaff() {
  const h = await headers();
  if (h.get(PLATFORM_HEADER) !== '1') notFound();
  const user = await currentUser();
  if (!user) redirect('/login');
  const role = await staffRole(user.id);
  if (!role) notFound();
  return { user, role };
}
