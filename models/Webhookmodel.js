import pool from "../config/db.js";
import crypto from "crypto";

const getWebhookSubscriptions = async (orgId, { limit = 50, offset = 0 } = {}) => {
  const result = await pool.query(
    `SELECT * FROM webhook_subscriptions 
     WHERE org_id = $1
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [orgId, limit, offset],
  );
  return result.rows;
};

const getWebhookSubscriptionById = async (subscriptionId, orgId) => {
  const result = await pool.query(
    `SELECT * FROM webhook_subscriptions WHERE id = $1 AND org_id = $2`,
    [subscriptionId, orgId],
  );
  return result.rows[0];
};

const createWebhookSubscription = async (orgId, url, secret, events) => {
  const result = await pool.query(
    `INSERT INTO webhook_subscriptions (org_id, url, secret, events)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [orgId, url, secret, events],
  );
  return result.rows[0];
};

const updateWebhookSubscription = async (subscriptionId, orgId, url, events, isActive) => {
  const result = await pool.query(
    `UPDATE webhook_subscriptions
     SET url = $1, events = $2, is_active = $3, updated_at = NOW()
     WHERE id = $4 AND org_id = $5 RETURNING *`,
    [url, events, isActive, subscriptionId, orgId],
  );
  return result.rows[0];
};

const deleteWebhookSubscription = async (subscriptionId, orgId) => {
  const result = await pool.query(
    `DELETE FROM webhook_subscriptions WHERE id = $1 AND org_id = $2 RETURNING *`,
    [subscriptionId, orgId],
  );
  return result.rows[0];
};

const getActiveSubscriptionsForEvent = async (orgId, eventType) => {
  const result = await pool.query(
    `SELECT * FROM webhook_subscriptions 
     WHERE org_id = $1 AND is_active = TRUE AND $2 = ANY(events)`,
    [orgId, eventType],
  );
  return result.rows;
};

const logWebhookDelivery = async (subscriptionId, eventType, payload, responseStatus, responseBody, succeeded, attemptCount = 1) => {
  const nextRetryAt = succeeded ? null : new Date(Date.now() + Math.min(attemptCount * 60000, 3600000)); // exponential backoff max 1 hour
  
  const result = await pool.query(
    `INSERT INTO webhook_deliveries (subscription_id, event_type, payload, response_status, response_body, attempt_count, next_retry_at, succeeded)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [subscriptionId, eventType, JSON.stringify(payload), responseStatus, responseBody, attemptCount, nextRetryAt, succeeded],
  );
  return result.rows[0];
};

const getWebhookDeliveries = async (subscriptionId, { limit = 50, offset = 0 } = {}) => {
  const result = await pool.query(
    `SELECT * FROM webhook_deliveries 
     WHERE subscription_id = $1
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [subscriptionId, limit, offset],
  );
  return result.rows;
};

const signPayload = (secret, payload) => {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
};

const verifySignature = (secret, payload, signature) => {
  const expected = signPayload(secret, payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

const triggerWebhooks = async (orgId, eventType, payload) => {
  const subscriptions = await getActiveSubscriptionsForEvent(orgId, eventType);
  
  for (const sub of subscriptions) {
    const signedPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    };
    const signature = signPayload(sub.secret, signedPayload);
    
    try {
      const response = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": eventType,
          "User-Agent": "DeliveryApp-Webhook/1.0",
        },
        body: JSON.stringify(signedPayload),
      });
      
      await logWebhookDelivery(
        sub.id,
        eventType,
        signedPayload,
        response.status,
        await response.text().catch(() => ""),
        response.ok
      );
    } catch (err) {
      await logWebhookDelivery(
        sub.id,
        eventType,
        signedPayload,
        0,
        err.message,
        false
      );
    }
  }
};

export {
  getWebhookSubscriptions,
  getWebhookSubscriptionById,
  createWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
  getActiveSubscriptionsForEvent,
  logWebhookDelivery,
  getWebhookDeliveries,
  signPayload,
  verifySignature,
  triggerWebhooks,
};