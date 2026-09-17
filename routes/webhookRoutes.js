import express from "express";
import * as webhookController from "../controllers/Webhookcontroller.js";
import { validate } from "../middleware/validation.js";
import { authMiddleware, requireOrgAccess } from "../middleware/auth.js";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router({ mergeParams: true });

const webhookSchemas = {
  create: z.object({
    body: z.object({
      url: z.string().url(),
      events: z.array(z.string()).min(1),
    }),
    params: z.object({
      orgId: z.string().uuid(),
    }),
  }),
  update: z.object({
    body: z.object({
      url: z.string().url().optional(),
      events: z.array(z.string()).min(1).optional(),
      isActive: z.boolean().optional(),
    }),
    params: z.object({
      orgId: z.string().uuid(),
      webhookId: z.string().uuid(),
    }),
  }),
  get: z.object({
    params: z.object({
      orgId: z.string().uuid(),
      webhookId: z.string().uuid(),
    }),
  }),
  list: z.object({
    params: z.object({
      orgId: z.string().uuid(),
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  }),
  deliveries: z.object({
    params: z.object({
      orgId: z.string().uuid(),
      webhookId: z.string().uuid(),
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  }),
};

router.get("/", authMiddleware, requireOrgAccess, validate(webhookSchemas.list), webhookController.getWebhooks);
router.get("/:webhookId", authMiddleware, requireOrgAccess, validate(webhookSchemas.get), webhookController.getWebhook);
router.post("/", authMiddleware, requireOrgAccess, validate(webhookSchemas.create), webhookController.createWebhook);
router.put("/:webhookId", authMiddleware, requireOrgAccess, validate(webhookSchemas.update), webhookController.updateWebhook);
router.delete("/:webhookId", authMiddleware, requireOrgAccess, validate(webhookSchemas.get), webhookController.deleteWebhook);
router.get("/:webhookId/deliveries", authMiddleware, requireOrgAccess, validate(webhookSchemas.deliveries), webhookController.getWebhookDeliveries);
router.post("/:webhookId/test", authMiddleware, requireOrgAccess, validate(webhookSchemas.get), webhookController.testWebhook);

export default router;