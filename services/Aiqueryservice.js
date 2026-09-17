import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Only these columns/values exist for the LLM to reason about - keeps its
// generated filters grounded in the real schema instead of guessing column names.
const SCHEMA_DESCRIPTION = `
Table: deliveries
Columns:
  - status (text): one of 'pending', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'
  - sender_name (text)
  - receiver_name (text)
  - destination (text)
  - created_at (timestamp)
  - updated_at (timestamp)
(org_id and ent_id are handled separately - never reference them.)
`;

// Blocklist - the LLM should only ever produce a WHERE-clause fragment, but
// we never trust that on faith. Anything matching these patterns is rejected
// outright before it ever reaches the database.
const FORBIDDEN_PATTERN =
  /(;|--|\/\*|\*\/|\bdrop\b|\bdelete\b|\binsert\b|\bupdate\b|\bunion\b|\balter\b|\bcreate\b|\bgrant\b|\btruncate\b|\bexec\b|\borg_id\b)/i;

const isSafeWhereClause = (clause) => {
  if (!clause || typeof clause !== "string") return false;
  if (clause.length > 300) return false;
  if (FORBIDDEN_PATTERN.test(clause)) return false;
  return true;
};

const stripCodeFences = (text) => text.replace(/```json|```/g, "").trim();

// Step 1: turn the plain-English question into a safe WHERE fragment + aggregate type
const questionToQueryPlan = async (question) => {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: `You convert questions about a deliveries table into a JSON query plan.
${SCHEMA_DESCRIPTION}
Respond with ONLY a JSON object, no preamble, no markdown fences:
{"where": "<a valid PostgreSQL WHERE fragment using ONLY the columns above, or empty string for no filter>", "mode": "count" or "list"}
Use "count" mode for questions asking "how many". Use "list" mode for questions asking to see/show records.
Never reference org_id, ent_id, or any table name. Never include semicolons or multiple statements.`,
    messages: [{ role: "user", content: question }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  const parsed = JSON.parse(stripCodeFences(textBlock.text));
  return parsed; // { where, mode }
};

// Step 2: turn the raw query result back into a plain-English answer
const resultToAnswer = async (question, mode, rows) => {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: `Answer the user's question in one or two short sentences based on the
provided data. Be direct and specific with numbers. Do not mention SQL, queries,
or databases in your answer - just answer naturally.`,
    messages: [
      {
        role: "user",
        content: `Question: ${question}\nMode: ${mode}\nData: ${JSON.stringify(rows)}`,
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  return textBlock.text.trim();
};

export { questionToQueryPlan, resultToAnswer, isSafeWhereClause };
