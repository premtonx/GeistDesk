-- MSP Co-Managed Client Portal Phase 1
-- organizations (Kunden) + ticket_participants
-- User.organization_id lives on geistdesk_documents.users JSONB (optional for Hubcom staff).

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_active_name
  ON organizations (is_active, name);

CREATE INDEX IF NOT EXISTS idx_organizations_domain
  ON organizations (domain)
  WHERE domain IS NOT NULL;

CREATE TABLE IF NOT EXISTS ticket_participants (
  ticket_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  added_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_participants_user
  ON ticket_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket
  ON ticket_participants (ticket_id);
