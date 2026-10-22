// Runs all SQL migration files in migrations/ in filename order.
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
  process.exit(0);
}

let applied = 0;
let failed = 0;

for (const file of files) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, "utf8");
  try {
    await pool.query(sql);
    console.log(`Applied: ${file}`);
    applied++;
  } catch (err) {
    console.error(`Failed:  ${file} -> ${err.message}`);
    failed++;
  }
}

await pool.end();
console.log(`Done. ${applied} applied, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
