# IWD Events: build plan (draft for Sandeep's OK)

Working name **IWD Events** (one config value, `PRODUCT.name`). A product by Inworld Technologize.
Status: **plan only. No code is written until Sandeep says OK.**
Written 26 Nov 2026 from a read-only pass over the DM Events repo (`C:\Users\iamsa\dm-events-website`, last commit `1607d4a`). Nothing in that folder, its database or the live site was changed.

---

## 0. Decisions I need from you

| # | Question | My recommendation |
|---|---|---|
| D1 | Where does the new repo live? | A new empty private GitHub repo, e.g. `InworldTechnologize/iwd-events`. You create it and add it in Project settings → Resources; I push only after your OK. |
| D2 | Auth library | **Better Auth** (self-hosted, Postgres tables we own, email + phone OTP, multi-org, 2FA). Alternative: hand-rolled sessions like DM's `admin_sessions`. Supabase Auth is out (we leave Supabase). |
| D3 | Extra libraries beyond your list (each needs your yes) | **BullMQ** (queue on Redis), **Serwist** (PWA service worker), **next-intl** (EN/ML), **shadcn/ui on Radix** (the one UI library), **Recharts** lazy-loaded (charts), **@react-pdf/renderer** (same as DM), **sharp**, **zod**, **react-hook-form**, **web-push**. |
| D4 | Product domain for `<slug>.<domain>` | Needed by Phase 5. Any domain you own; wildcard DNS `*.domain` → the VPS. |
| D5 | Hosting | One 8 GB VPS (Contabo like DM, or Hetzner), Docker Compose, Caddy on-demand TLS, nightly encrypted backups to R2/Backblaze. |

---

## 1. What DM Events has today (inventory)

### 1.1 Routes (128 page/route files)

**Public site** `app/(site)`: `/` home, `/about`, `/services`, `/weddings`, `/decor`, `/catering` (with "My menu" ♡), `/birthdays`, `/corporate`, `/packages`, `/gallery`, `/reviews`, `/contact`, `/plan` (Plan-your-day form), `/privacy`, `/terms`, `/credits`, 404. Preview: `/site-preview/[[...path]]`. `/styleguide`.

**Public token pages**: `/q/[token]` quotation (+ `/pdf`), `/p/[token]` proposal with online accept (+ `/pdf`), `/d/[token]` old shared document links, `/e/[token]` client portal (+ `/pdf/[kind]/[id]`), `/b/[token]` package brochure PDF.

**Admin** `app/admin/(app)`:
- Home: `/admin` dashboard, `/accounts`, `/profit`, `/reports`, `/reports/gst`
- Sales: `/requests` (+ `new`, `[id]`), `/clients` (+ `new`, `[id]`), `/tasks` (follow-ups)
- Packages & quotes: `/packages` (+ `new`, `[id]`, `[id]/preview`, `categories`), `/quotations` (+ `new`, `[id]`), `/proposals` (+ `new`, `[id]`)
- Events: `/events` (+ `new`, `confirmed`, `[id]`, `[id]/day` run sheet, `[id]/kitchen`), `/calendar`, `/crew`, `/stock`, `/kitchen`, `/menu`
- Rentals: `/rentals` (+ `new`, `catalogue`, `[id]`, `[id]/edit`)
- Money: `/invoices` (+ `new`, `[id]`), `/payables`, `/vendors`, `/expenses`
- People: `/staff` (+ `new`, `me`, `[id]`, `[id]/edit`, `attendance`, `leave`, `payroll`, `payroll/[month]`)
- Catalog: `/services`, `/library`
- Website: `/website`, `/site` (+ `preview`, `packages`), `/content`, `/gallery`, `/reviews`, `/feedback`
- Marketing: `/posts`, `/studio`, `/brand`
- Settings & system: `/settings` (+ `data`, `notifications`, `pdf`, `rentals`, `system`, `tax`, `tracking`), `/users`, `/activity`, `/checklist` (launch checklist), `/account`, `/help`
- Auth: `/admin/login`, `/admin/login/verify`, `/admin/two-step`, `/admin/auth/callback`

