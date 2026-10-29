-- BASE SCHEMA (pre-refactor state)
-- This is the "before" state that migrations/001_auth_refactor.sql evolves
-- into the current architecture (global users + user_memberships + codes).
-- Applied automatically by scripts/migrate.js on an empty database.
--
-- NOTE: roles and user_roles are intentionally kept here in their original
-- form; 001 refactors auth on top of them. Do not modernize this file —
-- change migrations instead.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- ORGANIZATIONS (top-level tenant)
-- ============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- used in URLs / subdomains, e.g. "acme-corp"
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- ENTITIES (sub-unit within an org: branch/warehouse/department/etc.)
-- ============================================
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL, -- short internal code, unique per org
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, code)
);

-- ============================================
-- USERS (belong to an org, optionally scoped to one entity)
-- (001_auth_refactor makes users global — this is the pre-refactor shape)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities (id) ON DELETE SET NULL, -- nullable: some users are org-level (e.g. admins)
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, email), -- same email CAN exist in two different orgs, not within one org
    UNIQUE (org_id, mobile)
);

-- ============================================
-- DELIVERIES (scoped to org, optionally to a specific entity)
-- ============================================
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities (id) ON DELETE SET NULL,
    tracking_number VARCHAR(50) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    receiver_name VARCHAR(100) NOT NULL,
    destination VARCHAR(200) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_by UUID REFERENCES users (id) ON DELETE SET NULL, -- which user created this delivery
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, tracking_number) -- tracking numbers unique within an org, not globally
);

-- ============================================
-- ROLES (org can define its own roles, or use system-wide defaults)
-- ============================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations (id) ON DELETE CASCADE, -- NULL = system default role, available to every org
    name VARCHAR(50) NOT NULL, -- e.g. 'org_admin', 'ent_manager', 'staff'
    description VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);

-- Seed system-wide default roles (org_id NULL = usable by any org)
INSERT INTO roles (org_id, name, description)
VALUES
    (NULL, 'org_admin', 'Full access across the entire organization'),
    (NULL, 'ent_manager', 'Manages a single entity (branch/warehouse/department)'),
    (NULL, 'staff', 'Basic operational access, e.g. creating/updating deliveries'),
    (NULL, 'delivery_agent', 'Handles deliveries assigned to them');

-- ============================================
-- USER_ROLES (junction: which user has which role, optionally scoped to one entity)
-- (deprecated by 001_auth_refactor in favor of user_memberships; kept so the
--  refactor path exists — will be dropped in a later cleanup migration)
-- ============================================
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    ent_id UUID REFERENCES entities (id) ON DELETE CASCADE, -- NULL = role applies org-wide; set = role applies only within that entity
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role_id, ent_id)
);

-- ============================================
-- INDEXES (tenant-scoped lookups are the most common query pattern)
-- ============================================
CREATE INDEX idx_entities_org_id ON entities (org_id);

CREATE INDEX idx_users_org_id ON users (org_id);

CREATE INDEX idx_users_ent_id ON users (ent_id);

CREATE INDEX idx_deliveries_org_id ON deliveries (org_id);

CREATE INDEX idx_deliveries_ent_id ON deliveries (ent_id);

CREATE INDEX idx_deliveries_status ON deliveries (status);

CREATE INDEX idx_roles_org_id ON roles (org_id);

CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);

CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);
