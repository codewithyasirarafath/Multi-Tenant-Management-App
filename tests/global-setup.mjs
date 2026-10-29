// Vitest global setup: create the isolated test database and migrate it.
// Runs once before any test file. DB_NAME is forced to delivery_test for
// the actual test run by tests/setup-env.mjs.
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

export const TEST_DB = "delivery_test";

export default async function globalSetup() {
  const admin = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || "localhost",
    database: "postgres",
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  try {
    const exists = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [TEST_DB],
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${TEST_DB}`);
      console.log(`Created test database: ${TEST_DB}`);
    }
  } finally {
    await admin.end();
  }

  // Apply migrations to the test DB (dotenv in migrate.js does not override
  // the explicitly set DB_NAME).
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts", "migrate.js")],
    { stdio: "inherit", env: { ...process.env, DB_NAME: TEST_DB } },
  );
  if (result.status !== 0) {
    throw new Error("Migrations failed for the test database");
  }
}
