-- Tenant isolation: the second lock after the app's withTenant() door.
-- The app connects as the non-owner role iwd_app (created by scripts/migrate.ts), so RLS applies.
-- With no app.tenant_id set, app_tenant_id() is NULL and every policy refuses every row.

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
--> statement-breakpoint

-- enable_tenant_rls('table'): ENABLE + FORCE + the tenant policy. Every new tenant table's
-- migration calls this once (the RLS coverage test fails the build otherwise).
CREATE OR REPLACE FUNCTION enable_tenant_rls(t text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
END $$;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_domains', 'branches', 'roles', 'memberships', 'tenant_settings', 'feature_flags',
    'usage_counters', 'subscriptions', 'document_sequences', 'audit_log', 'outbox_events',
    'files', 'public_tokens', 'clients', 'enquiries'
  ] LOOP
    PERFORM enable_tenant_rls(t);
  END LOOP;
END $$;
--> statement-breakpoint

-- The tenants row itself: a request sees only its own tenant.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_self ON tenants FOR ALL USING (id = app_tenant_id()) WITH CHECK (id = app_tenant_id());
--> statement-breakpoint

-- Host → tenant, before any tenant is known. Returns only verified hosts of live tenants.
-- SECURITY DEFINER runs as the table owner; it exposes ids and status only, never business data.
CREATE OR REPLACE FUNCTION resolve_host(p_host text)
RETURNS TABLE (tenant_id uuid, slug text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.slug, t.status
  FROM tenant_domains d JOIN tenants t ON t.id = d.tenant_id
  WHERE d.host = lower(p_host) AND d.verified AND t.status <> 'deleted'
  LIMIT 1
$$;
--> statement-breakpoint

-- The tenant switcher: a user's own memberships across tenants (no other tenant data).
CREATE OR REPLACE FUNCTION user_memberships(p_user text)
RETURNS TABLE (tenant_id uuid, slug text, name text, role_key text, primary_host text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.slug, t.name, m.role_key,
         (SELECT d.host FROM tenant_domains d WHERE d.tenant_id = t.id AND d.verified ORDER BY d.is_primary DESC, d.created_at LIMIT 1)
  FROM memberships m JOIN tenants t ON t.id = m.tenant_id
  WHERE m.user_id = p_user AND m.status = 'active' AND t.status <> 'deleted'
  ORDER BY t.name
$$;
--> statement-breakpoint

-- Signup: create a tenant with its first subdomain and owner, before a tenant context exists.
CREATE OR REPLACE FUNCTION create_tenant(p_slug text, p_name text, p_host text, p_owner text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO tenants (slug, name, status, trial_ends_at) VALUES (p_slug, p_name, 'trial', now() + interval '14 days') RETURNING id INTO v_id;
  INSERT INTO tenant_domains (tenant_id, host, kind, is_primary, verified, tls_status) VALUES (v_id, lower(p_host), 'subdomain', true, true, 'active');
  INSERT INTO memberships (tenant_id, user_id, role_key) VALUES (v_id, p_owner, 'owner');
  RETURN v_id;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION resolve_host(text), user_memberships(text), create_tenant(text, text, text, text), enable_tenant_rls(text) FROM PUBLIC;
