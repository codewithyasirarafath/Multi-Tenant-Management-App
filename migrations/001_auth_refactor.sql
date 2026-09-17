-- ============================================
-- MIGRATION: Auth Refactor - Global Users + Memberships + 6-Digit Codes
-- ============================================

-- Enable UUID generation (if not already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. ORGANIZATIONS: Add 3-digit org_code
-- ============================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_code INTEGER;

-- Populate org_code for existing orgs (assign sequential 3-digit codes)
-- In production, you'd assign these manually or via a sequence
UPDATE organizations 
SET org_code = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM organizations
) sub
WHERE organizations.id = sub.id AND organizations.org_code IS NULL;

-- Make it unique and not null (after populating)
ALTER TABLE organizations ALTER COLUMN org_code SET NOT NULL;
ALTER TABLE organizations ADD CONSTRAINT organizations_org_code_unique UNIQUE (org_code);
-- Ensure 3-digit range (100-999)
ALTER TABLE organizations ADD CONSTRAINT organizations_org_code_range CHECK (org_code BETWEEN 100 AND 999);

-- ============================================
-- 2. ENTITIES: Add 3-digit ent_code (unique per org)
-- ============================================
ALTER TABLE entities ADD COLUMN IF NOT EXISTS ent_code INTEGER;

-- Populate ent_code for existing entities (sequential per org)
UPDATE entities 
SET ent_code = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY created_at) as rn
  FROM entities
) sub
WHERE entities.id = sub.id AND entities.ent_code IS NULL;

ALTER TABLE entities ALTER COLUMN ent_code SET NOT NULL;
ALTER TABLE entities ADD CONSTRAINT entities_ent_code_unique_per_org UNIQUE (org_id, ent_code);
ALTER TABLE entities ADD CONSTRAINT entities_ent_code_range CHECK (ent_code BETWEEN 1 AND 999);

-- ============================================
-- 3. USERS: Remove org_id, ent_id; Make email globally unique
-- ============================================
-- Drop foreign keys first
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_id_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_ent_id_fkey;

-- Drop old unique constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_id_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_id_mobile_key;

-- Drop columns
ALTER TABLE users DROP COLUMN IF EXISTS org_id;
ALTER TABLE users DROP COLUMN IF EXISTS ent_id;

-- Add global unique constraints
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_mobile_unique UNIQUE (mobile);

-- ============================================
-- 4. USER_MEMBERSHIPS: New table linking users to orgs + optional entities + roles
-- ============================================
CREATE TABLE IF NOT EXISTS user_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities(id) ON DELETE CASCADE, -- NULL = org-wide membership
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, org_id, ent_id, role_id)
);

-- Indexes for common lookups
CREATE INDEX idx_user_memberships_user_id ON user_memberships (user_id);
CREATE INDEX idx_user_memberships_org_id ON user_memberships (org_id);
CREATE INDEX idx_user_memberships_ent_id ON user_memberships (ent_id);
CREATE INDEX idx_user_memberships_role_id ON user_memberships (role_id);

-- ============================================
-- 5. ROLES: Fix duplicate table definition (keep the second one with org_id)
-- ============================================
-- The multitenant-schema.sql has roles defined twice. 
-- We keep the version with org_id (system defaults have org_id NULL)
-- No migration needed if already correct, but ensure constraint exists:
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_org_id_name_key;
ALTER TABLE roles ADD CONSTRAINT roles_org_id_name_key UNIQUE (org_id, name);

-- ============================================
-- 6. DELIVERIES: Keep org_id, ent_id, created_by (references users.id)
-- ============================================
-- No changes needed - deliveries stay scoped to org (+ optional entity)
-- created_by references users.id (global user)

-- ============================================
-- 7. USER_ROLES: Deprecated - replace with role_id on user_memberships
-- ============================================
-- Option A: Drop user_roles table (if no data to preserve)
-- DROP TABLE IF EXISTS user_roles CASCADE;

-- Option B: Keep for migration period, but new code uses user_memberships
-- We'll keep it for now but mark deprecated

-- ============================================
-- 8. HELPER VIEW: User membership codes (6-digit: org_code * 1000 + ent_code)
-- ============================================
CREATE OR REPLACE VIEW user_membership_codes AS
SELECT 
    um.user_id,
    u.email,
    o.org_code,
    e.ent_code,
    (o.org_code * 1000 + COALESCE(e.ent_code, 0)) AS membership_code,
    o.name AS org_name,
    e.name AS entity_name,
    r.name AS role_name,
    um.is_active
FROM user_memberships um
JOIN users u ON u.id = um.user_id
JOIN organizations o ON o.id = um.org_id
LEFT JOIN entities e ON e.id = um.ent_id
JOIN roles r ON r.id = um.role_id
WHERE um.is_active = TRUE AND u.is_active = TRUE AND o.is_active = TRUE;

-- ============================================
-- 9. FUNCTION: Get membership codes for a user by email
-- ============================================
CREATE OR REPLACE FUNCTION get_user_membership_codes(p_email VARCHAR)
RETURNS TABLE (
    membership_code INTEGER,
    org_code INTEGER,
    ent_code INTEGER,
    org_name VARCHAR,
    entity_name VARCHAR,
    role_name VARCHAR
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (o.org_code * 1000 + COALESCE(e.ent_code, 0))::INTEGER,
        o.org_code,
        e.ent_code,
        o.name,
        e.name,
        r.name
    FROM user_memberships um
    JOIN users u ON u.id = um.user_id
    JOIN organizations o ON o.id = um.org_id
    LEFT JOIN entities e ON e.id = um.ent_id
    JOIN roles r ON r.id = um.role_id
    WHERE u.email = p_email 
      AND um.is_active = TRUE 
      AND u.is_active = TRUE 
      AND o.is_active = TRUE
    ORDER BY o.org_code, e.ent_code;
END;
$$;

-- ============================================
-- 10. SEED: Default org_codes and ent_codes for new records
-- ============================================
-- Note: In production, assign org_code/ent_code manually or via admin UI
-- This sequence helper can be used for auto-assignment
CREATE SEQUENCE IF NOT EXISTS org_code_seq START 100;
CREATE SEQUENCE IF NOT EXISTS ent_code_seq START 1;