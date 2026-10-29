// Blocks until PostgreSQL accepts connections (used after `docker compose up`).
// Usage: node scripts/wait-for-db.mjs [timeoutSeconds]
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const TIMEOUT_MS = (Number(process.argv[2]) || 30) * 1000;
const INTERVAL_MS = 1000;

const config = {
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "delivery_db",
  password: process.env.DB_PASSWORD || "postgres",
  port: Number(process.env.DB_PORT) || 5432,
  connectionTimeoutMillis: 2000,
};

const started = Date.now();
process.stdout.write(`Waiting for PostgreSQL at ${config.host}:${config.port}/${config.database} ... `);

while (Date.now() - started < TIMEOUT_MS) {
  try {
    const client = new pg.Client(config);
    await client.connect();
    await client.end();
    console.log("ready ✓");
    process.exit(0);
  } catch {
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

console.error(`\nTimed out after ${TIMEOUT_MS / 1000}s. Is 'docker compose up -d postgres' running?`);
process.exit(1);
