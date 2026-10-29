// Runs all SQL migration files in migrations/ in filename order.
// Tracks applied migrations in schema_migrations so re-runs are safe.
// On an empty database, applies multitenant-schema.sql (base) first.
// Usage: npm run migrate
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "migrations");

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  connectionString: process.env.DATABASE_URL,
});

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No migration files found.");
  await pool.end();
  process.exit(0);
}

// Tracking table — a migration that completed is never executed again.
await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

// Fresh-database bootstrap: the numbered migrations are incremental and
// assume the base tables (organizations, users, ...) already exist. On an
// empty database, apply multitenant-schema.sql first. The base schema is
// not idempotent, so it is gated on the absence of its tables.
const baseTables = await pool.query(
  `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations'`,
);
if (baseTables.rowCount === 0) {
  const baseSchemaPath = path.join(ROOT, "multitenant-schema.sql");
  if (fs.existsSync(baseSchemaPath)) {
    console.log("Empty database detected — applying base schema (multitenant-schema.sql) first.");
    const baseSql = fs.readFileSync(baseSchemaPath, "utf8");
    try {
      await pool.query(baseSql);
      await pool.query(`INSERT INTO schema_migrations (filename) VALUES ('multitenant-schema.sql')`);
      console.log("Applied: multitenant-schema.sql (base)");
    } catch (err) {
      console.error(`Failed:  multitenant-schema.sql -> ${err.message}`);
      await pool.end();
      process.exit(1);
    }
  } else {
    console.error("Database is empty but multitenant-schema.sql is missing — cannot bootstrap.");
    await pool.end();
    process.exit(1);
  }
}

const { rows } = await pool.query(`SELECT filename FROM schema_migrations`);
const appliedSet = new Set(rows.map((r) => r.filename));

// Postgres error codes meaning "object already exists" — seen when adopting
// a database that predates migration tracking. Treated as already applied.
const ALREADY_EXISTS_CODES = new Set(["42710", "42P07", "42701", "42P06", "42723"]);

let applied = 0;
let skipped = 0;
let failed = 0;

for (const file of files) {
  if (appliedSet.has(file)) {
    skipped++;
    continue;
  }
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, "utf8");
  try {
    // Each migration + its tracking row commit atomically.
    await pool.query(`BEGIN`);
    await pool.query(sql);
    await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
    await pool.query(`COMMIT`);
    console.log(`Applied: ${file}`);
    applied++;
  } catch (err) {
    await pool.query(`ROLLBACK`).catch(() => {});
    if (ALREADY_EXISTS_CODES.has(err.code)) {
      // Legacy database that predates tracking: the objects exist, adopt it.
      await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
      console.log(`Adopted: ${file} (objects already exist)`);
      applied++;
    } else {
      console.error(`Failed:  ${file} -> ${err.message}`);
      failed++;
    }
  }
}

await pool.end();
console.log(`Done. ${applied} applied, ${skipped} already applied, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
