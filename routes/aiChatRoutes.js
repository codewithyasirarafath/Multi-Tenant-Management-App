import express from "express";
import * as aiController from "../controllers/Aicontroller.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";
import { authMiddleware, requireOrgAccess } from "../middleware/auth.js";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router({ mergeParams: true });

const aiChatSchemas = {
  ask: z.object({
    body: z.object({
      question: z.string().min(1).max(1000),
      conversationId: z.string().uuid().optional(),
    }),
    params: z.object({
      orgId: z.string().uuid(),
    }),
  }),
  createConversation: z.object({
    body: z.object({
      title: z.string().min(1).max(255).optional(),
    }),
    params: z.object({
      orgId: z.string().uuid(),
    }),
  }),
  updateConversation: z.object({
    body: z.object({
      title: z.string().min(1).max(255).optional(),
    }),
    params: z.object({
      orgId: z.string().uuid(),
      conversationId: z.string().uuid(),
    }),
  }),
  getConversation: z.object({
    params: z.object({
      orgId: z.string().uuid(),
      conversationId: z.string().uuid(),
    }),
  }),
  listConversations: z.object({
    params: z.object({
      orgId: z.string().uuid(),
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  }),
  listMessages: z.object({
    params: z.object({
      orgId: z.string().uuid(),
      conversationId: z.string().uuid(),
    }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  }),
};

router.post("/ask", authMiddleware, requireOrgAccess, validate(aiChatSchemas.ask), aiController.askQuestion);
router.get("/conversations", authMiddleware, requireOrgAccess, validate(aiChatSchemas.listConversations), aiController.getConversations);
router.post("/conversations", authMiddleware, requireOrgAccess, validate(aiChatSchemas.createConversation), aiController.createConversation);
router.get("/conversations/:conversationId", authMiddleware, requireOrgAccess, validate(aiChatSchemas.getConversation), aiController.getConversation);
router.put("/conversations/:conversationId", authMiddleware, requireOrgAccess, validate(aiChatSchemas.updateConversation), aiController.updateConversation);
router.delete("/conversations/:conversationId", authMiddleware, requireOrgAccess, validate(aiChatSchemas.getConversation), aiController.deleteConversation);
router.get("/conversations/:conversationId/messages", authMiddleware, requireOrgAccess, validate(aiChatSchemas.listMessages), aiController.getMessages);

export default router;