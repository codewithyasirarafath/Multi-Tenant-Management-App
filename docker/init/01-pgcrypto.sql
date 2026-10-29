-- Runs once on first container start (empty data volume).
-- gen_random_uuid() (used by every table) requires pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
