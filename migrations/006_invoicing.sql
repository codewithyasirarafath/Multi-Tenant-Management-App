-- ============================================
-- MIGRATION: Invoicing & Payments Module
-- ============================================

-- Enable UUID generation (if not already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    ent_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue, cancelled, void
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, invoice_number)
);

-- Indexes
CREATE INDEX idx_invoices_org_id ON invoices (org_id);
CREATE INDEX idx_invoices_delivery_id ON invoices (delivery_id);
CREATE INDEX idx_invoices_customer_id ON invoices (customer_id);
CREATE INDEX idx_invoices_status ON invoices (status);
CREATE INDEX idx_invoices_due_date ON invoices (due_date) WHERE status = 'pending';

-- ============================================
-- 2. PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(50), -- 'cash', 'card', 'bank_transfer', 'crypto'
    transaction_id VARCHAR(100), -- external payment gateway reference
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, refunded
    paid_at TIMESTAMPTZ,
    transaction_fee NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_invoice_id ON payments (invoice_id);
CREATE INDEX idx_payments_method ON payments (payment_method);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_created ON payments (created_at DESC);

-- ============================================
-- 3. DEFAULT PERMISSIONS FOR INVOICING
-- ============================================
INSERT INTO permissions (name, description, resource, action) VALUES
    ('invoicing:read', 'View invoices and payments', 'invoicing', 'read'),
    ('invoicing:write', 'Create/update invoices', 'invoicing', 'write'),
    ('invoicing:delete', 'Delete invoices', 'invoicing', 'delete'),
    ('invoicing:pay', 'Record/update payments', 'invoicing', 'pay')
ON CONFLICT (name) DO NOTHING;

-- Assign invoicing permissions to system default roles
-- org_admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'org_admin'
  AND p.name IN ('invoicing:read', 'invoicing:write', 'invoicing:delete', 'invoicing:pay')
ON CONFLICT DO NOTHING;

-- ent_manager gets invoicing read + write
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'ent_manager'
  AND p.name IN ('invoicing:read', 'invoicing:write')
ON CONFLICT DO NOTHING;

-- staff gets invoicing read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'staff'
  AND p.name IN ('invoicing:read')
ON CONFLICT DO NOTHING;

-- delivery_agent gets no invoicing permissions by default
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'delivery_agent'
  AND p.name IN ('invoicing:read')
ON CONFLICT DO NOTHING;