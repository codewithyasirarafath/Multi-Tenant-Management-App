import pool from "../config/db.js";

// A role is usable by an org if it's a system default (org_id IS NULL)
// OR if it was created specifically for that org.
const getAllRolesForOrg = async (orgId) => {
  const result = await pool.query(
    "SELECT * FROM roles WHERE org_id IS NULL OR org_id = $1 ORDER BY created_at ASC",
    [orgId],
  );
  return result.rows;
};

const getRoleById = async (id) => {
  const result = await pool.query("SELECT * FROM roles WHERE id = $1", [id]);
  return result.rows[0];
};

const createRole = async (orgId, name, description) => {
  const result = await pool.query(
    "INSERT INTO roles (org_id, name, description) VALUES ($1, $2, $3) RETURNING *",
    [orgId, name, description || null],
  );
  return result.rows[0];
};

export { getAllRolesForOrg, getRoleById, createRole };
