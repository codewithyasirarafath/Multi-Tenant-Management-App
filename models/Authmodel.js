import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 12;
const RESET_TOKEN_BYTES = 32;
const REFRESH_TOKEN_BYTES = 64;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const generateToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

const hashPassword = async (password) => bcrypt.hash(password, SALT_ROUNDS);
const verifyPassword = async (password, hash) => bcrypt.compare(password, hash);

const createUserWithPassword = async (email, password, firstName, lastName, mobile) => {
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, mobile)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, mobile, is_active, created_at`,
    [email, passwordHash, firstName, lastName, mobile],
  );
  return result.rows[0];
};

const getUserByEmailForAuth = async (email) => {
  const result = await pool.query(
    `SELECT id, email, password_hash, first_name, last_name, mobile, is_active
     FROM users WHERE email = $1`,
    [email],
  );
  return result.rows[0];
};

const getUserById = async (userId) => {
  const result = await pool.query(
    `SELECT id, email, first_name, last_name, mobile, is_active, created_at
     FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0];
};

const updateUserPassword = async (userId, newPassword) => {
  const passwordHash = await hashPassword(newPassword);
  const result = await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email`,
    [passwordHash, userId],
  );
  return result.rows[0];
};

// ============================================
// PASSWORD RESET
// ============================================
const createPasswordResetToken = async (userId) => {
  const token = generateToken(RESET_TOKEN_BYTES);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  return { token, expiresAt };
};

const verifyPasswordResetToken = async (token) => {
  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT prt.*, u.email, u.id AS user_id
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1 AND prt.expires_at > NOW() AND prt.used_at IS NULL AND u.is_active = TRUE`,
    [tokenHash],
  );
  return result.rows[0];
};

const consumePasswordResetToken = async (token) => {
  const tokenHash = hashToken(token);
  const result = await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL RETURNING user_id`,
    [tokenHash],
  );
  return result.rows[0]?.user_id;
};

const resetPasswordWithToken = async (token, newPassword) => {
  const tokenHash = hashToken(token);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `SELECT user_id FROM password_reset_tokens 
       WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [tokenHash],
    );
    if (tokenResult.rows.length === 0) {
      throw new Error("Invalid or expired reset token");
    }
    const userId = tokenResult.rows[0].user_id;

    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [await hashPassword(newPassword), userId],
    );

    await client.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );

    // Revoke all refresh tokens for security
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );

    await client.query("COMMIT");
    return { userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ============================================
// REFRESH TOKENS (Rotation)
// ============================================
const createRefreshToken = async (userId, userAgent, ipAddress) => {
  const token = generateToken(REFRESH_TOKEN_BYTES);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent || null, ipAddress || null],
  );

  return { token, expiresAt };
};

const verifyRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT rt.*, u.email, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND rt.revoked_at IS NULL AND u.is_active = TRUE`,
    [tokenHash],
  );
  return result.rows[0];
};

const rotateRefreshToken = async (oldToken, userAgent, ipAddress) => {
  const oldTokenHash = hashToken(oldToken);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `SELECT user_id FROM refresh_tokens 
       WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
      [oldTokenHash],
    );
    if (tokenResult.rows.length === 0) {
      throw new Error("Invalid or expired refresh token");
    }
    const userId = tokenResult.rows[0].user_id;

    // Revoke old token
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_token_hash = $1 WHERE token_hash = $2`,
      [hashToken(generateToken()), oldTokenHash], // placeholder, will update below
    );

    // Create new token
    const newToken = generateToken(REFRESH_TOKEN_BYTES);
    const newTokenHash = hashToken(newToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await client.query(
      `UPDATE refresh_tokens SET replaced_by_token_hash = $1 WHERE token_hash = $2`,
      [newTokenHash, oldTokenHash],
    );

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, parent_token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, newTokenHash, oldTokenHash, expiresAt, userAgent || null, ipAddress || null],
    );

    await client.query("COMMIT");
    return { token: newToken, expiresAt, userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const revokeRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
    [tokenHash],
  );
};

const revokeAllRefreshTokens = async (userId) => {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
};

export {
  createUserWithPassword,
  getUserByEmailForAuth,
  getUserById,
  verifyPassword,
  updateUserPassword,
  createPasswordResetToken,
  verifyPasswordResetToken,
  consumePasswordResetToken,
  resetPasswordWithToken,
  createRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  hashToken,
  generateToken,
};