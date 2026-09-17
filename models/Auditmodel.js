import pool from "../config/db.js";

const logAudit = async ({
  userId,
  orgId,
  entId,
  action,
  resourceType,
  resourceId,
  oldValues,
  newValues,
  ipAddress,
  userAgent,
  requestId,
}) => {
  const result = await pool.query(
    `INSERT INTO audit_logs (user_id, org_id, ent_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      userId || null,
      orgId || null,
      entId || null,
      action,
      resourceType,
      resourceId || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress || null,
      userAgent || null,
      requestId || null,
    ],
  );
  return result.rows[0];
};

const getAuditLogs = async (filters = {}, { limit = 50, offset = 0 } = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${idx}`);
    params.push(filters.userId);
    idx++;
  }
  if (filters.orgId) {
    conditions.push(`org_id = $${idx}`);
    params.push(filters.orgId);
    idx++;
  }
  if (filters.action) {
    conditions.push(`action = $${idx}`);
    params.push(filters.action);
    idx++;
  }
  if (filters.resourceType) {
    conditions.push(`resource_type = $${idx}`);
    params.push(filters.resourceType);
    idx++;
  }
  if (filters.resourceId) {
    conditions.push(`resource_id = $${idx}`);
    params.push(filters.resourceId);
    idx++;
  }
  if (filters.startDate) {
    conditions.push(`created_at >= $${idx}`);
    params.push(filters.startDate);
    idx++;
  }
  if (filters.endDate) {
    conditions.push(`created_at <= $${idx}`);
    params.push(filters.endDate);
    idx++;
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const queryText = `
    SELECT * FROM audit_logs 
    ${whereSql} 
    ORDER BY created_at DESC 
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);

  const result = await pool.query(queryText, params);
  return result.rows;
};

const getAuditLogById = async (logId) => {
  const result = await pool.query(
    "SELECT * FROM audit_logs WHERE id = $1",
    [logId],
  );
  return result.rows[0];
};

export { logAudit, getAuditLogs, getAuditLogById };