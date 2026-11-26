/** Global identity lookups (users and platform_staff have no tenant). */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { platformStaff, users } from '@/db/schema';

export async function isTwoFactorEnabled(userId: string) {
  const [u] = await db().select({ on: users.twoFactorEnabled }).from(users).where(eq(users.id, userId));
  return Boolean(u?.on);
}

export async function staffRole(userId: string) {
  const [s] = await db().select({ role: platformStaff.role }).from(platformStaff).where(eq(platformStaff.userId, userId));
  return s?.role ?? null;
}
