import crypto from "crypto";
import pool from "../shared/config/db.js";

const generateApiKey = async (orgId, name, permissionScopes) => {
  // The plain key is returned exactly once (to be shown to the caller);
  // only its SHA-256 hash is persisted, so a database leak cannot expose
  // usable credentials. validateApiKey() hashes incoming keys for comparison.
  const key = `ak_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const result = await pool.query(
    `INSERT INTO api_keys (org_id, name, key_hash, permission_scopes, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
     RETURNING id, created_at`,
    [orgId, name, keyHash, permissionScopes || []]
  );

  return {
    key,
    keyPrefix: key.substring(0, 11),
    name,
    permissionScopes: permissionScopes || [],
    expiresAt,
    createdAt: result.rows[0].created_at,
  };
};

const listApiKeys = async (orgId) => {
  // NOTE: key_hash is deliberately NOT selected — hashes must never leave
  // the server (generate-once design; validateApiKey compares server-side).
  const result = await pool.query(
    `SELECT ak.id, ak.name, ak.permission_scopes, ak.is_active, ak.created_at, o.name AS org_name
     FROM api_keys ak
     JOIN organizations o ON o.id = ak.org_id
     WHERE ak.org_id = $1 AND ak.is_active = TRUE AND o.is_active = TRUE
     ORDER BY ak.created_at DESC`,
    [orgId]
  );
  return result.rows.map(k => ({
    id: k.id,
    name: k.name,
    permissionScopes: k.permission_scopes,
    isActive: k.is_active,
    createdAt: k.created_at,
    orgName: k.org_name,
  }));
};

const getApiKey = async (keyId, orgId) => {
  const result = await pool.query(
    `SELECT ak.id, ak.org_id, ak.name, ak.permission_scopes, ak.is_active, ak.created_at, o.name AS org_name
     FROM api_keys ak
     JOIN organizations o ON o.id = ak.org_id
     WHERE ak.id = $1 AND ak.org_id = $2 AND ak.is_active = TRUE AND o.is_active = TRUE`,
    [keyId, orgId]
  );
  return result.rows[0];
};

const revokeApiKey = async (keyId, orgId) => {
  const result = await pool.query(
    `UPDATE api_keys SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND org_id = $2 RETURNING id`,
    [keyId, orgId]
  );
  return result.rows.length > 0;
};

const validateApiKey = async (key) => {
  // Hash the incoming key for comparison (same scheme as generateApiKey).
  // Revoked (is_active = FALSE) or expired keys must not authenticate.
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const result = await pool.query(
    `SELECT ak.id, ak.org_id, ak.permission_scopes, ak.is_active
     FROM api_keys ak
     JOIN organizations o ON o.id = ak.org_id
     WHERE ak.key_hash = $1 AND ak.is_active = TRUE
       AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
       AND o.is_active = TRUE`,
    [keyHash]
  );
  return result.rows;
};

export {
  generateApiKey,
  listApiKeys,
  getApiKey,
  revokeApiKey,
  validateApiKey,
};