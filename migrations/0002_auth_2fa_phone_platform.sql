-- Phone OTP login, two-step (TOTP) login, and the super-admin console.
-- No real tenants exist yet; users.phone was never used, so it is replaced by phone_number.
ALTER TABLE users DROP COLUMN IF EXISTS phone;
ALTER TABLE users ADD COLUMN phone_number text UNIQUE;
ALTER TABLE users ADD COLUMN phone_number_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE two_factors (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  backup_codes text NOT NULL,
  verified boolean NOT NULL DEFAULT true,
  failed_verification_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
CREATE INDEX two_factors_user_idx ON two_factors (user_id);
CREATE INDEX two_factors_secret_idx ON two_factors (secret);

-- Super-admin console: tenant overview for our staff. Ids, names, status and counts only, never
-- business records. The app calls it only after checking platform_staff for the signed-in user.
CREATE OR REPLACE FUNCTION platform_tenant_overview()
RETURNS TABLE (tenant_id uuid, slug text, name text, status text, trial_ends_at timestamptz, created_at timestamptz, members bigint, primary_host text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.slug, t.name, t.status, t.trial_ends_at, t.created_at,
         (SELECT count(*) FROM memberships m WHERE m.tenant_id = t.id AND m.status = 'active'),
         (SELECT d.host FROM tenant_domains d WHERE d.tenant_id = t.id AND d.verified ORDER BY d.is_primary DESC, d.created_at LIMIT 1)
  FROM tenants t ORDER BY t.created_at DESC
$$;
REVOKE ALL ON FUNCTION platform_tenant_overview() FROM PUBLIC;
