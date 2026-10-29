// Enforces the multi-tenant golden rule from CLAUDE.md:
// "every query touching a tenant-scoped table must be scoped by org_id".
//
// Static scan of src/**/*.js. For every SQL string literal that references a
// tenant-scoped table, it verifies the statement mentions org_id — either
// directly in the SQL (WHERE org_id = $1, INSERT column list, aliased joins)
// or in the surrounding code block (dynamic query builders that start the
// WHERE clause with an org_id condition).
//
// Usage:
//   node scripts/check-org-scope.mjs             (scan src, exit 1 on violation)
//   node scripts/check-org-scope.mjs --selftest  (run embedded good/bad samples)
//
// Suppression for a single statement (put on the line above the SQL):
//   // org-scope: ignore <reason>
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

// Tables whose rows belong to a single org. Queries touching these MUST
// reference org_id. Child tables (inventory_movements, payments,
// webhook_deliveries, ai_messages, role_permissions, tokens) are scoped via
// their parent row and are checked indirectly. organizations and users are
// global and are not checked.
const TENANT_TABLES = new Set([
  "entities",
  "roles",
  "user_memberships",
  "deliveries",
  "products",
  "inventory",
  "customers",
  "invoices",
  "notifications",
  "alerts",
  "webhook_subscriptions",
  "api_keys",
  "ai_conversations",
  "audit_logs",
]);

// Known, currently-accepted gaps. Each entry documents why it is tolerated.
// Shrink this list over time — entries here are real tenant-isolation TODOs.
const ALLOWLIST = [
  {
    file: "src/roles/model.js",
    match: "select * from roles where id = $1",
    reason: "roles may be global (org_id IS NULL); by-id fetch not org-filtered yet (roadmap gap)",
  },
  {
    file: "src/audit/model.js",
    match: "select * from audit_logs where id = $1",
    reason: "audit by-id lookup not org-filtered yet (roadmap gap)",
  },
  {
    file: "src/memberships/model.js",
    match: "delete from user_memberships where id = $1 and user_id = $2",
    reason: "route is org-access guarded and membership ownership is enforced by user_id",
  },
  {
    file: "src/memberships/model.js",
    match:
      "update user_memberships set role_id = $1, ent_id = $2, is_active = $3, updated_at = now() where id = $4 and user_id = $5",
    reason: "route is org-access guarded and membership ownership is enforced by user_id",
  },
  {
    file: "src/notifications/model.js",
    match: "update notifications set read = true, read_at = now() where id = $1 and user_id = $2",
    reason: "ownership enforced by user_id; route is org-access guarded",
  },
  {
    file: "src/notifications/model.js",
    match: "select count(*) as count from notifications where user_id = $1 and read = false",
    reason: "used by /auth/me outside org context; rows are org-scoped at creation",
  },
  {
    file: "src/ai-chat/model.js",
    match: "update ai_conversations set updated_at = now() where id = $1",
    reason: "timestamp-only touch; conversation id is org+user verified by the caller",
  },
];

const IGNORE_MARK = "org-scope: ignore";

// --- string literal extraction -------------------------------------------

// Extracts every string literal (', ", `) with its starting line, skipping
// comments and treating ${...} interpolation inside templates as opaque.
function extractLiterals(content) {
  const literals = [];
  let i = 0;
  let line = 1;
  const n = content.length;

  while (i < n) {
    const c = content[i];
    const next = content[i + 1];

    if (c === "\n") {
      line++;
      i++;
      continue;
    }
    // line comment
    if (c === "/" && next === "/") {
      while (i < n && content[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(content[i] === "*" && content[i + 1] === "/")) {
        if (content[i] === "\n") line++;
        i++;
      }
      i += 2;
      continue;
    }
    // string literal
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      const startLine = line;
      let value = "";
      i++;
      while (i < n) {
        const ch = content[i];
        if (ch === "\\" && i + 1 < n) {
          value += ch + content[i + 1];
          i += 2;
          continue;
        }
        if (ch === "\n") line++;
        if (quote !== "`" && ch === "\n") break; // unterminated
        if (ch === quote) {
          i++;
          break;
        }
        // template interpolation: skip to matching brace
        if (quote === "`" && ch === "$" && content[i + 1] === "{") {
          let depth = 1;
          value += "${...}";
          i += 2;
          while (i < n && depth > 0) {
            if (content[i] === "{") depth++;
            else if (content[i] === "}") depth--;
            else if (content[i] === "\n") line++;
            // keep template/comment quirks inside interpolation opaque
            i++;
          }
          continue;
        }
        value += ch;
        i++;
      }
      literals.push({ value, line: startLine });
      continue;
    }
    i++;
  }
  return literals;
}

