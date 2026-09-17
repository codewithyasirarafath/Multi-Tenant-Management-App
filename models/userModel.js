import pool from "../config/db.js";

const getAllUsers = async ({ limit = 50, offset = 0, orgId } = {}) => {
  let query = "SELECT * FROM users WHERE is_active = TRUE";
  const params = [];
  let paramIndex = 1;

  if (orgId) {
    query += ` AND id IN (SELECT user_id FROM user_memberships WHERE org_id = $${paramIndex} AND is_active = TRUE)`;
    params.push(orgId);
    paramIndex++;
  }

  query += ` ORDER BY created_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

const getUserById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email],
  );
  return result.rows[0];
};

const createUser = async (firstName, lastName, mobile, email) => {
  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, mobile, email)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [firstName, lastName, mobile, email],
  );
  return result.rows[0];
};

const updateUser = async (id, firstName, lastName, mobile, email, isActive) => {
  const result = await pool.query(
    `UPDATE users
     SET first_name = $1, last_name = $2, mobile = $3, email = $4,
         is_active = $5, updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [firstName, lastName, mobile, email, isActive, id],
  );
  return result.rows[0];
};

const deleteUser = async (id) => {
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING *",
    [id],
  );
  return result.rows[0];
};

export { getAllUsers, getUserById, getUserByEmail, createUser, updateUser, deleteUser };