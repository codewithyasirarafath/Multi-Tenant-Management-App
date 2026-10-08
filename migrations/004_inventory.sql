-- ============================================
-- MIGRATION: Inventory & Products Module
-- ============================================

-- Enable UUID generation (if not already)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    description TEXT,
    unit VARCHAR(20) DEFAULT 'piece',
    cost_price NUMERIC(10,2),
    sale_price NUMERIC(10,2),
    track_inventory BOOLEAN DEFAULT true,
    min_stock_level INTEGER DEFAULT 5,
    max_stock_level INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, sku)
);

-- Indexes
CREATE INDEX idx_products_org_id ON products (org_id);
CREATE INDEX idx_products_ent_id ON products (ent_id);
CREATE INDEX idx_products_is_active ON products (is_active);

-- ============================================
-- 2. INVENTORY TABLE (stock levels per org/entity/product)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0, -- reserved for pending deliveries
    available INTEGER GENERATED ALWAYS AS (quantity - reserved) STORED,
    min_stock_level INTEGER DEFAULT 5,
    max_stock_level INTEGER DEFAULT 100,
    last_restocked TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, ent_id, product_id)
);

-- Indexes
CREATE INDEX idx_inventory_org_id ON inventory (org_id);
CREATE INDEX idx_inventory_ent_id ON inventory (ent_id);
CREATE INDEX idx_inventory_product_id ON inventory (product_id);
CREATE INDEX idx_inventory_available ON inventory (available);
CREATE INDEX idx_inventory_low_stock ON inventory (org_id) WHERE quantity <= min_stock_level;

-- ============================================
-- 3. INVENTORY MOVEMENTS (stock change history)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- 'in', 'out', 'adjustment', 'delivery'
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(50), -- 'delivery', 'purchase', 'adjustment'
    reference_id UUID, -- ID of the referencing record (e.g., delivery_id)
    notes TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_movements_product_id ON inventory_movements (product_id);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements (reference_id);
CREATE INDEX idx_inventory_movements_created ON inventory_movements (created_at DESC);

-- ============================================
-- 4. DEFAULT PERMISSIONS FOR INVENTORY
-- ============================================
INSERT INTO permissions (name, description, resource, action) VALUES
    ('inventory:read', 'View products and inventory', 'inventory', 'read'),
    ('inventory:write', 'Create/update products and inventory', 'inventory', 'write'),
    ('inventory:delete', 'Delete products', 'inventory', 'delete'),
    ('inventory:adjust', 'Adjust stock levels', 'inventory', 'adjust')
ON CONFLICT (name) DO NOTHING;

-- Assign inventory permissions to system default roles
-- org_admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'org_admin'
  AND p.name IN ('inventory:read', 'inventory:write', 'inventory:delete', 'inventory:adjust')
ON CONFLICT DO NOTHING;

-- ent_manager gets inventory read + adjust
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'ent_manager'
  AND p.name IN ('inventory:read', 'inventory:adjust')
ON CONFLICT DO NOTHING;

-- staff gets inventory read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'staff'
  AND p.name IN ('inventory:read')
ON CONFLICT DO NOTHING;

-- delivery_agent gets no inventory permissions by default
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.org_id IS NULL AND r.name = 'delivery_agent'
  AND p.name IN ('inventory:read')
ON CONFLICT DO NOTHING;