**API**: `/api/calendar/[token]` (ICS feed), `/api/expenses/export`, `/api/export`, `/api/files/[bucket]/[...path]`, `/api/health`, `/api/jobs/[job]` (cron: `followups` 9:00, `works` 19:00 IST), `/api/pdf/[kind]/[id]` (quotation, invoice, receipt, proposal, credit-note, package), `/api/pdf/payslip/[id]`, `/api/pdf/rental/[id]`, `/api/pdf/sample`, `/api/plan/upload`, `/api/reports/[name]`, `/api/reports/gst`, `/api/site/preview`, `/api/t` (cookie-free web analytics), `/admin.webmanifest`.

### 1.2 Tables (75, from 29 migrations)

Grouped. **None has a tenant column today**; every one gets `tenant_id` in the new build.

- **Auth & system**: profiles, admin_sessions, login_attempts, settings (one JSON row), counters, activity_log, app_errors, job_runs, notifications, notification_reads, notification_prefs, push_subscriptions, calendar_tokens, tutorial_progress
- **Sales**: requests, request_notes, request_files, clients, feedback
- **Catalog & packages**: service_categories, services, service_costs, library_items, package_categories, packages, package_functions, package_items, package_stock
- **Quotes**: quotations, quotation_lines, quotation_costs, proposals
- **Events & ops**: events, sub_events, run_sheet_items, tasks, task_templates, crew, crew_rates, crew_assignments, event_vendors, event_photos, inventory_items, inventory_allocations
- **Menus & kitchen**: menu_categories, menu_items, menu_presets, recipes
- **Money**: invoices (kind invoice/proforma), invoice_lines, payments, credit_notes, vendors, vendor_bills, vendor_payments, expenses
- **Rentals**: rentals, rental_lines, rental_units, rental_blocks, rental_deposits, rental_photos
- **People**: staff, staff_pay, attendance, leave_requests, salary_advances, payroll_runs, payslips
- **Website & marketing**: site_pages, gallery_items, media, reviews, web_events, social_posts

### 1.3 Status fields (state machines to rebuild)

| Table | Field | Values today |
|---|---|---|
| requests | status | new → contacted → site_visit → quoted → confirmed → completed / lost |
| requests | type | plan, quick_enquiry, manual |
| quotations | status | draft, sent, accepted, declined, expired (no "viewed") |
| proposals | status | draft, sent, accepted, declined |
| events | status | booked → planning → ready → live → completed → closed / cancelled |
| invoices | kind / status | invoice, proforma / active, void (paid state is derived) |
| tasks | status | open, done, hold, cancelled |
| event_vendors | status | requested, confirmed, cancelled |
| inventory_allocations | status | reserved, out, returned |
| vendor_bills | status | open, void |
| packages | status | draft, active, archived |
| rentals | status | draft → booked → out → partly_returned → returned → closed / cancelled |
| rentals | deposit_status | none, held, refunded, adjusted |
| rental_units | status | available, out, repair, retired |
| staff | status | active, left |
| attendance | status | present, half, absent, leave, holiday |
| leave_requests | status / type | pending, approved, rejected / casual, sick, unpaid |
| payroll_runs | status | draft, approved, paid |
| payslips | status | unpaid, part, paid |
| salary_advances | status | open, closed |
| social_posts | status | draft, planned, posted |
| payments etc. | mode | cash, upi, bank_transfer, cheque |
| profiles | role | owner, manager, sales, accounts, crew_lead, staff |

Fixed lists baked into CHECK constraints that become **tenant settings**: gallery categories (Weddings, Stages, Receptions, Birthdays, Corporate), package item sections (Stage & decor, Catering & menu, Sound & light, Photography & video, Crew, Rentals, Other), expense / line categories (Production, Catering, Transportation, Other), menu category kinds.

### 1.4 PDF templates (`lib/pdf`, @react-pdf)

Quotation and Invoice/Proforma (`DocumentPdf`), Proposal with options A–D (`ProposalPdf`), Receipt (`ReceiptPdf`), Credit note (`CreditNotePdf`), Package brochure (`Brochure`), Payslip (`PayslipPdf`), Rental slip (`RentalSlipPdf`). Shared: `brand.tsx` (cover band, monogram), `design-context.tsx` + Settings → PDF design, Cinzel and other fonts.

