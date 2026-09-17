import pool from "../config/db.js";

const getMembershipsForUser = async (userId) => {
  const result = await pool.query(
    `SELECT 
        um.id AS membership_id,
        um.org_id,
        um.ent_id,
        um.role_id,
        um.is_active,
        um.created_at,
        o.org_code,
        o.name AS org_name,
        o.slug AS org_slug,
        e.ent_code,
        e.name AS entity_name,
        e.code AS entity_code,
        r.name AS role_name,
        r.description AS role_description
     FROM user_memberships um
     JOIN organizations o ON o.id = um.org_id
     LEFT JOIN entities e ON e.id = um.ent_id
     JOIN roles r ON r.id = um.role_id
     WHERE um.user_id = $1 AND um.is_active = TRUE
     ORDER BY o.org_code, e.ent_code`,
    [userId],
  );
  return result.rows;
};

const getMembershipById = async (membershipId, userId) => {
  const result = await pool.query(
    `SELECT 
        um.id AS membership_id,
        um.org_id,
        um.ent_id,
        um.role_id,
        um.is_active,
        o.org_code,
        e.ent_code,
        r.name AS role_name
     FROM user_memberships um
     JOIN organizations o ON o.id = um.org_id
     LEFT JOIN entities e ON e.id = um.ent_id
     JOIN roles r ON r.id = um.role_id
     WHERE um.id = $1 AND um.user_id = $2`,
    [membershipId, userId],
  );
  return result.rows[0];
};

const assignMembership = async (userId, orgId, roleId, entId) => {
  const result = await pool.query(
    `INSERT INTO user_memberships (user_id, org_id, role_id, ent_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, orgId, roleId, entId || null],
  );
  return result.rows[0];
};

const updateMembership = async (membershipId, userId, roleId, entId, isActive) => {
  const result = await pool.query(
    `UPDATE user_memberships
     SET role_id = $1, ent_id = $2, is_active = $3, updated_at = NOW()
     WHERE id = $4 AND user_id = $5 RETURNING *`,
    [roleId, entId || null, isActive, membershipId, userId],
  );
  return result.rows[0];
};

const removeMembership = async (membershipId, userId) => {
  const result = await pool.query(
    "DELETE FROM user_memberships WHERE id = $1 AND user_id = $2 RETURNING *",
    [membershipId, userId],
  );
  return result.rows[0];
};

const getMembershipCodes = async (userId) => {
  const result = await pool.query(
    `SELECT (o.org_code * 1000 + COALESCE(e.ent_code, 0)) AS membership_code
     FROM user_memberships um
     JOIN organizations o ON o.id = um.org_id
     LEFT JOIN entities e ON e.id = um.ent_id
     WHERE um.user_id = $1 AND um.is_active = TRUE AND o.is_active = TRUE
     ORDER BY o.org_code, e.ent_code`,
    [userId],
  );
  return result.rows.map(r => r.membership_code);
};

const getUserByEmailWithMemberships = async (email) => {
  const result = await pool.query(
    `SELECT u.*, 
        json_agg(
          json_build_object(
            'membership_id', um.id,
            'org_id', um.org_id,
            'org_code', o.org_code,
            'org_name', o.name,
            'org_slug', o.slug,
            'ent_id', um.ent_id,
            'ent_code', e.ent_code,
            'entity_name', e.name,
            'entity_code', e.code,
            'role_id', um.role_id,
            'role_name', r.name,
            'role_description', r.description,
            'is_active', um.is_active
          ) ORDER BY o.org_code, e.ent_code
        ) FILTER (WHERE um.id IS NOT NULL) AS memberships
     FROM users u
     LEFT JOIN user_memberships um ON um.user_id = u.id AND um.is_active = TRUE
     LEFT JOIN organizations o ON o.id = um.org_id AND o.is_active = TRUE
     LEFT JOIN entities e ON e.id = um.ent_id
     LEFT JOIN roles r ON r.id = um.role_id
     WHERE u.email = $1
     GROUP BY u.id`,
    [email],
  );
  return result.rows[0];
};

export {
  getMembershipsForUser,
  getMembershipById,
  assignMembership,
  updateMembership,
  removeMembership,
  getMembershipCodes,
  getUserByEmailWithMemberships,
};