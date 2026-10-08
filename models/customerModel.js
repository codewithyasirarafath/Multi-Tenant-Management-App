import pool from "../config/db.js";

const getAllCustomers = async (orgId, { limit = 50, offset = 0, isActive, entId } = {}) => {
  const conditions = ["org_id = $1"];
  const params = [orgId];
  let idx = 2;

  if (isActive !== undefined) {
    conditions.push(`is_active = $${idx}`);
    params.push(isActive);
    idx++;
  }
  if (entId) {
    conditions.push(`ent_id = $${idx}`);
    params.push(entId);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText = `
    SELECT * FROM customers 
    WHERE ${whereSql} 
    ORDER BY created_at DESC 
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);

  const result = await pool.query(queryText, params);
  return result.rows;
};

const getCustomerById = async (id, orgId) => {
  const result = await pool.query(
    "SELECT * FROM customers WHERE id = $1 AND org_id = $2",
    [id, orgId],
  );
  return result.rows[0];
};

const createCustomer = async (orgId, { entId, name, email, mobile, address }) => {
  const result = await pool.query(
    `INSERT INTO customers (org_id, ent_id, name, email, mobile, address)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [orgId, entId || null, name, email || null, mobile || null, address || null],
  );
  return result.rows[0];
};

const updateCustomer = async (id, orgId, { entId, name, email, mobile, address }) => {
  const result = await pool.query(
    `UPDATE customers
     SET ent_id = $1, name = $2, email = $3, mobile = $4, address = $5, updated_at = NOW()
     WHERE id = $6 AND org_id = $7 RETURNING *`,
    [entId || null, name, email || null, mobile || null, address || null, id, orgId],
  );
  return result.rows[0];
};

const deleteCustomer = async (id, orgId) => {
  const result = await pool.query(
    "DELETE FROM customers WHERE id = $1 AND org_id = $2 RETURNING *",
    [id, orgId],
  );
  return result.rows[0];
};

export {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};