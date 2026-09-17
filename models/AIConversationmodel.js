import pool from "../config/db.js";

const getConversations = async (orgId, userId, { limit = 50, offset = 0 } = {}) => {
  const result = await pool.query(
    `SELECT * FROM ai_conversations 
     WHERE org_id = $1 AND user_id = $2
     ORDER BY updated_at DESC 
     LIMIT $3 OFFSET $4`,
    [orgId, userId, limit, offset],
  );
  return result.rows;
};

const getConversationById = async (conversationId, orgId, userId) => {
  const result = await pool.query(
    `SELECT * FROM ai_conversations 
     WHERE id = $1 AND org_id = $2 AND user_id = $3`,
    [conversationId, orgId, userId],
  );
  return result.rows[0];
};

const createConversation = async (orgId, userId, title) => {
  const result = await pool.query(
    `INSERT INTO ai_conversations (org_id, user_id, title)
     VALUES ($1, $2, $3) RETURNING *`,
    [orgId, userId, title || null],
  );
  return result.rows[0];
};

const updateConversation = async (conversationId, orgId, userId, title) => {
  const result = await pool.query(
    `UPDATE ai_conversations
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND org_id = $3 AND user_id = $4 RETURNING *`,
    [title, conversationId, orgId, userId],
  );
  return result.rows[0];
};

const deleteConversation = async (conversationId, orgId, userId) => {
  const result = await pool.query(
    `DELETE FROM ai_conversations WHERE id = $1 AND org_id = $2 AND user_id = $3 RETURNING *`,
    [conversationId, orgId, userId],
  );
  return result.rows[0];
};

const getMessages = async (conversationId, orgId, userId, { limit = 100, offset = 0 } = {}) => {
  // Verify conversation belongs to user
  const conv = await getConversationById(conversationId, orgId, userId);
  if (!conv) return [];

  const result = await pool.query(
    `SELECT * FROM ai_messages 
     WHERE conversation_id = $1
     ORDER BY created_at ASC 
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset],
  );
  return result.rows;
};

const addMessage = async (conversationId, orgId, userId, role, content, metadata) => {
  // Verify conversation belongs to user
  const conv = await getConversationById(conversationId, orgId, userId);
  if (!conv) return null;

  const result = await pool.query(
    `INSERT INTO ai_messages (conversation_id, role, content, metadata)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [conversationId, role, content, metadata ? JSON.stringify(metadata) : null],
  );

  // Update conversation updated_at
  await pool.query(
    `UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId],
  );

  return result.rows[0];
};

export {
  getConversations,
  getConversationById,
  createConversation,
  updateConversation,
  deleteConversation,
  getMessages,
  addMessage,
};