const SQL_START = /^\s*(select|insert|update|delete|with)\b/i;

// --- analysis -------------------------------------------------------------

const normalize = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

function tablesIn(sql) {
  const found = new Set();
  const re = /\b(?:from|into|update|join)\s+([a-zA-Z_][\w]*)/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const t = m[1].toLowerCase();
    if (TENANT_TABLES.has(t)) found.add(t);
  }
  return [...found];
}

function hasIgnoreMark(lines, idx) {
  for (let j = idx - 1; j >= Math.max(0, idx - 5); j--) {
    const l = lines[j].trim();
    // skip plumbing between the comment and the SQL: empty lines, bare
    // backticks, and query-call openers like `const result = await pool.query(`
    if (l === "" || l === "`" || l.endsWith("(") || l.includes(".query(")) continue;
    // first meaningful line above the SQL decides; only comments may suppress
    return l.startsWith("//") && l.includes(IGNORE_MARK);
  }
  return false;
}

// Window heuristic for dynamically-built queries: if `org_id` appears in the
// code within +/- WINDOW lines of the SQL literal (almost always the same
// function), we treat the query as org-scoped via its dynamic WHERE clause.
const WINDOW = 35;

function analyzeFile(filePath, content) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
  const lines = content.split("\n");
  const findings = [];

  const literals = extractLiterals(content);
  const sqlLiterals = literals.filter((l) => SQL_START.test(l.value));

  for (const lit of sqlLiterals) {
    const tables = tablesIn(lit.value);
    if (tables.length === 0) continue;

    const finding = {
      file: relPath,
      line: lit.line,
      tables,
      sql: normalize(lit.value).slice(0, 120),
      status: "pass",
      note: null,
    };

    if (/org_id/i.test(lit.value)) {
      findings.push(finding);
      continue;
    }

    if (hasIgnoreMark(lines, lit.line - 1)) {
      finding.status = "ignored";
      finding.note = "suppressed by org-scope: ignore comment";
      findings.push(finding);
      continue;
    }

    const allowed = ALLOWLIST.find(
      (a) => a.file === relPath && normalize(lit.value).startsWith(a.match),
    );
    if (allowed) {
      finding.status = "allowlisted";
      finding.note = allowed.reason;
      findings.push(finding);
      continue;
    }

    const from = Math.max(0, lit.line - 1 - WINDOW);
    const to = Math.min(lines.length, lit.line - 1 + WINDOW);
    const windowText = lines.slice(from, to).join("\n");
    if (lit.value.includes("${...}") && /org_id/.test(windowText)) {
      finding.status = "pass";
      finding.note = "org_id applied via dynamic WHERE builder";
      findings.push(finding);
      continue;
    }

    finding.status = "violation";
    finding.note = `no org_id in query on tenant table(s): ${tables.join(", ")}`;
    findings.push(finding);
  }

  return { relPath, sqlCount: sqlLiterals.length, findings };
}

// --- runner ---------------------------------------------------------------

function findSrcFiles() {
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) files.push(full);
    }
  })(SRC);
  return files;
}

