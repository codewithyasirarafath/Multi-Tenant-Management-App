import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const c = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
});
await c.connect();
const r = await c.query(
  `SELECT u.email, o.org_code, r.name AS role_name, r.org_id AS role_org_id
   FROM users u
   JOIN user_memberships um ON um.user_id = u.id
   JOIN organizations o ON o.id = um.org_id
   JOIN roles r ON r.id = um.role_id
   WHERE u.email = 'admin@acme.test'
   ORDER BY o.org_code`,
);
console.table(r.rows);
await c.end();
process.exit(0);
