/**
 * Better Auth, one instance per verified host (each tenant host keeps its own session cookie,
 * which also works for custom domains). Hosts reach here only after middleware resolved them.
 */
import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/db/client';
import { authAccounts, sessions, users, verifications } from '@/db/schema';

function build(origin: string) {
  return betterAuth({
    baseURL: origin,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(db(), { provider: 'pg', schema: { user: users, session: sessions, account: authAccounts, verification: verifications } }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    // Per-host login rate limits. IWD_E2E=1 (test runs only, never set on servers) turns them off.
    rateLimit: { enabled: process.env.IWD_E2E !== '1', window: 60, max: 30 },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof build>;
const cache = new Map<string, Auth>();

export function authFor(origin: string): Auth {
  let a = cache.get(origin);
  if (!a) {
    a = build(origin);
    cache.set(origin, a);
  }
  return a;
}

export function originFrom(host: string, proto?: string | null) {
  const p = proto ?? (host.endsWith('localhost') || host.startsWith('localhost') ? 'http' : 'https');
  return `${p}://${host}`;
}
