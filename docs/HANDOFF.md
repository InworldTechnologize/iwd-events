# Handoff (paused 26 Nov 2026, resume 27 Nov)

## Done: Phase 1 foundation
- Next.js 15.5 + TypeScript, Drizzle on Postgres, Redis cache (in-process fallback), S3 file keys + signed URLs.
- Tables: platform (tenants, tenant_domains, plans, users/sessions/auth_accounts/verifications, platform_staff) and
  tenant (branches, roles, memberships, tenant_settings, feature_flags, usage_counters, subscriptions,
  document_sequences, audit_log, outbox_events, files, public_tokens) + first business tables (clients, enquiries).
- RLS: every tenant table has `tenant_id NOT NULL`, ENABLE + FORCE RLS and the `tenant_isolation` policy on
  `app.tenant_id`. The app connects as `iwd_app` (no BYPASSRLS, owns nothing). Host lookup, switcher and signup go
  through SECURITY DEFINER functions (`resolve_host`, `user_memberships`, `create_tenant`).
- `withTenant()` is the one door (src/db/tenant-tx.ts). Lint forbids importing the raw pool elsewhere.
- Middleware (Node runtime): host → tenant (Redis-cached); root domain → /marketing, tenant host → /site and /admin,
  unknown host → 404 page. Incoming tenant headers are stripped. Custom domains and subdomains of a tenant's own
  domain resolve via `tenant_domains` (Caddy on-demand TLS asks /api/tls-check).
- Commands layer (src/commands/core.ts): zod input, capability check, audit_log + outbox in the same transaction.
  First commands: createClient, createEnquiry (numbered), changeEnquiryStatus (server state machine).
- Numbering: document_sequences row lock, per tenant × branch × type × FY, any prefix/format (DM's carry over).
- Login: Better Auth (email + password), one instance per verified host; membership required per tenant.
- Two demo tenants (kayal, spice-route) with sample clients and enquiries.
- Tests: 33 unit/isolation tests + 5 browser tests green; screenshots in screenshots/phase-1.

## Next (tomorrow)
1. Sandeep reviews and OKs the Phase 1 draft PR, then merge to main.
2. Start the parallel module threads from main (rules below).
3. Still open in Phase 1: phone OTP + owner TOTP (Better Auth plugins), tenant switcher hand-off between hosts
   (today the user signs in again on the other host), super-admin login.

## Rules for parallel module threads
- Own your area: `src/db/schema/<module>.ts`, `src/commands/<module>.ts`, `src/domain/<module>/`,
  `src/app/admin/(app)/<module>/`, `tests/unit/<module>*.test.ts`.
- Migrations: add `migrations/YYYYMMDDHH_<module>.sql` (never edit an applied file). Draft DDL with
  `npx drizzle-kit generate` (writes to tmp/ddl), copy it in, and end with `select enable_tenant_rls('<table>');`
  for every new table. `npm test` fails if a tenant table lacks RLS or an index does not lead with tenant_id.
- Every business table: `tenant_id` NOT NULL first column of every index; money in paise (integer).
- All writes go through commands (`defineCommand` + `execute`), never from pages directly.
- Shared files are append-only: `src/db/schema/index.ts` (one export line), `src/domain/settings.ts` (new sections).
- No business data in code: names, phones, GST, prefixes, templates are tenant settings.
- Never touch the DM Events repo, database or live site.
