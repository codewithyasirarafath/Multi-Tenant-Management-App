import express from "express";
import * as notificationController from "../controllers/notificationController.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.notification.list), notificationController.getAllNotifications);
router.get("/unread-count", validate(schemas.notification.list), notificationController.getUnreadCount);
router.patch("/mark-read", validate(schemas.notification.markRead), notificationController.markNotificationRead);
router.get("/alerts", validate(schemas.notification.list), notificationController.getAllAlerts);

export default router;