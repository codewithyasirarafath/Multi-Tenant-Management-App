import pool from "../shared/config/db.js";

const getAllEntities = async (orgId, { limit = 50, offset = 0 } = {}) => {
  const result = await pool.query(
    `SELECT * FROM entities 
     WHERE org_id = $1 
     ORDER BY ent_code ASC 
     LIMIT $2 OFFSET $3`,
    [orgId, limit, offset],
  );
  return result.rows;
};

const getEntityById = async (id, orgId) => {
  const result = await pool.query(
    "SELECT * FROM entities WHERE id = $1 AND org_id = $2",
    [id, orgId],
  );
  return result.rows[0];
};

const getEntityByCode = async (orgId, entCode) => {
  const result = await pool.query(
    "SELECT * FROM entities WHERE org_id = $1 AND ent_code = $2",
    [orgId, entCode],
  );
  return result.rows[0];
};

const createEntity = async (orgId, name, code, entCode) => {
  // ent_code is NOT NULL: auto-assign from the shared sequence when the
  // caller doesn't provide one (001_auth_refactor created ent_code_seq).
  const result = await pool.query(
    "INSERT INTO entities (org_id, name, code, ent_code) VALUES ($1, $2, $3, COALESCE($4, nextval('ent_code_seq'))) RETURNING *",
    [orgId, name, code, entCode || null],
  );
  return result.rows[0];
};

const updateEntity = async (id, orgId, name, code, isActive) => {
  const result = await pool.query(
    `UPDATE entities
     SET name = $1, code = $2, is_active = $3, updated_at = NOW()
     WHERE id = $4 AND org_id = $5 RETURNING *`,
    [name, code, isActive, id, orgId],
  );
  return result.rows[0];
};

const deleteEntity = async (id, orgId) => {
  const result = await pool.query(
    "DELETE FROM entities WHERE id = $1 AND org_id = $2 RETURNING *",
    [id, orgId],
  );
  return result.rows[0];
};

export {
  getAllEntities,
  getEntityById,
  getEntityByCode,
  createEntity,
  updateEntity,
  deleteEntity,
};