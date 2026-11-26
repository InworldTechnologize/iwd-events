/**
 * Tenant-scoped tables. Every table here has tenant_id NOT NULL, indexes that lead with
 * tenant_id, and an RLS policy (drizzle/0001_rls.sql). tests/isolation/rls-coverage.test.ts
 * fails the build if a table with tenant_id lacks FORCE RLS and its policy.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants, users } from './platform';

const tenantId = () => uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const branches = pgTable(
  'branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('branches_tenant_code_key').on(t.tenantId, t.code)],
);

/** Built-in roles are copied into each tenant; custom roles (higher plans) are added here too. */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    builtin: boolean('builtin').notNull().default(false),
    capabilities: text('capabilities').array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('roles_tenant_key_key').on(t.tenantId, t.key)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    roleKey: text('role_key').notNull(),
    /** Agents are members too (AaaS): own role, scopes, on/off switch. */
    kind: text('kind', { enum: ['human', 'agent'] }).notNull().default('human'),
    status: text('status', { enum: ['active', 'invited', 'disabled'] }).notNull().default('active'),
    branchIds: uuid('branch_ids').array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('memberships_tenant_user_key').on(t.tenantId, t.userId),
    index('memberships_user_idx').on(t.userId),
    check('memberships_status_check', sql`${t.status} in ('active', 'invited', 'disabled')`),
  ],
);

/** Typed JSON per section (business, contact, branding, tax, payments, defaults, terms, templates, …). */
export const tenantSettings = pgTable(
  'tenant_settings',
  {
    tenantId: tenantId(),
    section: text('section').notNull(),
    data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    updatedAt: updatedAt(),
    updatedBy: text('updated_by'),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.section] })],
);

export const featureFlags = pgTable(
  'feature_flags',
  {
    tenantId: tenantId(),
    flag: text('flag').notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.flag] })],
);

export const usageCounters = pgTable(
  'usage_counters',
  {
    tenantId: tenantId(),
    month: date('month').notNull(),
    metric: text('metric').notNull(),
    value: bigint('value', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.month, t.metric] })],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    planCode: text('plan_code').notNull(),
    status: text('status', { enum: ['trialing', 'active', 'past_due', 'grace', 'read_only', 'cancelled'] }).notNull(),
    interval: text('interval', { enum: ['month', 'year'] }).notNull().default('month'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    providerRef: text('provider_ref'),
    createdAt: createdAt(),
  },
  (t) => [index('subscriptions_tenant_idx').on(t.tenantId)],
);

/**
 * One row per tenant × branch × document type × financial year. Taken with SELECT … FOR UPDATE
 * in the same transaction that inserts the document (src/domain/numbering.ts).
 * fy = '2026-27', or 'ALL' when the series never resets (DM's series).
 */
export const documentSequences = pgTable(
  'document_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid('branch_id').references(() => branches.id),
    docType: text('doc_type').notNull(),
    fy: text('fy').notNull(),
    /** e.g. "{prefix}{seq}", "{prefix}{fy}/{seq}". */
    format: text('format').notNull().default('{prefix}{seq}'),
    prefix: text('prefix').notNull().default(''),
    pad: integer('pad').notNull().default(4),
    nextNumber: bigint('next_number', { mode: 'number' }).notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    unique('document_sequences_key').on(t.tenantId, t.branchId, t.docType, t.fy).nullsNotDistinct(),
    check('document_sequences_next_check', sql`${t.nextNumber} >= 1`),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: tenantId(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    actorType: text('actor_type', { enum: ['user', 'agent', 'platform', 'system'] }).notNull(),
    actorId: text('actor_id'),
    /** Set when our staff acted through "log in as tenant". Shown to the tenant. */
    impersonatedBy: text('impersonated_by'),
    command: text('command').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
  },
  (t) => [index('audit_log_tenant_at_idx').on(t.tenantId, t.at), index('audit_log_tenant_entity_idx').on(t.tenantId, t.entityType, t.entityId)],
);

/** Domain events (quote.accepted, payment.received…), delivered to webhooks and later to agents. */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: tenantId(),
    type: text('type').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [index('outbox_events_pending_idx').on(t.tenantId, t.id).where(sql`${t.deliveredAt} is null`)],
);

/** Every stored object: key is always tenants/<tenant_id>/<area>/<uuid>.<ext>. */
export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    area: text('area').notNull(),
    key: text('key').notNull(),
    contentType: text('content_type').notNull(),
    bytes: bigint('bytes', { mode: 'number' }).notNull().default(0),
    createdBy: text('created_by'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('files_key_key').on(t.key),
    index('files_tenant_area_idx').on(t.tenantId, t.area),
    check('files_key_prefix_check', sql`${t.key} like 'tenants/' || ${t.tenantId}::text || '/%'`),
  ],
);

/** Public links (/q/, /p/, /e/, /b/, calendar feeds). Only the SHA-256 of the token is stored. */
export const publicTokens = pgTable(
  'public_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    kind: text('kind').notNull(),
    tokenHash: text('token_hash').notNull(),
    entityId: uuid('entity_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('public_tokens_hash_key').on(t.tokenHash), index('public_tokens_tenant_entity_idx').on(t.tenantId, t.kind, t.entityId)],
);

/* ---------- First business tables (Phase 1 proves isolation on these; Phase 2 adds the rest). ---------- */

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    gstin: text('gstin'),
    notes: text('notes'),
    custom: jsonb('custom').notNull().default(sql`'{}'::jsonb`),
    isSample: boolean('is_sample').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('clients_tenant_name_idx').on(t.tenantId, t.name), index('clients_tenant_phone_idx').on(t.tenantId, t.phone)],
);

export const ENQUIRY_STATUSES = ['new', 'contacted', 'site_visit', 'quoted', 'confirmed', 'completed', 'lost'] as const;

export const enquiries = pgTable(
  'enquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid('branch_id').references(() => branches.id),
    number: text('number').notNull(),
    clientId: uuid('client_id').references(() => clients.id),
    status: text('status', { enum: ENQUIRY_STATUSES }).notNull().default('new'),
    source: text('source'),
    eventType: text('event_type'),
    eventDate: date('event_date'),
    venue: text('venue'),
    guests: integer('guests'),
    notes: text('notes'),
    lostReason: text('lost_reason'),
    custom: jsonb('custom').notNull().default(sql`'{}'::jsonb`),
    isSample: boolean('is_sample').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('enquiries_tenant_number_key').on(t.tenantId, t.number),
    index('enquiries_tenant_status_idx').on(t.tenantId, t.status, t.createdAt),
    check('enquiries_status_check', sql`${t.status} in ('new', 'contacted', 'site_visit', 'quoted', 'confirmed', 'completed', 'lost')`),
  ],
);
