import express from "express";
import * as notificationController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";
import { authMiddleware, requireOrgAccess } from "../shared/middleware/auth.js";

const router = express.Router({ mergeParams: true });

router.get("/", authMiddleware, requireOrgAccess, validate(schemas.notification.list), notificationController.getAllNotifications);
router.get("/unread-count", authMiddleware, requireOrgAccess, validate(schemas.notification.unreadCount), notificationController.getUnreadCount);
router.get("/alerts", authMiddleware, requireOrgAccess, validate(schemas.notification.alerts), notificationController.getAllAlerts);
router.patch("/mark-read", authMiddleware, requireOrgAccess, validate(schemas.notification.markRead), notificationController.markNotificationRead);

export default router;
