/**
 * Better Auth, one instance per verified host (each tenant host keeps its own session cookie,
 * which also works for custom domains). Hosts reach here only after middleware resolved them.
 */
import 'server-only';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { phoneNumber, twoFactor } from 'better-auth/plugins';
import { PRODUCT } from '@/config/product';
import { isE164, sendLoginCode } from '@/integrations/sms';
import { db } from '@/db/client';
import { authAccounts, sessions, twoFactors, users, verifications } from '@/db/schema';

function build(origin: string) {
  return betterAuth({
    baseURL: origin,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(db(), { provider: 'pg', schema: { user: users, session: sessions, account: authAccounts, verification: verifications, twoFactor: twoFactors } }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    hooks: {
      // Phone OTP must not skip two-step login: users with an authenticator app sign in with
      // email + password + code instead.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/phone-number/verify') return;
        const n = (ctx.body as { phoneNumber?: string } | undefined)?.phoneNumber;
        if (!n) return;
        const [u] = await db().select({ twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.phoneNumber, n));
        if (u?.twoFactorEnabled) throw new APIError('FORBIDDEN', { message: 'Two-step login is on for this account. Sign in with email, password and your authenticator code.' });
      }),
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    // Per-host login rate limits. IWD_E2E=1 (test runs only, never set on servers) turns them off.
    rateLimit: { enabled: process.env.IWD_E2E !== '1', window: 60, max: 30 },
    plugins: [
      // Two-step login with an authenticator app (owners and our staff are asked to turn it on).
      twoFactor({ issuer: PRODUCT.name }),
      // Phone OTP login for existing users (no sign-up by phone here; signup comes in Phase 6).
      phoneNumber({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        phoneNumberValidator: (n) => isE164(n),
        sendOTP: async ({ phoneNumber: n, code }) => sendLoginCode(n, code),
      }),
      nextCookies(),
    ],
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
