import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Connection pool tuning for production scale
  max: Number(process.env.PG_POOL_MAX) || 20,           // max concurrent clients
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT) || 30000,  // 30 seconds
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT) || 2000, // 2 seconds
  // Prevent connection leak
  allowExitIdle: false,
  // Debug mode (disable in production)
  connectionString: process.env.DATABASE_URL,
});

pool
  .connect()
  .then((client) => {
    console.log("Connected to PostgreSQL");
    client.release();
  })
  .catch((err) =>
    console.error("Error connecting to PostgreSQL:", err.message),
  );

// Export a helper to get a client from the pool with timeout
export const withClient = async (callback, timeout = 5000) => {
  const client = await pool.connect();
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Connection timeout")), timeout);
      callback(client)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          throw err;
        });
    });
    return callback(client);
  } finally {
    client.release();
  }
};

export default pool;