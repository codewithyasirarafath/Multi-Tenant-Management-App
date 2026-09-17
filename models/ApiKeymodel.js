import crypto from "crypto";
import pool from "../config/db.js";

const generateApiKey = async (orgId, name, permissionScopes) => {
  const keyHash = encode(crypto.randomBytes(40), 'hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const result = await pool.query(
    `INSERT INTO api_keys (org_id, name, key_hash, permission_scopes, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
     RETURNING id, key_hash, created_at`,
    [orgId, name, keyHash, permissionScopes || []]
  );

  return {
    keyHash,
    keyPrefix: keyHash.substring(0, 8),
    name,
    permissionScopes: permissionScopes || [],
    expiresAt,
    createdAt: result.rows[0].created_at,
  };
};

const listApiKeys = async (orgId) => {
  const result = await pool.query(
    `SELECT ak.id, ak.name, ak.key_hash, ak.permission_scopes, ak.is_active, ak.created_at, o.name AS org_name
     FROM api_keys ak
     JOIN organizations o ON o.id = ak.org_id
     WHERE ak.org_id = $1 AND ak.is_active = TRUE AND o.is_active = TRUE
     ORDER BY ak.created_at DESC`,
    [orgId]
  );
  return result.rows.map(k => ({
    id: k.id,
    name: k.name,
    keyHash: k.key_hash,
    permissionScopes: k.permission_scopes,
    isActive: k.is_active,
    createdAt: k.created_at,
    orgName: k.org_name,
  }));
};

const getApiKey = async (keyId, orgId) => {
  const result = await pool.query(
    `SELECT ak.id, ak.org_id, ak.name, ak.key_hash, ak.permission_scopes, ak.is_active, ak.created_at, o.name AS org_name
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
  // Hash the incoming key for comparison
  const keyHash = encode(crypto.createHash('sha256').update(key).digest('hex'), 'hex');
  const result = await pool.query(
    `SELECT ak.id, ak.org_id, ak.permission_scopes, ak.is_active, o.is_active AS org_active
     FROM api_keys ak
     JOIN organizations o ON o.id = ak.org_id
     WHERE ak.key_hash = $1 AND o.is_active = TRUE`,
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