function scan() {
  const files = findSrcFiles();
  let statements = 0;
  let dynamic = 0;
  let allowlisted = 0;
  let ignored = 0;
  const violations = [];

  for (const file of files) {
    const { sqlCount, findings } = analyzeFile(file, fs.readFileSync(file, "utf8"));
    statements += sqlCount;
    for (const f of findings) {
      if (f.status === "violation") violations.push(f);
      else if (f.status === "allowlisted") allowlisted++;
      else if (f.status === "ignored") ignored++;
      else if (f.note) dynamic++;
    }
  }

  console.log(`\nScanned ${files.length} files, ${statements} SQL statements on tenant tables.`);
  if (dynamic) console.log(`  dynamic (org-scoped via builder): ${dynamic}`);
  if (allowlisted) console.log(`  allowlisted known gaps:            ${allowlisted}`);
  if (ignored) console.log(`  ignored (inline suppression):      ${ignored}`);

  if (violations.length > 0) {
    console.log(`\n${violations.length} org-scope violation(s) ✗`);
    for (const v of violations) {
      console.log(`\n  ${v.file}:${v.line}  [${v.tables.join(", ")}]`);
      console.log(`    ${v.sql}`);
      console.log(`    -> ${v.note}`);
    }
    console.log("\nIf this query is legitimately global, add above it: // org-scope: ignore <reason>");
    process.exit(1);
  }
  console.log("ALL QUERIES ORG-SCOPED ✓");
}

// --- selftest -------------------------------------------------------------

function selftest() {
  const cases = [
    {
      name: "static by-id WITH org_id",
      sql: "SELECT * FROM deliveries WHERE id = $1 AND org_id = $2",
      expect: "pass",
    },
    {
      name: "static by-id WITHOUT org_id",
      sql: "SELECT * FROM deliveries WHERE id = $1",
      expect: "violation",
    },
    {
      name: "INSERT with org_id column",
      sql: "INSERT INTO customers (org_id, name) VALUES ($1, $2) RETURNING *",
      expect: "pass",
    },
    {
      name: "INSERT without org_id column",
      sql: "INSERT INTO customers (name, email) VALUES ($1, $2) RETURNING *",
      expect: "violation",
    },
    {
      name: "org_id IS NULL pattern",
      sql: "SELECT * FROM roles WHERE org_id IS NULL OR org_id = $1",
      expect: "pass",
    },
    {
      name: "global table (users) is not checked",
      sql: "SELECT * FROM users WHERE id = $1",
      expect: "none",
    },
    {
      name: "dynamic builder with org_id condition nearby",
      sql: "SELECT * FROM deliveries WHERE ${whereSql} ORDER BY created_at DESC",
      context: 'const conditions = ["org_id = $1"];',
      expect: "pass",
    },
    {
      name: "dynamic builder with NO org_id anywhere",
      sql: "SELECT * FROM deliveries WHERE ${whereSql} ORDER BY created_at DESC",
      context: 'const conditions = ["status = $1"];',
      expect: "violation",
    },
    {
      name: "inline suppression comment",
      sql: "SELECT * FROM deliveries WHERE id = $1",
      context: "// org-scope: ignore demo — admin-only report",
      expect: "ignored",
    },
    {
      name: "child table scoped via parent is not checked",
      sql: "INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)",
      expect: "none",
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const content = `${c.context ? c.context + "\n" : ""}const r = await pool.query(\n  \`${c.sql}\`,\n  []\n);\n`;
    const tmpPath = path.join(ROOT, "src", "__selftest__.js");
    const { findings } = analyzeFile(tmpPath, content);
    const statuses = findings.map((f) => f.status);
    const got = statuses.includes("violation")
      ? "violation"
      : statuses.includes("ignored")
        ? "ignored"
        : statuses.length > 0
          ? "pass"
          : "none";
    const ok = got === c.expect;
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${c.name}  (expect ${c.expect}, got ${got})`);
  }

  if (failed > 0) {
    console.log(`\nSelftest FAILED: ${failed} case(s) ✗`);
    process.exit(1);
  }
  console.log("\nSelftest passed ✓");
}

if (process.argv.includes("--selftest")) selftest();
else scan();
