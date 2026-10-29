// Forces the test database BEFORE any app module is imported.
// dotenv (in db.js) does not override already-set env vars, so these win.
process.env.DB_NAME = "delivery_test";
process.env.NODE_ENV = "test";
// Headroom for test files that legitimately make many auth calls; the
// rate-limit suite uses its own low limit via dynamic import.
process.env.AUTH_RATE_LIMIT = "50";
