-- ============================================
-- MIGRATION: Customers Module
-- ============================================

-- Enable UUID generation (if not already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(254) UNIQUE,
    mobile VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_org_id ON customers (org_id);
CREATE INDEX idx_customers_ent_id ON customers (ent_id);
CREATE INDEX idx_customers_email ON customers (email);
CREATE INDEX idx_customers_is_active ON customers (is_active);

-- ============================================
-- 2. DEFAULT PERMISSIONS FOR CUSTOMERS
-- ============================================
INSERT INTO permissions (name, description, resource, action) VALUES
    ('customers:read', 'View customers', 'customers', 'read'),
    ('customers:write', 'Create/update customers', 'customers', 'write'),
    ('customers:delete', 'Delete customers', 'customers', 'delete')
ON CONFLICT (name) DO NOTHING;

-- Assign customer permissions to system default roles
-- org_admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'org_admin'
  AND p.name IN ('customers:read', 'customers:write', 'customers:delete')
ON CONFLICT DO NOTHING;

-- ent_manager gets customers read + write
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'ent_manager'
  AND p.name IN ('customers:read', 'customers:write')
ON CONFLICT DO NOTHING;

-- staff gets customers read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'staff'
  AND p.name IN ('customers:read')
ON CONFLICT DO NOTHING;

-- delivery_agent gets no customers permissions by default
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'delivery_agent'
  AND p.name IN ('customers:read')
ON CONFLICT DO NOTHING;