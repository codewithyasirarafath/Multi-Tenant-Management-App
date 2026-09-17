import pool from "../config/db.js";

// ============================================
// INTENT PARSING - pure keyword/pattern matching, no ML/LLM involved
// ============================================

const STATUS_SYNONYMS = {
  pending: ["pending"],
  in_transit: ["in transit", "in-transit", "transit"],
  out_for_delivery: ["out for delivery", "out-for-delivery"],
  delivered: ["delivered", "completed", "done"],
  cancelled: ["cancelled", "canceled"],
};

const detectStatus = (q) => {
  for (const [status, synonyms] of Object.entries(STATUS_SYNONYMS)) {
    if (synonyms.some((s) => q.includes(s))) return status;
  }
  return null;
};

const detectMode = (q) => {
  const countWords = ["how many", "number of", "count of", "total"];
  return countWords.some((w) => q.includes(w)) ? "count" : "list";
};

// Matches "... to <place>" at the end of a question, e.g. "deliveries to Bengaluru"
const detectDestination = (question) => {
  const match = question.match(/\bto\s+([a-zA-Z][a-zA-Z\s]{1,40})[?.!]*$/i);
  return match ? match[1].trim() : null;
};

// Meta-questions about the app itself, not the data
const META_KEYWORDS = {
  tables: ["table", "schema", "database structure"],
  routes: ["route", "endpoint", "api"],
  overview: [
    "what does this app do",
    "what is this app",
    "what is this project",
  ],
};

const detectMetaIntent = (q) => {
  for (const [intent, keywords] of Object.entries(META_KEYWORDS)) {
    if (keywords.some((k) => q.includes(k))) return intent;
  }
  return null;
};

const META_ANSWERS = {
  tables:
    "This app has these tables: organizations, entities, users, roles, user_roles, deliveries, ai_conversations, ai_messages.",
  routes:
    "Main resources: /api/organizations, /api/organizations/:orgId/entities, /users, /roles, /deliveries, and /ai-chat/conversations.",
  overview:
    "This is a multi-tenant delivery management app - organizations contain entities and users, users hold roles, and deliveries are tracked per organization.",
};

// ============================================
// QUERY BUILDING - always parameterized, always scoped by org_id
// ============================================

const buildAndRunQuery = async (orgId, { mode, status, destination }) => {
  const conditions = ["org_id = $1"];
  const params = [orgId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (destination) {
    conditions.push(`destination ILIKE $${idx}`);
    params.push(`%${destination}%`);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText =
    mode === "count"
      ? `SELECT COUNT(*) AS count FROM deliveries WHERE ${whereSql}`
      : `SELECT tracking_number, destination, status FROM deliveries WHERE ${whereSql} ORDER BY created_at DESC LIMIT 10`;

  const result = await pool.query(queryText, params);
  return result.rows;
};

// ============================================
// ANSWER TEMPLATES - plain string building, no LLM
// ============================================

const buildAnswer = ({ mode, status, destination }, rows) => {
  const filterPhrase = [
    status ? `with status "${status}"` : null,
    destination ? `to "${destination}"` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (mode === "count") {
    const n = rows[0]?.count ?? 0;
    return filterPhrase
      ? `There are ${n} deliveries ${filterPhrase}.`
      : `There are ${n} deliveries in total.`;
  }

  if (rows.length === 0) {
    return filterPhrase
      ? `No deliveries found ${filterPhrase}.`
      : "No deliveries found.";
  }

  const listStr = rows
    .map((r) => `${r.tracking_number} (${r.status}, to ${r.destination})`)
    .join(", ");
  return `Found ${rows.length} deliveries${filterPhrase ? " " + filterPhrase : ""}: ${listStr}`;
};

// ============================================
// MAIN ENTRY POINT - same signature the controller already expects
// ============================================

const runChatTurn = async (orgId, messageHistory) => {
  const lastUserMessage = [...messageHistory]
    .reverse()
    .find((m) => m.role === "user");
  const question = (lastUserMessage?.content || "").toString();
  const q = question.toLowerCase();

  const metaIntent = detectMetaIntent(q);
  if (metaIntent) {
    return META_ANSWERS[metaIntent];
  }

  const plan = {
    mode: detectMode(q),
    status: detectStatus(q),
    destination: detectDestination(question),
  };

  try {
    const rows = await buildAndRunQuery(orgId, plan);
    return buildAnswer(plan, rows);
  } catch {
    return "Sorry, I couldn't work that out. Try asking about delivery status, counts, or destinations.";
  }
};

export { runChatTurn };
