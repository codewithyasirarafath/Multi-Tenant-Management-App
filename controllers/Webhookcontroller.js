import * as webhookModel from "../models/Webhookmodel.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { NotFoundError } from "../utils/errors.js";

const getWebhooks = asyncHandler(async (req, res) => {
  const { limit, offset } = req.validated.query;
  const webhooks = await webhookModel.getWebhookSubscriptions(orgId, { limit, offset });
  // Don't return secrets in list
  const safeWebhooks = webhooks.map(w => ({ ...w, secret: undefined }));
  res.status(200).json(safeWebhooks);
});

const getWebhook = asyncHandler(async (req, res) => {
  const { orgId, webhookId } = req.params;
  const webhook = await webhookModel.getWebhookSubscriptionById(webhookId, orgId);
  if (!webhook) throw new NotFoundError("Webhook subscription not found");
  // Don't return secret in response
  const { secret, ...safeWebhook } = webhook;
  res.status(200).json(safeWebhook);
});

const createWebhook = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { url, events } = req.validated.body;
  
  // Generate a secret for signing
  const crypto = await import("crypto");
  const secret = crypto.randomBytes(32).toString("hex");
  
  const webhook = await webhookModel.createWebhookSubscription(orgId, url, secret, events);
  const { secret: _, ...safeWebhook } = webhook;
  res.status(201).json(safeWebhook);
});

const updateWebhook = asyncHandler(async (req, res) => {
  const { orgId, webhookId } = req.params;
  const { url, events, isActive } = req.validated.body;
  const webhook = await webhookModel.updateWebhookSubscription(webhookId, orgId, url, events, isActive);
  if (!webhook) throw new NotFoundError("Webhook subscription not found");
  const { secret, ...safeWebhook } = webhook;
  res.status(200).json(safeWebhook);
});

const deleteWebhook = asyncHandler(async (req, res) => {
  const { orgId, webhookId } = req.params;
  const deleted = await webhookModel.deleteWebhookSubscription(webhookId, orgId);
  if (!deleted) throw new NotFoundError("Webhook subscription not found");
  res.status(200).json({ message: "Webhook subscription deleted" });
});

const getWebhookDeliveries = asyncHandler(async (req, res) => {
  const { orgId, webhookId } = req.params;
  const { limit, offset } = req.validated.query;
  
  // Verify webhook belongs to org
  const webhook = await webhookModel.getWebhookSubscriptionById(webhookId, orgId);
  if (!webhook) throw new NotFoundError("Webhook subscription not found");
  
  const deliveries = await webhookModel.getWebhookDeliveries(webhookId, { limit, offset });
  res.status(200).json(deliveries);
});

// Test webhook endpoint
const testWebhook = asyncHandler(async (req, res) => {
  const { orgId, webhookId } = req.params;
  const webhook = await webhookModel.getWebhookSubscriptionById(webhookId, orgId);
  if (!webhook) throw new NotFoundError("Webhook subscription not found");
  
  const testPayload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    data: { message: "This is a test webhook" },
  };
  
  const signature = webhookModel.signPayload(webhook.secret, testPayload);
  
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": "webhook.test",
        "User-Agent": "DeliveryApp-Webhook/1.0",
      },
      body: JSON.stringify(testPayload),
    });
    
    await webhookModel.logWebhookDelivery(
      webhookId,
      "webhook.test",
      testPayload,
      response.status,
      await response.text().catch(() => ""),
      response.ok
    );
    
    res.status(200).json({ 
      message: "Test webhook sent",
      status: response.status,
      ok: response.ok,
    });
  } catch (err) {
    await webhookModel.logWebhookDelivery(
      webhookId,
      "webhook.test",
      testPayload,
      0,
      err.message,
      false
    );
    res.status(200).json({ 
      message: "Test webhook failed",
      error: err.message,
    });
  }
});

export { 
  getWebhooks, 
  getWebhook, 
  createWebhook, 
  updateWebhook, 
  deleteWebhook, 
  getWebhookDeliveries,
  testWebhook,
};