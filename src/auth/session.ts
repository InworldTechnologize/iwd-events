import 'server-only';
import { headers } from 'next/headers';
import { HOST_HEADER } from '@/tenancy/headers';
import { authFor, originFrom } from './auth';

export async function currentOrigin() {
  const h = await headers();
  const host = h.get(HOST_HEADER) ?? h.get('host') ?? 'localhost';
  return originFrom(h.get('host') ?? host, h.get('x-forwarded-proto'));
}

export async function currentUser() {
  const h = await headers();
  const session = await authFor(await currentOrigin()).api.getSession({ headers: h });
  return session?.user ?? null;
}
