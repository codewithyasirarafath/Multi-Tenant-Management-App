import pool from "../config/db.js";

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
  const result = await pool.query(
    "INSERT INTO entities (org_id, name, code, ent_code) VALUES ($1, $2, $3, $4) RETURNING *",
    [orgId, name, code, entCode],
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