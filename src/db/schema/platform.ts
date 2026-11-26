/**
 * Platform tables: shared by every tenant, holding no tenant business data.
 * - tenants / tenant_domains are RLS-protected too; host lookup goes through resolve_host().
 * - plans is read-only to the app role.
 * - Auth tables (users, sessions, auth_accounts, verifications) are global identities used by Better Auth.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  /** { users, storageMb, branches, websitePages, customFields, … } */
  limits: jsonb('limits').notNull().default(sql`'{}'::jsonb`),
  /** { rentals: true, payroll: true, customRoles: false, … } */
  features: jsonb('features').notNull().default(sql`'{}'::jsonb`),
  priceMonthlyPaise: integer('price_monthly_paise').notNull().default(0),
  priceYearlyPaise: integer('price_yearly_paise').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
});

export const TENANT_STATUSES = ['trial', 'active', 'read_only', 'suspended', 'deleted'] as const;

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    status: text('status', { enum: TENANT_STATUSES }).notNull().default('trial'),
    planId: uuid('plan_id').references(() => plans.id),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    locale: text('locale').notNull().default('en'),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    /** Only the super-admin console can hide the "Powered by" line (special deals). */
    poweredByHidden: boolean('powered_by_hidden').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('tenants_status_check', sql`${t.status} in ('trial', 'active', 'read_only', 'suspended', 'deleted')`),
    check('tenants_slug_check', sql`${t.slug} ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'`),
  ],
);

export const tenantDomains = pgTable(
  'tenant_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    /** Lower-case host without port: "acme.iwd.inworldtechnologize.com", "events.acme.in". */
    host: text('host').notNull(),
    kind: text('kind', { enum: ['subdomain', 'custom'] }).notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    verified: boolean('verified').notNull().default(false),
    verifyToken: text('verify_token'),
    tlsStatus: text('tls_status', { enum: ['pending', 'active', 'failed'] }).notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('tenant_domains_host_key').on(t.host),
    index('tenant_domains_tenant_idx').on(t.tenantId),
    check('tenant_domains_host_check', sql`${t.host} = lower(${t.host}) and ${t.host} !~ '[:/ ]'`),
  ],
);

/* ---------- Auth (Better Auth). Global identities; a user can belong to many tenants. ---------- */

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: boolean('phone_number_verified').notNull().default(false),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('auth_accounts_user_idx').on(t.userId)],
);

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const twoFactors = pgTable(
  'two_factors',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: boolean('verified').notNull().default(true),
    failedVerificationCount: integer('failed_verification_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
  },
  (t) => [index('two_factors_user_idx').on(t.userId), index('two_factors_secret_idx').on(t.secret)],
);

/** Our own staff (super-admin console). Separate from tenant memberships. */
export const platformStaff = pgTable('platform_staff', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'support'] }).notNull().default('support'),
  createdAt: createdAt(),
});
