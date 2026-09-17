-- ============================================
-- MIGRATION: API Key Management
-- ============================================
-- Enable UUID generation (if not already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. API KEYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "POS Integration", "Mobile App"
    key_hash VARCHAR(255) NOT NULL, -- store hashed key (never store plain text!)
    permission_scopes TEXT[] NOT NULL DEFAULT '{}', -- array of permission names, e.g., ['deliveries:read', 'deliveries:write']
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org_id ON api_keys (org_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys (is_active);

-- ============================================
-- 2. DEFAULT PERMISSION SCOPES FOR COMMON INTEGRATIONS
-- ============================================
-- Insert default permission sets that org admins can assign to API keys
INSERT INTO api_keys (name, permission_scopes, org_id)
SELECT 
    'POS Integration'::VARCHAR,
    ARRAY['deliveries:read', 'deliveries:write'],
    id
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM api_keys WHERE name = 'POS Integration'
);
INSERT INTO api_keys (name, permission_scopes, org_id)
SELECT 
    'Mobile App'::VARCHAR,
    ARRAY['deliveries:read'],
    id
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM api_keys WHERE name = 'Mobile App'
);
INSERT INTO api_keys (name, permission_scopes, org_id)
SELECT 
    'Admin Dashboard'::VARCHAR,
    ARRAY['organizations:read', 'organizations:write', 'entities:read', 'entities:write', 'users:read', 'users:write', 'roles:read', 'roles:write', 'deliveries:read', 'deliveries:write', 'ai-chat:read'],
    id
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM api_keys WHERE name = 'Admin Dashboard'
);

-- ============================================
-- 3. UPDATE ORGANIZATIONS TO SUPPORT API KEY MANAGEMENT
-- ============================================
-- No structural changes needed; org_id on api_keys links keys to organizations
-- Org admins can generate keys via API endpoints (implemented in controllers)

-- ============================================
-- 4. FUNCTION: Validate API Key
-- ============================================
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash VARCHAR)
RETURNS TABLE (
    key_id UUID,
    org_id UUID,
    org_name VARCHAR,
    is_active BOOLEAN,
    permission_scopes TEXT[],
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ak.id,
        ak.org_id,
        o.name AS org_name,
        ak.is_active,
        ak.permission_scopes,
        ak.created_at
    FROM api_keys ak
    JOIN organizations o ON o.id = ak.org_id
    WHERE ak.key_hash = p_key_hash 
      AND ak.is_active = TRUE 
      AND o.is_active = TRUE
      AND (ak.expires_at IS NULL OR ak.expires_at > NOW());
END;
$$ LANGUAGE sql;

-- ============================================
-- 5. FUNCTION: Revoke API Key
-- ============================================
CREATE OR REPLACE FUNCTION revoke_api_key(p_key_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT org_id INTO v_org_id FROM api_keys WHERE id = p_key_id;
    
    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    UPDATE api_keys SET is_active = FALSE, updated_at = NOW() WHERE id = p_key_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. FUNCTION: Rotate API Key (generate new key, revoke old)
-- ============================================
CREATE OR REPLACE FUNCTION rotate_api_key(p_key_id UUID)
RETURNS TABLE (
    new_key_hash VARCHAR,
    new_key_prefix VARCHAR,
    expires_at TIMESTAMP
) AS $$
DECLARE
    v_org_id UUID;
    v_key_record api_keys%ROWTYPE;
    v_new_hash VARCHAR;
BEGIN
    SELECT * INTO v_key_record FROM api_keys WHERE id = p_key_id;
    v_org_id := v_key_record.org_id;
    
    -- Revoke old key
    UPDATE api_keys SET is_active = FALSE, updated_at = NOW() WHERE id = p_key_id;
    
    -- Generate new key hash
    v_new_hash := encode(gen_random_bytes(40), 'hex');
    
    -- Insert new key
    INSERT INTO api_keys (org_id, name, key_hash, permission_scopes, is_active, created_at)
    VALUES (v_org_id, v_key_record.name, v_new_hash, v_key_record.permission_scopes, TRUE, NOW())
    RETURNING key_hash, created_at INTO v_new_hash, expires_at;
    
    -- Return the new key hash (first 8 chars as prefix for display)
    RETURN QUERY SELECT 
        v_new_hash,
        LEFT(v_new_hash, 8) AS new_key_prefix,
        expires_at;
END;
$$ LANGUAGE plpgsql;