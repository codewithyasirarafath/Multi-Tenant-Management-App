import pool from "../config/db.js";

// Get all roles assigned to a specific user, with role name/description joined in
const getRolesForUser = async (userId) => {
  const result = await pool.query(
    `SELECT ur.id AS assignment_id, ur.ent_id, ur.assigned_at,
            r.id AS role_id, r.name AS role_name, r.description
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY ur.assigned_at ASC`,
    [userId],
  );
  return result.rows;
};

const assignRoleToUser = async (userId, roleId, entId) => {
  const result = await pool.query(
    `INSERT INTO user_roles (user_id, role_id, ent_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, roleId, entId || null],
  );
  return result.rows[0];
};

const removeRoleFromUser = async (assignmentId, userId) => {
  const result = await pool.query(
    "DELETE FROM user_roles WHERE id = $1 AND user_id = $2 RETURNING *",
    [assignmentId, userId],
  );
  return result.rows[0];
};

export { getRolesForUser, assignRoleToUser, removeRoleFromUser };
