// Seeds minimal sample data into every table so all API flows can be tested.
// Idempotent: safe to run repeatedly (every insert is gated on existing data).
// Usage: npm run seed
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const q = (text, params = []) => pool.query(text, params);

// Test credentials the seed creates (dev only):
//   admin@acme.test / Passw0rd!123   (org_admin across the org)
//   staff@acme.test / Passw0rd!123   (staff, scoped to Main Warehouse)
const PASSWORD = "Passw0rd!123";
const API_KEY_PLAIN = "ak_test_seed_key_12345"; // sha256 of this is stored; use with POST /api-keys/validate

let seeded = 0;

async function exists(text, params = []) {
  const r = await q(text, params);
  return r.rowCount > 0;
}

async function seed() {
  // ---- roles (system defaults come from the base schema) ----
  const roles = await q(`SELECT id, name FROM roles WHERE org_id IS NULL`);
  const roleId = Object.fromEntries(roles.rows.map((r) => [r.name, r.id]));
  if (!roleId.org_admin || !roleId.staff) {
    throw new Error("System roles missing — run npm run migrate first.");
  }

  // ---- organization ----
  let org = (
    await q(`SELECT * FROM organizations WHERE slug = 'acme-logistics'`)
  ).rows[0];
  if (!org) {
    org = (
      await q(
        `INSERT INTO organizations (name, slug, org_code)
         VALUES ('Acme Logistics', 'acme-logistics', nextval('org_code_seq'))
         RETURNING *`,
      )
    ).rows[0];
    seeded++;
  }
  console.log(`org: ${org.name} (code ${org.org_code})`);

  // ---- entity ----
  let entity = (
    await q(`SELECT * FROM entities WHERE org_id = $1 AND code = 'WH-001'`, [org.id])
  ).rows[0];
  if (!entity) {
    entity = (
      await q(
        `INSERT INTO entities (org_id, name, code, ent_code)
         VALUES ($1, 'Main Warehouse', 'WH-001', nextval('ent_code_seq'))
         RETURNING *`,
        [org.id],
      )
    ).rows[0];
    seeded++;
  }
  console.log(`entity: ${entity.name} (ent_code ${entity.ent_code})`);

  // ---- users (global) + memberships ----
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const usersDef = [
    { email: "admin@acme.test", first: "Ada", last: "Admin", role: "org_admin", ent: null },
    { email: "staff@acme.test", first: "Sam", last: "Staff", role: "staff", ent: entity.id },
  ];
  const userIds = {};
  for (const u of usersDef) {
    let user = (await q(`SELECT id FROM users WHERE email = $1`, [u.email])).rows[0];
    if (!user) {
      user = (
        await q(
          `INSERT INTO users (first_name, last_name, mobile, email, password_hash)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [u.first, u.last, `+10000000${usersDef.indexOf(u)}`, u.email, passwordHash],
        )
      ).rows[0];
      seeded++;
    }
    userIds[u.email] = user.id;
    const hasMembership = await exists(
      `SELECT 1 FROM user_memberships WHERE user_id = $1 AND org_id = $2 AND role_id = $3`,
      [user.id, org.id, roleId[u.role]],
    );
    if (!hasMembership) {
      await q(
        `INSERT INTO user_memberships (user_id, org_id, ent_id, role_id)
         VALUES ($1, $2, $3, $4)`,
        [user.id, org.id, u.ent, roleId[u.role]],
      );
      seeded++;
    }
  }
  const adminId = userIds["admin@acme.test"];
  console.log("users: admin@acme.test, staff@acme.test (password Passw0rd!123)");

  // ---- deliveries (all four statuses) ----
  const deliveries = [
    ["TRK-1001", "Global Supplies", "Priya Sharma", "Mumbai Central Hub", "pending", null],
    ["TRK-1002", "Northwind Traders", "Ravi Kumar", "Delhi Warehouse", "in_transit", entity.id],
    ["TRK-1003", "Blue Ocean Ltd", "Meera Nair", "Kochi Port", "out_for_delivery", entity.id],
    ["TRK-1004", "Sunrise Retail", "Arjun Patel", "Ahmedabad Depot", "delivered", null],
  ];
  for (const [trk, sender, receiver, dest, status, entId] of deliveries) {
    const added = await q(
      `INSERT INTO deliveries (org_id, ent_id, tracking_number, sender_name, receiver_name, destination, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (org_id, tracking_number) DO NOTHING`,
      [org.id, entId, trk, sender, receiver, dest, status, adminId],
    );
    if (added.rowCount > 0) seeded++;
  }
  console.log("deliveries: TRK-1001..1004 (pending, in_transit, out_for_delivery, delivered)");

  // ---- products + inventory + one movement ----
  const productsDef = [
    ["SKU-001", "Widget", 25.0, 120],
    ["SKU-002", "Gadget", 99.5, 4], // low stock → pairs with the alert below
  ];
  const productIds = [];
  for (const [sku, name, price, qty] of productsDef) {
    let product = (
      await q(`SELECT id FROM products WHERE org_id = $1 AND sku = $2`, [org.id, sku])
    ).rows[0];
    if (!product) {
      product = (
        await q(
          `INSERT INTO products (org_id, ent_id, name, sku, unit, cost_price, sale_price, track_inventory, min_stock_level)
           VALUES ($1, $2, $3, $4, 'pcs', $5, $6, TRUE, 10) RETURNING id`,
          [org.id, entity.id, name, sku, price * 0.6, price],
        )
      ).rows[0];
      seeded++;
      await q(
        `INSERT INTO inventory (org_id, ent_id, product_id, quantity, reserved)
         VALUES ($1, $2, $3, $4, 0)`,
        [org.id, entity.id, product.id, qty],
      );
      seeded++;
      await q(
        `INSERT INTO inventory_movements (org_id, ent_id, product_id, movement_type, quantity, performed_by)
         VALUES ($1, $2, $3, 'in', $4, $5)`,
        [org.id, entity.id, product.id, qty, adminId],
      );
      seeded++;
    }
    productIds.push(product.id);
  }
  console.log("products: SKU-001 Widget (qty 120), SKU-002 Gadget (qty 4, low stock)");

  // ---- customers ----
  for (const [name, email, mobile, city] of [
    ["Global Supplies", "orders@globalsupplies.test", "+911234567801", "Mumbai"],
    ["Northwind Traders", "buy@northwind.test", "+911234567802", "Delhi"],
  ]) {
    const added = await q(
      `INSERT INTO customers (org_id, ent_id, name, email, mobile, address)
       SELECT $1::uuid, $2::uuid, $3::varchar, $4::varchar, $5::varchar, $6::varchar
       WHERE NOT EXISTS (SELECT 1 FROM customers WHERE org_id = $1::uuid AND email = $4::varchar)`,
      [org.id, entity.id, name, email, mobile, `${city}, India`],
    );
    if (added.rowCount > 0) seeded++;
  }
  console.log("customers: Global Supplies, Northwind Traders");

  // ---- invoices + one payment ----
  const firstDelivery = (await q(`SELECT id FROM deliveries WHERE org_id = $1 AND tracking_number = 'TRK-1001'`, [org.id])).rows[0];
  let paidInvoice = (await q(`SELECT id FROM invoices WHERE org_id = $1 AND invoice_number = 'INV-1001'`, [org.id])).rows[0];
  if (!paidInvoice) {
    paidInvoice = (
      await q(
        `INSERT INTO invoices (org_id, delivery_id, customer_id, ent_id, invoice_number, subtotal, tax, total, status, due_date, paid_at)
         VALUES ($1, $2, (SELECT id FROM customers WHERE org_id = $1 AND email = 'orders@globalsupplies.test'), $3, 'INV-1001', 450.00, 22.50, 472.50, 'paid', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days')
         RETURNING id`,
        [org.id, firstDelivery?.id ?? null, entity.id],
      )
    ).rows[0];
    seeded++;
  }
  const addedInvoice = await q(
    `INSERT INTO invoices (org_id, customer_id, ent_id, invoice_number, subtotal, tax, total, status, due_date)
     SELECT $1::uuid, (SELECT id FROM customers WHERE org_id = $1::uuid AND email = 'buy@northwind.test'), $2::uuid, 'INV-1002', 1200.00, 60.00, 1260.00, 'pending', NOW() + INTERVAL '15 days'
     WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE org_id = $1::uuid AND invoice_number = 'INV-1002')`,
    [org.id, entity.id],
  );
  if (addedInvoice.rowCount > 0) seeded++;
  const hasPayment = await exists(`SELECT 1 FROM payments WHERE invoice_id = $1`, [paidInvoice.id]);
  if (!hasPayment) {
    await q(
      `INSERT INTO payments (org_id, invoice_id, amount, payment_method, transaction_id, status, paid_at, transaction_fee)
       VALUES ($1, $2, 472.50, 'bank_transfer', 'SEED-TXN-0001', 'completed', NOW() - INTERVAL '8 days', 2.50)`,
      [org.id, paidInvoice.id],
    );
    seeded++;
  }
  console.log("invoices: INV-1001 (paid + payment), INV-1002 (pending)");

  // ---- notifications for the admin user ----
  for (const [type, title, message, read] of [
    ["new_delivery", "New delivery TRK-1001", "Global Supplies created a pending delivery to Mumbai Central Hub.", false],
    ["status_update", "TRK-1004 delivered", "Sunrise Retail shipment was delivered at Ahmedabad Depot.", true],
  ]) {
    const added = await q(
      `INSERT INTO notifications (user_id, org_id, ent_id, type, title, message, related_type, read, read_at, action_url)
       SELECT $1::uuid, $2::uuid, NULL, $3::varchar, $4::varchar, $5::varchar, 'delivery', $6::boolean, CASE WHEN $6::boolean THEN NOW() ELSE NULL END, '/deliveries'
       WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = $1::uuid AND org_id = $2::uuid AND title = $4::varchar)`,
      [adminId, org.id, type, title, message, read],
    );
    if (added.rowCount > 0) seeded++;
  }
  console.log("notifications: 2 for admin (1 unread, 1 read)");

  // ---- alert (low stock) ----
  const addedAlert = await q(
    `INSERT INTO alerts (org_id, ent_id, type, severity, title, message, related_id, related_type)
     SELECT $1::uuid, $2::uuid, 'low_stock', 'high', 'Low stock: Gadget', 'SKU-002 has 4 units left (minimum 10).', $3::uuid, 'product'
     WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE org_id = $1::uuid AND title = 'Low stock: Gadget')`,
    [org.id, entity.id, productIds[1]],
  );
  if (addedAlert.rowCount > 0) seeded++;
  console.log("alerts: 1 unresolved low-stock alert");

  // ---- webhook subscription + one delivery log ----
  let sub = (await q(`SELECT id FROM webhook_subscriptions WHERE org_id = $1 AND url = $2`, [org.id, "https://example.com/hooks/acme"])).rows[0];
  if (!sub) {
    sub = (
      await q(
        `INSERT INTO webhook_subscriptions (org_id, url, secret, events)
         VALUES ($1, 'https://example.com/hooks/acme', $2, ARRAY['delivery.created', 'delivery.status_changed'])
         RETURNING id`,
        [org.id, sha256("seed-webhook-secret")],
      )
    ).rows[0];
    seeded++;
  }
  const hasHookLog = await exists(`SELECT 1 FROM webhook_deliveries WHERE subscription_id = $1`, [sub.id]);
  if (!hasHookLog) {
    await q(
      `INSERT INTO webhook_deliveries (subscription_id, event_type, payload, response_status, response_body, succeeded)
       VALUES ($1, 'delivery.created', $2::jsonb, 200, '{"ok":true}', TRUE)`,
      [sub.id, JSON.stringify({ event: "delivery.created", tracking_number: "TRK-1001" })],
    );
    seeded++;
  }
  console.log("webhooks: 1 subscription + 1 successful delivery log");

  // ---- api key (plain key printed once; only its sha256 is stored) ----
  const addedKey = await q(
    `INSERT INTO api_keys (org_id, name, key_hash, permission_scopes)
     SELECT $1::uuid, 'Seed Test Key', $2::varchar, ARRAY['deliveries:read', 'deliveries:write']
     WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE org_id = $1::uuid AND name = 'Seed Test Key')`,
    [org.id, sha256(API_KEY_PLAIN)],
  );
  if (addedKey.rowCount > 0) seeded++;
  console.log(`api_keys: 'Seed Test Key' (plain key for testing: ${API_KEY_PLAIN})`);

  // ---- audit log ----
  const addedAudit = await q(
    `INSERT INTO audit_logs (user_id, org_id, action, resource_type, resource_id, ip_address)
     SELECT $1::uuid, $2::uuid, 'seed', 'system', NULL, '127.0.0.1'
     WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE org_id = $2::uuid AND action = 'seed')`,
    [adminId, org.id],
  );
  if (addedAudit.rowCount > 0) seeded++;
  console.log("audit_logs: 1 seed entry");

  // ---- AI conversation + messages ----
  let conv = (await q(`SELECT id FROM ai_conversations WHERE org_id = $1 AND title = 'Seed conversation'`, [org.id])).rows[0];
  if (!conv) {
    conv = (
      await q(
        `INSERT INTO ai_conversations (org_id, user_id, title) VALUES ($1, $2, 'Seed conversation') RETURNING id`,
        [org.id, adminId],
      )
    ).rows[0];
    seeded++;
  }
  const hasMessages = await exists(`SELECT 1 FROM ai_messages WHERE conversation_id = $1`, [conv.id]);
  if (!hasMessages) {
    await q(
      `INSERT INTO ai_messages (conversation_id, role, content) VALUES
       ($1, 'user', 'How many deliveries are pending?'),
       ($1, 'assistant', 'There is 1 pending delivery.')`,
      [conv.id],
    );
    seeded++;
  }
  console.log("ai_conversations/ai_messages: 1 conversation with 2 messages");

  // ---- tokens (inert: both consumed, no live credentials in the repo) ----
  const resetHash = sha256("seed-reset-token-consumed");
  const addedReset = await q(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at)
     SELECT $1::uuid, $2::varchar, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '2 hours'
     WHERE NOT EXISTS (SELECT 1 FROM password_reset_tokens WHERE token_hash = $2::varchar)`,
    [adminId, resetHash],
  );
  if (addedReset.rowCount > 0) seeded++;
  const refreshHash = sha256("seed-refresh-token-revoked");
  const addedRefresh = await q(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at, user_agent, ip_address)
     SELECT $1::uuid, $2::varchar, NOW() + INTERVAL '30 days', NOW(), 'seed', '127.0.0.1'
     WHERE NOT EXISTS (SELECT 1 FROM refresh_tokens WHERE token_hash = $2::varchar)`,
    [adminId, refreshHash],
  );
  if (addedRefresh.rowCount > 0) seeded++;
  console.log("tokens: 1 consumed reset token, 1 revoked refresh token (no live credentials)");

  // ---- permissions sanity (seeded by migrations — report only) ----
  const permCount = (await q(`SELECT COUNT(*)::int AS n FROM permissions`)).rows[0].n;
  console.log(`permissions: ${permCount} (seeded by migrations)`);
}

try {
  await seed();
  console.log(`\nSeed complete ✓ (${seeded} rows inserted; re-runs insert nothing)`);
  console.log("Login with: admin@acme.test / Passw0rd!123");
} catch (err) {
  console.error(`Seed failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
