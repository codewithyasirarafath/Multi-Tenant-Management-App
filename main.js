import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import pool from "./src/shared/config/db.js";
import organizationRoutes from "./src/organizations/routes.js";
import entityRoutes from "./src/entities/routes.js";
import userRoutes from "./src/users/routes.js";
import roleRoutes from "./src/roles/routes.js";
import userRoleRoutes from "./src/memberships/routes.js";
import deliveryRoutes from "./src/deliveries/routes.js";
import aiChatRoutes from "./src/ai-chat/routes.js";
import authRoutes from "./src/auth/routes.js";
import permissionRoutes from "./src/permissions/routes.js";
import webhookRoutes from "./src/webhooks/routes.js";
import apiKeyRoutes from "./src/api-keys/routes.js";
import inventoryRoutes from "./src/inventory/routes.js";
import customerRoutes from "./src/customers/routes.js";
import invoicingRoutes from "./src/invoicing/routes.js";
import notificationRoutes from "./src/notifications/routes.js";
import {
  globalRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  createOrgScopedLimiter,
} from "./src/shared/middleware/rateLimit.js";
import { sanitizeBody, sanitizeParams, sanitizeQuery } from "./src/shared/utils/sanitize.js";
import { requestLogger, requestIdMiddleware } from "./src/shared/middleware/logger.js";
import { errorHandler, notFoundHandler } from "./src/shared/middleware/errorHandler.js";
import { authMiddleware, requireOrgAccess } from "./src/shared/middleware/auth.js";
import { swaggerSpec } from "./src/shared/config/swagger.js";
import swaggerUi from "swagger-ui-express";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(globalRateLimiter);

// --- Sanitization Middleware (applies to ALL routes) ---
app.use(sanitizeBody());
app.use(sanitizeParams());
app.use(sanitizeQuery());

// --- Auth for all org-scoped routes (prefix match covers every sub-mount) ---
app.use("/api/v1/organizations", authMiddleware);
app.use("/api/v1/organizations/:orgId", requireOrgAccess);
app.use("/api/v2/organizations", authMiddleware);
app.use("/api/v2/organizations/:orgId", requireOrgAccess);

// v1 Routes with org-scoped rate limiting
app.use("/api/v1/auth", authRateLimiter, authRoutes);
app.use("/api/v1/organizations", apiRateLimiter, organizationRoutes);
app.use("/api/v1/organizations/:orgId/entities", apiRateLimiter, entityRoutes);
app.use("/api/v1/organizations/:orgId/users", apiRateLimiter, userRoutes);
app.use("/api/v1/organizations/:orgId/roles", apiRateLimiter, roleRoutes);
app.use("/api/v1/organizations/:orgId/permissions", apiRateLimiter, permissionRoutes);
app.use("/api/v1/organizations/:orgId/users/:userId/memberships", apiRateLimiter, userRoleRoutes);
app.use("/api/v1/organizations/:orgId/deliveries", createOrgScopedLimiter(100, 60 * 1000), deliveryRoutes);
app.use("/api/v1/organizations/:orgId/ai-chat", createOrgScopedLimiter(50, 60 * 1000), aiChatRoutes);
app.use("/api/v1/organizations/:orgId/webhooks", createOrgScopedLimiter(50, 60 * 1000), webhookRoutes);
app.use("/api/v1/api-keys", apiRateLimiter, apiKeyRoutes);
app.use("/api/v1/organizations/:orgId/inventory", apiRateLimiter, inventoryRoutes);
app.use("/api/v1/organizations/:orgId/customers", apiRateLimiter, customerRoutes);
app.use("/api/v1/organizations/:orgId/invoicing", apiRateLimiter, invoicingRoutes);
app.use("/api/v1/organizations/:orgId/notifications", apiRateLimiter, notificationRoutes);

// v2 Routes (new with per-tier rate limiting)
app.use("/api/v2/auth", authRateLimiter, authRoutes);
app.use("/api/v2/organizations", apiRateLimiter, organizationRoutes);
app.use("/api/v2/organizations/:orgId/entities", apiRateLimiter, entityRoutes);
app.use("/api/v2/organizations/:orgId/users", apiRateLimiter, userRoutes);
app.use("/api/v2/organizations/:orgId/roles", apiRateLimiter, roleRoutes);
app.use("/api/v2/organizations/:orgId/permissions", apiRateLimiter, permissionRoutes);
app.use("/api/v2/organizations/:orgId/users/:userId/memberships", apiRateLimiter, userRoleRoutes);
app.use("/api/v2/organizations/:orgId/deliveries", createOrgScopedLimiter(150, 60 * 1000), deliveryRoutes);
app.use("/api/v2/organizations/:orgId/ai-chat", createOrgScopedLimiter(100, 60 * 1000), aiChatRoutes);
app.use("/api/v2/organizations/:orgId/webhooks", createOrgScopedLimiter(100, 60 * 1000), webhookRoutes);
app.use("/api/v2/organizations/:orgId/inventory", apiRateLimiter, inventoryRoutes);
app.use("/api/v2/organizations/:orgId/customers", apiRateLimiter, customerRoutes);
app.use("/api/v2/organizations/:orgId/invoicing", apiRateLimiter, invoicingRoutes);
app.use("/api/v2/organizations/:orgId/notifications", apiRateLimiter, notificationRoutes);

// Deprecation notice for v1
app.use((req, res, next) => {
  if (req.path.startsWith("/api/v1/")) {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", "2025-12-31T00:00:00.000Z");
    res.setHeader("Link", "</api/v2/>; rel=" + '"' + "successor" + '"');
  }
  next();
});

// Swagger docs serve both v1 and v2 specs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.status(200).json({ status: "ok", dbTime: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});