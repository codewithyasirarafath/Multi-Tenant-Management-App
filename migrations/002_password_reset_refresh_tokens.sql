-- ============================================
-- MIGRATION: Password Reset + Refresh Tokens + Permissions
-- ============================================

-- Enable UUID generation (if not already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. PASSWORD RESET TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- store hashed token
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
UPDATE password_reset_tokens SET deleted_at = NOW() WHERE deleted_at IS NULL AND used_at IS NOT NULL;
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_deleted_at_check CHECK (deleted_at IS NULL OR deleted_at > created_at);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens (token_hash);

-- ============================================
-- 2. REFRESH TOKENS (for token rotation)
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- store hashed refresh token
    parent_token_hash VARCHAR(255), -- hash of the token this was rotated from
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    replaced_by_token_hash VARCHAR(255), -- hash of the new token that replaced this
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_parent ON refresh_tokens (parent_token_hash);

-- ============================================
-- 3. PERMISSIONS SYSTEM
-- ============================================
-- Permissions table - defines all possible permissions
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'organizations:read', 'deliveries:write', 'users:delete'
    description VARCHAR(255),
    resource VARCHAR(50) NOT NULL, -- e.g., 'organizations', 'entities', 'users', 'roles', 'deliveries', 'ai-chat'
    action VARCHAR(50) NOT NULL, -- e.g., 'read', 'write', 'delete', 'manage'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (resource, action)
);

-- Role permissions mapping (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- Seed default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
    ('organizations:read', 'View organizations', 'organizations', 'read'),
    ('organizations:write', 'Create/update organizations', 'organizations', 'write'),
    ('organizations:delete', 'Delete organizations', 'organizations', 'delete'),
    ('organizations:manage', 'Full organization management', 'organizations', 'manage'),
    ('entities:read', 'View entities', 'entities', 'read'),
    ('entities:write', 'Create/update entities', 'entities', 'write'),
    ('entities:delete', 'Delete entities', 'entities', 'delete'),
    ('users:read', 'View users', 'users', 'read'),
    ('users:write', 'Create/update users', 'users', 'write'),
    ('users:delete', 'Delete users', 'users', 'delete'),
    ('users:manage', 'Full user management including memberships', 'users', 'manage'),
    ('roles:read', 'View roles', 'roles', 'read'),
    ('roles:write', 'Create/update roles', 'roles', 'write'),
    ('roles:delete', 'Delete roles', 'roles', 'delete'),
    ('roles:manage', 'Full role management including permissions', 'roles', 'manage'),
    ('deliveries:read', 'View deliveries', 'deliveries', 'read'),
    ('deliveries:write', 'Create/update deliveries', 'deliveries', 'write'),
    ('deliveries:delete', 'Delete deliveries', 'deliveries', 'delete'),
    ('deliveries:manage', 'Full delivery management', 'deliveries', 'manage'),
    ('ai-chat:read', 'Use AI chat', 'ai-chat', 'read'),
    ('ai-chat:manage', 'Manage AI chat settings', 'ai-chat', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to system default roles
-- org_admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'org_admin'
ON CONFLICT DO NOTHING;

-- ent_manager gets org-level read + entity/user/delivery management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'ent_manager'
  AND p.name IN (
    'organizations:read', 'entities:read', 'entities:write',
    'users:read', 'users:write', 'roles:read',
    'deliveries:read', 'deliveries:write', 'deliveries:delete',
    'ai-chat:read'
  )
ON CONFLICT DO NOTHING;

-- staff gets read + delivery write
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'staff'
  AND p.name IN (
    'organizations:read', 'entities:read', 'users:read', 'roles:read',
    'deliveries:read', 'deliveries:write', 'ai-chat:read'
  )
ON CONFLICT DO NOTHING;

-- delivery_agent gets delivery read/write only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'delivery_agent'
  AND p.name IN ('deliveries:read', 'deliveries:write', 'ai-chat:read')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    ent_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'user.created', 'delivery.status_changed', 'role.assigned'
    resource_type VARCHAR(50) NOT NULL, -- e.g., 'user', 'delivery', 'organization', 'membership'
    resource_id UUID, -- ID of the affected resource
    old_values JSONB, -- previous state
    new_values JSONB, -- new state
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_org_id ON audit_logs (org_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);

-- ============================================
-- 5. WEBHOOK SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    secret VARCHAR(255) NOT NULL, -- used to sign webhook payloads
    events TEXT[] NOT NULL, -- e.g., ['delivery.created', 'delivery.status_changed', 'delivery.deleted']
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_subscriptions_org_id ON webhook_subscriptions (org_id);

-- ============================================
-- 6. WEBHOOK DELIVERY LOG
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
    next_retry_at TIMESTAMP,
    succeeded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries (subscription_id);
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries (next_retry_at) WHERE succeeded = FALSE;

-- ============================================
-- 7. AI CONVERSATION HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_org_id ON ai_conversations (org_id);
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations (user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB, -- can store query plan, tokens used, etc.
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conversation_id ON ai_messages (conversation_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages (created_at);