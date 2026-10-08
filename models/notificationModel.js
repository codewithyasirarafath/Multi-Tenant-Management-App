import pool from "../config/db.js";

const getAllNotifications = async (userId, { limit = 50, offset = 0, type, read, orgId } = {}) => {
  const conditions = ["user_id = $1"];
  const params = [userId];
  let idx = 2;

  if (type) {
    conditions.push(`type = $${idx}`);
    params.push(type);
    idx++;
  }
  if (read !== undefined) {
    conditions.push(`read = $${idx}`);
    params.push(read);
    idx++;
  }
  if (orgId) {
    conditions.push(`org_id = $${idx}`);
    params.push(orgId);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText = `
    SELECT n.*, o.name AS org_name, e.name AS entity_name
    FROM notifications n
    LEFT JOIN organizations o ON o.id = n.org_id
    LEFT JOIN entities e ON e.id = n.ent_id
    WHERE ${whereSql}
    ORDER BY n.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);

  const result = await pool.query(queryText, params);
  return result.rows;
};

const markNotificationRead = async (notificationId, userId) => {
  const result = await pool.query(
    `UPDATE notifications SET read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [notificationId, userId],
  );
  return result.rows[0];
};

const getUnreadCount = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read = FALSE`,
    [userId],
  );
  return result.rows[0].count;
};

const getAllAlerts = async (orgId, { entId, type, severity, isResolved } = {}) => {
  const conditions = ["org_id = $1"];
  const params = [orgId];
  let idx = 2;

  if (entId) {
    conditions.push(`ent_id = $${idx}`);
    params.push(entId);
    idx++;
  }
  if (type) {
    conditions.push(`type = $${idx}`);
    params.push(type);
    idx++;
  }
  if (severity) {
    conditions.push(`severity = $${idx}`);
    params.push(severity);
    idx++;
  }
  if (isResolved !== undefined) {
    conditions.push(`is_resolved = $${idx}`);
    params.push(isResolved);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText = `
    SELECT a.*, u.email AS resolved_by_email
    FROM alerts a
    LEFT JOIN users u ON u.id = a.resolved_by
    WHERE ${whereSql}
    ORDER BY a.severity DESC, a.created_at DESC
  `;
  const result = await pool.query(queryText, params);
  return result.rows;
};

const resolveAlert = async (alertId, orgId, userId) => {
  const result = await pool.query(
    `UPDATE alerts SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = $1 WHERE id = $2 AND org_id = $3 RETURNING *`,
    [userId, alertId, orgId],
  );
  return result.rows[0];
};

const createAlert = async (orgId, { entId, type, severity, title, message, relatedId, relatedType }) => {
  const result = await pool.query(
    `INSERT INTO alerts (org_id, ent_id, type, severity, title, message, related_id, related_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [orgId, entId || null, type, severity || 'medium', title, message, relatedId || null, relatedType || null],
  );
  return result.rows[0];
};

export {
  getAllNotifications,
  markNotificationRead,
  getUnreadCount,
  getAllAlerts,
  resolveAlert,
  createAlert,
};