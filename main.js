import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import pool from "./config/db.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import entityRoutes from "./routes/entityRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import userRoleRoutes from "./routes/userRoleRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import aiChatRoutes from "./routes/aiChatRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import apiKeyRoutes from "./routes/apiKeyRoutes.js";
import {
  globalRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  createOrgScopedLimiter,
} from "./middleware/rateLimit.js";
import { sanitizeBody, sanitizeParams, sanitizeQuery } from "./utils/sanitize.js";
import { requestLogger, requestIdMiddleware } from "./middleware/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { swaggerSpec } from "./config/swagger.js";
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