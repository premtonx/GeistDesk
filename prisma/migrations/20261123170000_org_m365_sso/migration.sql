-- Phase 4: optional per-client Microsoft 365 SSO mapping on organizations.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS m365_tenant_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_organizations_m365_tenant
  ON organizations (m365_tenant_id)
  WHERE m365_tenant_id IS NOT NULL AND sso_enabled = TRUE;
