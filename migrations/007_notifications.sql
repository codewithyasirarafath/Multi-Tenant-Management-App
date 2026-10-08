-- ============================================
-- MIGRATION: Notifications & Alerts Module
-- ============================================

-- Enable UUID generation (if not already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'status_update', 'low_stock', 'new_delivery', 'invoice_due', 'new_customer'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID, -- ID of related record (delivery_id, invoice_id, product_id, etc.)
    related_type VARCHAR(50), -- 'delivery', 'invoice', 'product', 'customer'
    read BOOLEAN DEFAULT false,
    action_url VARCHAR(500), -- frontend route for navigating on click
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_org_id ON notifications (org_id);
CREATE INDEX idx_notifications_read ON notifications (read);
CREATE INDEX idx_notifications_type ON notifications (type);
CREATE INDEX idx_notifications_created ON notifications (created_at DESC);

-- ============================================
-- 2. ALERTS TABLE (org/entity-level alerts)
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'low_stock', 'overdue_invoice', 'high_value_delivery'
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    related_id UUID, -- ID of related record
    related_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_alerts_org_id ON alerts (org_id);
CREATE INDEX idx_alerts_ent_id ON alerts (ent_id);
CREATE INDEX idx_alerts_type ON alerts (type);
CREATE INDEX idx_alerts_resolved ON alerts (is_resolved);
CREATE INDEX idx_alerts_severity ON alerts (severity);

-- ============================================
-- 3. DEFAULT PERMISSIONS FOR NOTIFICATIONS
-- ============================================
INSERT INTO permissions (name, description, resource, action) VALUES
    ('notifications:read', 'View notifications and alerts', 'notifications', 'read'),
    ('notifications:mark_read', 'Mark notifications as read', 'notifications', 'mark_read'),
    ('notifications:create', 'Create notifications/alerts', 'notifications', 'create')
ON CONFLICT (name) DO NOTHING;

-- Assign notification permissions to system default roles
-- org_admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'org_admin'
  AND p.name IN ('notifications:read', 'notifications:mark_read', 'notifications:create')
ON CONFLICT DO NOTHING;

-- ent_manager gets notifications read + mark
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'ent_manager'
  AND p.name IN ('notifications:read', 'notifications:mark_read')
ON CONFLICT DO NOTHING;

-- staff gets notifications read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'staff'
  AND p.name IN ('notifications:read')
ON CONFLICT DO NOTHING;

-- delivery_agent gets no notifications permissions by default
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'delivery_agent'
  AND p.name IN ('notifications:read')
ON CONFLICT DO NOTHING;