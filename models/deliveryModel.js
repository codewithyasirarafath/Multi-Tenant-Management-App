import pool from "../config/db.js";

const getAllDeliveries = async (orgId, { limit = 50, offset = 0, status, entId } = {}) => {
  const conditions = ["org_id = $1"];
  const params = [orgId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (entId) {
    conditions.push(`ent_id = $${idx}`);
    params.push(entId);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText = `
    SELECT * FROM deliveries 
    WHERE ${whereSql} 
    ORDER BY created_at DESC 
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);

  const result = await pool.query(queryText, params);
  return result.rows;
};

const getDeliveryById = async (id, orgId) => {
  const result = await pool.query(
    "SELECT * FROM deliveries WHERE id = $1 AND org_id = $2",
    [id, orgId],
  );
  return result.rows[0];
};

const getDeliveryByTrackingNumber = async (trackingNumber, orgId) => {
  const result = await pool.query(
    "SELECT * FROM deliveries WHERE tracking_number = $1 AND org_id = $2",
    [trackingNumber, orgId],
  );
  return result.rows[0];
};

const createDelivery = async (
  orgId,
  entId,
  trackingNumber,
  senderName,
  receiverName,
  destination,
  status,
  createdBy,
) => {
  const result = await pool.query(
    `INSERT INTO deliveries (org_id, ent_id, tracking_number, sender_name, receiver_name, destination, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      orgId,
      entId || null,
      trackingNumber,
      senderName,
      receiverName,
      destination,
      status || "pending",
      createdBy || null,
    ],
  );
  return result.rows[0];
};

const updateDelivery = async (
  id,
  orgId,
  entId,
  senderName,
  receiverName,
  destination,
) => {
  const result = await pool.query(
    `UPDATE deliveries
     SET ent_id = $1, sender_name = $2, receiver_name = $3, destination = $4, updated_at = NOW()
     WHERE id = $5 AND org_id = $6 RETURNING *`,
    [entId || null, senderName, receiverName, destination, id, orgId],
  );
  return result.rows[0];
};

const updateDeliveryStatus = async (id, orgId, status) => {
  const result = await pool.query(
    "UPDATE deliveries SET status = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3 RETURNING *",
    [status, id, orgId],
  );
  return result.rows[0];
};

const deleteDelivery = async (id, orgId) => {
  const result = await pool.query(
    "DELETE FROM deliveries WHERE id = $1 AND org_id = $2 RETURNING *",
    [id, orgId],
  );
  return result.rows[0];
};

export {
  getAllDeliveries,
  getDeliveryById,
  getDeliveryByTrackingNumber,
  createDelivery,
  updateDelivery,
  updateDeliveryStatus,
  deleteDelivery,
};