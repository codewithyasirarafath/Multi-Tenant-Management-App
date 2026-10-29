// One-command onboarding: node version check -> .env -> deps -> postgres -> migrate.
// Usage: npm run setup
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const step = (msg) => console.log(`\n==> ${msg}`);
const die = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) die(`\`${cmd} ${args.join(" ")}\` failed.`);
};

// 1. Node version (project requires >= 20, see DEPLOYMENT.md)
step("Checking Node version");
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) die(`Node >= 20 required, found ${process.versions.node}.`);
console.log(`Node ${process.versions.node} ✓`);

// 2. .env file
step("Checking .env");
const envPath = path.join(ROOT, ".env");
if (!fs.existsSync(envPath)) {
  fs.copyFileSync(path.join(ROOT, ".env.example"), envPath);
  console.log("Created .env from .env.example — review and edit it (JWT_SECRET, DB_PASSWORD).");
} else {
  console.log(".env exists ✓");
}

// 3. Required env keys present (values are never printed)
step("Checking required environment keys");
const dotenv = (await import("dotenv")).default;
dotenv.config({ path: envPath, override: true });
const REQUIRED = ["DB_USER", "DB_PASSWORD", "DB_NAME", "DB_HOST", "DB_PORT", "JWT_SECRET"];
const missing = REQUIRED.filter((k) => !process.env[k] || process.env[k].trim() === "");
if (missing.length > 0) die(`Missing required env keys: ${missing.join(", ")}. Fill them in .env.`);
console.log(`${REQUIRED.join(", ")} present ✓`);
if (process.env.JWT_SECRET === "change-me-to-a-long-random-string") {
  console.warn("⚠ JWT_SECRET is still the example placeholder — change it before deploying.");
}

// 4. Dependencies
step("Installing dependencies");
if (fs.existsSync(path.join(ROOT, "node_modules"))) {
  console.log("node_modules exists — skipping npm install (run `npm install` to refresh).");
} else {
  run("npm", ["install"]);
}

// 5. Postgres via docker compose
step("Starting PostgreSQL (docker compose)");
const dockerCheck = spawnSync("docker", ["info"], { stdio: "ignore", shell: process.platform === "win32" });
if (dockerCheck.status !== 0) {
  die("Docker is not running. Start Docker Desktop, then re-run `npm run setup` (or `npm run db:up`).");
}
run("docker", ["compose", "up", "-d", "postgres"]);

// 6. Wait for DB
step("Waiting for PostgreSQL");
run("node", [path.join(__dirname, "wait-for-db.mjs")]);

// 7. Migrations
step("Running migrations");
run("npm", ["run", "migrate"]);

console.log(`
Setup complete ✓

Next steps:
  npm run dev        start API with auto-reload
  npm run check      static checks (imports + org-scope)
  npm run db:reset   wipe local database and start over
`);
