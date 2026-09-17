import pool from "../config/db.js";

const getAllPermissions = async () => {
  const result = await pool.query(
    "SELECT * FROM permissions ORDER BY resource, action",
  );
  return result.rows;
};

const getPermissionsForRole = async (roleId) => {
  const result = await pool.query(
    `SELECT p.* FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = $1
     ORDER BY p.resource, p.action`,
    [roleId],
  );
  return result.rows;
};

const assignPermissionToRole = async (roleId, permissionId) => {
  const result = await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     VALUES ($1, $2) RETURNING *`,
    [roleId, permissionId],
  );
  return result.rows[0];
};

const removePermissionFromRole = async (roleId, permissionId) => {
  const result = await pool.query(
    `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2 RETURNING *`,
    [roleId, permissionId],
  );
  return result.rows[0];
};

const getUserPermissions = async (userId, orgId) => {
  const result = await pool.query(
    `SELECT DISTINCT p.name, p.resource, p.action
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_memberships um ON um.role_id = rp.role_id
     WHERE um.user_id = $1 AND um.org_id = $2 AND um.is_active = TRUE
     ORDER BY p.resource, p.action`,
    [userId, orgId],
  );
  return result.rows;
};

const userHasPermission = async (userId, orgId, permissionName) => {
  const result = await pool.query(
    `SELECT 1 FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_memberships um ON um.role_id = rp.role_id
     WHERE um.user_id = $1 AND um.org_id = $2 AND um.is_active = TRUE
     AND p.name = $3
     LIMIT 1`,
    [userId, orgId, permissionName],
  );
  return result.rows.length > 0;
};

export {
  getAllPermissions,
  getPermissionsForRole,
  assignPermissionToRole,
  removePermissionFromRole,
  getUserPermissions,
  userHasPermission,
};