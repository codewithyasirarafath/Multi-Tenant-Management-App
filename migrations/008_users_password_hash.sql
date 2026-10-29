-- ============================================
-- MIGRATION: Users password hash (auth prerequisite)
-- ============================================
-- src/auth/model.js reads/writes users.password_hash (bcrypt), but no
-- earlier migration created the column — registration/login would fail
-- with "column password_hash does not exist".

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