### 1.5 Website sections (`lib/site/schema.ts`, 14 editable pages)

Home: hero, trust band, services, marquee, how we work, signature moments, catering, our work, packages, reviews, FAQ, check-my-date, CTA band. About: story, how, team. Services: list. Weddings: inspiration, moments. Decor: build-your-stage. Catering: menu, notes. Gallery: grid, inspiration. Reviews: list. Contact: details + map. Packages: list. Plan: heading + fixed steps. Footer: about. Plus components: announcement banner, sticky contact, quick enquiry form, Turnstile, UTM capture, trackers (Meta Pixel, GA4), 3D hero (three.js).

### 1.6 Other features worth keeping

Six roles with ~45 capabilities (`lib/permissions.ts`), owner TOTP two-step, ICS calendar feed, max events per day + blocked dates (clash), web push alerts, timed follow-up jobs, EN/ML tutorials (`content/tutorials`), launch checklist, Post studio with watermark/presets/captions/ZIP, kitchen sheets and recipes, crew rates and guests-per-waiter, GST report (B2B/B2C), data export, error log, sample records flag, Manglish WhatsApp templates.

### 1.7 Hard-coded DM values → tenant settings

| Where in DM | What is hard-coded | New home |
|---|---|---|
| `config/site.ts` (368 lines, imported by 37 files) | name, short and legal name, tagline, domain, phone 94970 09515, WhatsApp, email, Instagram, Facebook/YouTube, address + geo + plus code, hours, response time, owner bio, areas line, service on/off switches, proof (since 2019, 800+ families), FSSAI, Udyam | `tenant_settings.business`, `.contact`, `.website`, `.proof` |
| `lib/seed/settings.ts` | business block, WhatsApp/email templates naming "DM Events & Wedding Planners" (EN + Manglish), hashtags `#DMEvents…`, GST state Kerala/32, CGST/SGST 9/9, advance 50 %, validity 14 days, terms, quotation intro, thank-you line | `tenant_settings.templates`, `.tax`, `.defaults`, `.terms`, `.brandKit` |
| `lib/seed/build.ts`, migrations `…04_gst_invoicing`, `…22_packages_module`, `…28_rentals`, `seed.production.sql` | prefixes `DM-R-`, `DM-Q-`, `DM-P-`, `DM/` (invoice, pad 3), `DM-RC-`, `DM/PF-`, `DM/CN-`, `DM-RN-`, `DM-PKG-YYYY-` | `document_sequences` per tenant (DM's carried over exactly on import) |
| `lib/actions/plan.ts:81`, `components/plan/Success.tsx:53` | `'DM-R'` literal | removed; use the tenant's prefix |
| `lib/pdf/brand.tsx`, `lib/pdf/assets.ts` | DM monogram SVG paths, "DM EVENTS" lockup text, DM PDF colours, path to `dm-events_horizontal_gold-on-black.png`, DM cover photos | tenant logo, seal, PDF theme, cover images in object storage |
| `public/logo/*` (37 files), favicons, WhatsApp DP | DM logos | tenant brand assets; product logo for the admin |
| `scripts/check-content.ts` | allowed phone `9497009515` | dropped (tenant data is not in code) |
| `supabase/seed*.sql`, `setup-production.sql` | DM settings JSON | new repo seeds only demo tenants |
| `content/tutorials/tutorials.json` | DM wording in EN/ML | product-neutral tutorials using the tenant's vocabulary |
| README / demo users | `owner@dm-events.local` | demo tenants' own users |

---

## 2. Stack (exact choices)

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 15.5 App Router, React 19, TypeScript strict**, Node 22 | Same as DM; Node-runtime middleware lets the host → tenant lookup use Redis |
| DB | **PostgreSQL 17**, RLS with `FORCE ROW LEVEL SECURITY` | Your rule |
| ORM | **Drizzle ORM + drizzle-kit migrations** | SQL-first, so RLS policies, `SET LOCAL`, `FOR UPDATE` and partial indexes are written plainly; small runtime (cheaper than Prisma's engine on one VPS); migrations reviewed as SQL and kept additive |
| Pooling | `postgres` (porsager) driver, optional PgBouncer in transaction mode | `set_config(…, true)` is transaction-scoped, so it is safe with pooling |
| Cache + queue | **Redis 7 + BullMQ** | Per-tenant rate limits and job concurrency groups |
| Files | **S3 API**: MinIO in dev and tests, Cloudflare R2 (no egress fees) in production | Your rule |
| UI | **Tailwind CSS 4 + shadcn/ui (Radix)**, tokens from §3A as CSS variables (OKLCH) | One component library we own in-repo |
| Icons / motion | **lucide-react**, **motion** (only animation library), View Transitions API | Your rule |
| Fonts | Bricolage Grotesque, Figtree, Anek Malayalam via `next/font` (self-hosted) | §3A |
| Forms / validation | react-hook-form + zod (zod schemas also generate the OpenAPI / JSON Schema tool catalogue) | One schema per command |
| Auth | **Better Auth** (pending D2): email + phone OTP, sessions list, TOTP for owners | Owns its tables in our DB |
| i18n | **next-intl**, EN + ML, tenant vocabulary overrides layered on top | |
| PWA / push | **Serwist** service worker, **web-push** (VAPID) | Offline shell + queued safe actions |
| PDF | **@react-pdf/renderer** in the worker | Proven in DM |
| Images | **sharp** in the worker (WebP/AVIF, phone sizes) | |
| Charts | **Recharts**, lazy-loaded | |
| Payments | Razorpay (our subscriptions; tenants' own accounts for payment links) | |
| Web server / TLS | **Caddy** with on-demand TLS, `ask` endpoint checks `tenant_domains.verified` | Custom domains without Cloudflare cost |
| Tests | **Vitest** (unit + integration against a real Postgres in Docker), **Playwright** + axe (screens at 360/390/768/1024/1366), **k6** load test (Phase 8) | |
| CI | GitHub Actions: typecheck, lint, unit, isolation suite, build with JS budget, Playwright smoke | Isolation suite blocks merge |
| Run | Docker Compose: `web`, `worker`, `postgres`, `redis`, `caddy`, `minio` (dev only); PM2 not needed | |

---

## 3. Tenancy model

- **Shared DB, shared tables.** Every business table: `tenant_id uuid not null references tenants`, first column of every index and unique key (e.g. `unique (tenant_id, number)`).
- **Two DB roles.** `app_rw` (no BYPASSRLS, not table owner) for all app traffic; `migrator` owns tables. Super-admin cross-tenant reads go through a separate `platform` role and code path, and every use is audited.
- **Policies**: `using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)` with the same `with check`. No setting → `NULL` → zero rows. A CI check fails if any table with `tenant_id` lacks RLS + FORCE + both policies.
- **One door to the DB**: `withTenant(ctx, fn)` opens a transaction, runs `select set_config('app.tenant_id', $1, true)` (plus `app.user_id`, `app.branch_id`), then `fn(tx)`. The raw pool is not exported; a lint rule forbids importing it outside `db/`.
- **Request flow**: middleware reads `Host` → Redis `host:<host>` → `{tenantId, status}` (fallback: `tenant_domains` lookup, cached 5 min, busted on change). Unknown host → marketing site. Admin routes then check the session's membership for that tenant; no membership → 404, not 403. Suspended tenant → read-only banner.
- **Users across tenants**: `users` is global; `memberships (tenant_id, user_id, role_id, branch_ids, status)`. A tenant switcher lists memberships; a switch goes to the other tenant's host.
- **Roles**: built-in Owner, Manager, Sales, Accounts, Crew lead, Staff with DM's capability map; `roles` table per tenant allows custom roles on higher plans. Agents are members too (`kind = 'agent'`).
- **Public tokens** (`/q/`, `/p/`, `/e/`, `/b/`, ICS): 128-bit random, stored hashed, looked up **within the host's tenant** only. A token from tenant B on tenant A's host is a plain 404.
- **Files**: `tenants/<tenant_id>/<area>/<uuid>.<ext>` in S3; DB row in `files` with tenant_id; served only via short-lived signed URLs issued after an RLS read; quota from plan.
- **Numbering**: `document_sequences (tenant_id, branch_id, doc_type, fy, format, next_number)`, taken by `select … for update` inside the same transaction that inserts the document. Format tokens: `{prefix}{fy}{seq:4}` etc. Financial year April–March (Asia/Kolkata), with a "no FY reset" option (DM's counters do not reset).

---

## 4. Data model (new repo)

All tables below except the platform group have `tenant_id`. Money is integer paise; times `timestamptz`; dates `date` in tenant timezone.

**Platform (no tenant_id or platform-only):** `tenants` (slug, name, status, plan_id, trial_ends_at, locale, timezone, powered_by_hidden), `tenant_domains` (host, verified, tls_status, verify_token), `users`, `sessions`, `accounts`, `verifications` (auth), `plans` (limits jsonb, features jsonb, prices), `subscriptions`, `subscription_invoices`, `platform_staff`, `announcements`, `impersonations` (who, tenant, when, reason; shown to the tenant).

**Tenant core:** `memberships`, `roles`, `branches`, `tenant_settings` (tenant_id, section, data jsonb, version; sections: business, contact, branding, tax, payments, defaults, terms, templates, vocabulary, workflow, website, notifications, rentals, payroll, tracking, portal), `feature_flags` (tenant overrides on top of plan), `usage_counters` (tenant, month, metric, value), `document_sequences`, `audit_log` (actor user/agent/staff, command, entity, before/after, ip), `outbox_events` (domain events), `webhook_endpoints`, `webhook_deliveries`, `api_keys` (hashed, scopes), `integrations` (kind, encrypted credentials), `message_log` (WhatsApp/email per tenant), `job_runs`, `app_errors`, `notifications`, `notification_prefs`, `push_subscriptions`, `custom_field_defs`, `custom_field_values` (or jsonb `custom` column per entity, indexed by GIN; I recommend jsonb), `files`, `public_tokens`, `approval_requests`, `tutorial_progress`.

**Lookups that were CHECK lists in DM:** `event_types`, `gallery_categories`, `package_sections`, `expense_categories`, `units`, `tax_rates`, `lost_reasons`, `lead_sources`.

**Business tables (DM tables, tenant-scoped, mostly same shape):** enquiries (was requests), enquiry_notes, enquiry_files, clients, client_contacts, follow_ups (was tasks of kind follow-up), service_categories, services (items & services), service_costs, library_items, stage_designs, venues, offers, package_categories, packages, package_tiers, package_functions, package_items, package_stock, quotations, quotation_versions, quotation_options (DM proposal A–D), quotation_lines, quotation_costs, events, event_functions (was sub_events), run_sheet_items, tasks, task_templates, crew, crew_rates, crew_assignments, crew_checkins (geo), event_vendors, event_photos, inventory_items, inventory_allocations, rentals, rental_lines, rental_units, rental_blocks, rental_deposits, rental_photos, menu_categories, menu_items, menu_presets, recipes, invoices (kind proforma/tax_invoice), invoice_lines, payments, receipts, credit_notes, payment_links, vendors, vendor_bills, vendor_payments, expenses, staff, staff_pay, attendance, leave_requests, salary_advances, payroll_runs, payslips, feedback, reviews, social_posts, brand_kits, calendar_tokens.

**Website:** `site_templates` registry lives in code; DB has `sites` (template_id, theme overrides), `site_pages` (slug, kind, order), `site_sections` (page, type, variant, order, content jsonb validated by the template's JSON schema), `site_versions` (snapshot, published_at, by), `media`, `gallery_items`, `gallery_albums`, `blog_posts`, `web_events`, `form_submissions`.

**AI (Phase 9, tables created then):** `ai_requests` (input, output, model, cost), `ai_credits`, `agent_runs`, `agent_outcomes`, `design_fingerprints`.

---

## 5. Module map (DM → new)

| DM today | New module | Notes / improvements |
|---|---|---|
| Dashboard `/admin` | Home: **Today** + Dashboard | Today screen first on phone |
| Accounts, Profit, Reports, GST report | Home: Accounts; Money: Reports | GSTR-1 style CSV, Tally export (Phase 7) |
| Requests | Sales: **Enquiries** | server state machine; required fields per stage |
| Clients | Sales: Clients | duplicate detection, balances, custom fields |
| Tasks (follow-ups) | Sales: Follow-ups | snooze, checklists for new events |
| Packages (+categories, preview, brochure) | Packages | 4-step wizard, tiers, functions, components, margin |
| Quotations + Proposals | Quotations | one entity with versions and options; 3-step wizard; event type, date, venue required in step 1; viewed status |
| Events, day, kitchen, confirmed | Events | status flow, functions, tasks, money, vendors, crew, stock, menu, run sheet, documents |
| Calendar + ICS | Calendar | blocked dates, clash warning, phone calendar link |
| Crew | Crew | 1-tap check-in, geo stamp → attendance |
| Stock | Stock | |
| Rentals (+catalogue, settings) | Rentals | |
| Menu, Kitchen | Menus | categories, dishes, per-plate presets, recipes |
| Invoices (proforma/invoice), payments, credit notes | Money: Proforma & receipts, GST invoices | tax invoice only after Accepted + advance; ageing buckets; reminders |
| Vendors, Payables | Money: Vendors & payables | vendor portal later |
| Expenses | Money: Expenses | profit by event, monthly costs |
| Staff, attendance, leave, payroll | People | |
| Services, Library | Catalog: Items & services | plus Stage & decor designs, Venues, Offers |
| Website, Site, Content, Gallery, Reviews, Feedback | Website engine | templates, page builder, versions, domains |
| Posts, Studio, Brand | Marketing: Post studio, Brand kit | |
| Settings (data, notifications, pdf, rentals, system, tax, tracking) | Settings & System | plus numbering, vocabulary, custom fields, workflow, templates, branches |
| Users | Settings: Users & roles | custom roles on higher plans |
| Activity, error log, checklist | System | per-tenant + global error log |
| Help + tutorials | Help | EN/ML, guided tours, Ctrl/⌘K |
| Public site pages | Tenant website templates | the DM site becomes "Classic Kerala wedding"-style template content, not code |
| `/q` `/p` `/e` `/b` `/d` | Public docs + client portal | host-checked tokens |

---

## 6. Code shape (AaaS-ready from day one)

```
src/
  app/            # routes only: (marketing) (site) (admin) (portal) (platform) api/v1
  commands/       # createEnquiry, sendQuote, recordPayment, confirmEvent… (zod in/out, permission, audit, outbox)
  domain/         # state machines, pricing maths, GST, numbering: pure, unit-tested
  db/             # drizzle schema, withTenant, migrations, RLS policy SQL
  jobs/           # BullMQ workers: pdf, image, whatsapp, email, webhooks, reminders
  ui/             # design system (tokens, components, motion presets)
  website/        # templates + section components + JSON schemas
  integrations/   # razorpay, whatsapp, email, gcal, storage
  ai/             # Phase 9 provider interface
tests/isolation/  # cross-tenant suite, runs on every build
```
Pages, the public API and future agents all call `commands/*`. Every command writes `audit_log` and an `outbox_events` row in the same transaction.

---

## 7. Phases (as in your brief, with what "done" means)

| Phase | Scope | Done when |
|---|---|---|
| 1 Foundation | repo, Docker, Drizzle, roles, RLS, `withTenant`, host middleware, auth, memberships, tenant_settings, document_sequences, audit, outbox, two demo tenants | isolation suite green (read, write, guess URL/file/token), numbering-under-concurrency test green |
| 2 Core modules | enquiries, clients, follow-ups, packages, quotations, events, money, catalog, people, settings; files; PDFs; then **DM import tool** (dry run → report → your OK → import) | pricing and state-machine tests, PDF snapshot tests, import dry-run report |
| 3 Design system + phone-first | §3A tokens, themes, fonts, motion, `/design` page → **screenshots at 390 and 1366 to you, wait for OK** → rebuild screens; §3B bottom tabs, sheets, swipe, PWA, push, offline, tap budgets | Lighthouse/JS budgets, screens at 5 widths, tap budgets measured |
| 4 Customisation | branding, vocabulary, custom fields, workflow, document templates, flags, branches | settings-only changes verified by tests |
| 5 Website engine | 6 templates, sections library, builder, versions, domains + TLS, SEO, analytics | Lighthouse mobile ≥ 90 per template |
| 6 Signup & billing | marketing site, signup, wizard, sample data, plans, Razorpay subscriptions, metering, super-admin | new tenant → first quote < 30 min (timed run) |
| 7 Integrations | tenant payment links + auto receipts, WhatsApp, email, Google Calendar, GST/Tally, public API + webhooks | |
| 8 Extra apps + QA | client portal, crew app, vendor portal, Capacitor-ready, 3-tenant QA, 100-tenant load test | 100 tenants on 8 GB, admin < 3 s on 4G |
| 9 AI | provider interface, Gemini adapter, drafts only, AI website designer with fingerprints | |

After each phase: tests green, Playwright screenshots at 360/390/768/1024/1366, short report.

---

## 8. Importing DM later as one tenant

1. **Source**: a `pg_dump` file of DM's database plus a copy of its storage, made by you (or DM's own `/api/export`). The import tool never connects to DM's live database.
2. Restore that dump into a **throwaway** `dm_import` schema on the new server.
3. Mapping script (in the new repo, `tools/import-dm/`): DM table → new table, adds `tenant_id`, maps `profiles.role` → memberships, `settings` JSON → `tenant_settings` sections, `config/site.ts` facts (typed in once by hand from the repo, since they are not in the DB) → business/contact settings, `counters` → `document_sequences` with the same prefixes and next numbers (`DM-R-`, `DM-Q-`, `DM-P-`, `DM/`, `DM-RC-`, `DM/PF-`, `DM/CN-`, `DM-RN-`, `DM-PKG-YYYY-`), `site_pages` → website sections, files copied to `tenants/<dm>/…`.
4. **Dry run** writes nothing and produces a report: row counts per table, money totals (invoiced, received, outstanding), last number per series, any rows that fail validation.
5. Your OK → real import in one transaction per module; report again; totals must match the dry run exactly.
6. Old public links (`/q/`, `/p/`, `/e/`, `/d/`): tokens are imported, so links work once DM's domain points at the new server (that cut-over is a later, separate decision; DM's live site stays as is until then).

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Scope is very large (DM alone is ~1,150 files, 75 tables) | Strict phase gates; Phase 2 ports DM behaviour before adding new features |
| A query escaping RLS (owner role, raw pool, background jobs) | `FORCE RLS`, non-owner app role, single `withTenant` door, jobs carry tenant_id and use the same door, CI policy checker, isolation suite |
| Caching leaking across tenants | every Redis/Next cache key is prefixed `t:<tenant_id>:`; public pages cached per host |
| Numbering gaps/duplicates under load | row lock in the insert transaction; concurrency test with 50 parallel inserts |
| 8 GB budget | worker separate from web, queue concurrency caps per tenant, Postgres tuned for 2–3 GB, images/PDFs off the request path |
| Custom-domain TLS abuse | Caddy `ask` endpoint allows only verified hosts; rate-limited |
| WhatsApp Business API approvals per tenant are slow | templates library + fallback to wa.me click-to-send (what DM does today) |
| iPhone push only after Add to Home Screen | install guide says so |
| DPDP Act duties | export + delete-on-request built in Phase 6 |
| Next.js middleware limits | Node runtime middleware; fallback resolution in root layout |
| Design rebuild churn | `/design` page approval before any screen is rebuilt |

---

## 10. What I need before Phase 1

1. Your OK on this plan (or changes).
2. Answers to D1–D5 (at least D1 to start; D2/D3 before auth and PWA work).
3. The new empty repo added to this project (Project settings → Resources).
