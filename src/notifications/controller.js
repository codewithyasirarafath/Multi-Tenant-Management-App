
import * as notificationModel from "./model.js";
import { asyncHandler } from "../shared/middleware/errorHandler.js";

const getAllNotifications = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { orgId } = req.params;
  const { limit, offset, type, read } = req.validated.query;
  const notifications = await notificationModel.getAllNotifications(userId, { limit, offset, type, read, orgId });
  res.status(200).json(notifications);
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const count = await notificationModel.getUnreadCount(userId);
  res.status(200).json({ unreadCount: Number(count) });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { notificationId } = req.validated.body;
  const updated = await notificationModel.markNotificationRead(notificationId, userId);
  if (!updated) return res.status(404).json({ error: "Notification not found" });
  res.status(200).json(updated);
});

const getAllAlerts = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { entId, type, severity, isResolved } = req.validated.query;
  const alerts = await notificationModel.getAllAlerts(orgId, { entId, type, severity, isResolved });
  res.status(200).json(alerts);
});

export { getAllNotifications, getUnreadCount, markNotificationRead, getAllAlerts };
