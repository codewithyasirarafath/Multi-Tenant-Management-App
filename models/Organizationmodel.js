import pool from "../config/db.js";

const getAllOrganizations = async () => {
  const result = await pool.query(
    "SELECT * FROM organizations ORDER BY org_code ASC",
  );
  return result.rows;
};

const getOrganizationById = async (id) => {
  const result = await pool.query("SELECT * FROM organizations WHERE id = $1", [
    id,
  ]);
  return result.rows[0];
};

const getOrganizationBySlug = async (slug) => {
  const result = await pool.query(
    "SELECT * FROM organizations WHERE slug = $1",
    [slug],
  );
  return result.rows[0];
};

const getOrganizationByCode = async (orgCode) => {
  const result = await pool.query(
    "SELECT * FROM organizations WHERE org_code = $1",
    [orgCode],
  );
  return result.rows[0];
};

const createOrganization = async (name, slug, orgCode) => {
  const result = await pool.query(
    "INSERT INTO organizations (name, slug, org_code) VALUES ($1, $2, $3) RETURNING *",
    [name, slug, orgCode],
  );
  return result.rows[0];
};

const updateOrganization = async (id, name, slug, isActive) => {
  const result = await pool.query(
    `UPDATE organizations
     SET name = $1, slug = $2, is_active = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [name, slug, isActive, id],
  );
  return result.rows[0];
};

const deleteOrganization = async (id) => {
  const result = await pool.query(
    "DELETE FROM organizations WHERE id = $1 RETURNING *",
    [id],
  );
  return result.rows[0];
};

export {
  getAllOrganizations,
  getOrganizationById,
  getOrganizationBySlug,
  getOrganizationByCode,
  createOrganization,
  updateOrganization,
  deleteOrganization,
};