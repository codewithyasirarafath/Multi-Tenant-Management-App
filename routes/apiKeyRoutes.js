import * as apiKeyModel from "../models/ApiKeymodel.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router();

// --- Generate new API key (org admin only) ---
const generateApiKey = asyncHandler(async (req, res) => {
  const { name, permissionScopes } = req.validated.body;
  const orgId = req.params.orgId;

  // Check org admin access
  const hasAdminAccess = req.auth.memberships.some(
    (m) => m.org_id === orgId && m.role_name === 'org_admin'
  );
  if (!hasAdminAccess) {
    throw new ForbiddenError('Requires org_admin role');
  }

  const result = await apiKeyModel.generateApiKey(orgId, name, permissionScopes);
  res.status(201).json({
    key: result.keyPrefix,
    name: result.name,
    permissionScopes: result.permissionScopes,
    expiresAt: result.expiresAt,
    createdAt: result.createdAt,
  });
});

// --- List API keys for org ---
const listApiKeys = asyncHandler(async (req, res) => {
  const orgId = req.params.orgId;
  const keys = await apiKeyModel.listApiKeys(orgId);
  // Don't return key hashes in list view
  const safeKeys = keys.map(k => ({ ...k, key_hash: undefined }));
  res.status(200).json(safeKeys);
});

// --- Get single API key ---
const getApiKey = asyncHandler(async (req, res) => {
  const { orgId, keyId } = req.params;
  const key = await apiKeyModel.getApiKey(keyId, orgId);
  if (!key) throw new NotFoundError("API key not found");
  res.status(200).json(key);
});

// --- Revoke API key ---
const revokeApiKey = asyncHandler(async (req, res) => {
  const { orgId, keyId } = req.params;
  const removed = await apiKeyModel.revokeApiKey(keyId, orgId);
  if (!removed) throw new NotFoundError("API key not found");
  res.status(200).json({ message: "API key revoked" });
});

// --- Validate API key (for incoming requests) ---
const validateIncomingApiKey = asyncHandler(async (req, res, next) => {
  const { key } = req.validated.body || {};
  if (!key) {
    throw new UnauthorizedError('API key required');
  }

  // Simple hash validation - in production, use constant-time comparison
  const result = await apiKeyModel.validateApiKey(key);
  if (!result.rows.length) {
    throw new UnauthorizedError('Invalid API key');
  }

  const keyData = result.rows[0];
  // Attach org info to request for middleware use
  req.apiKeyOrgId = keyData.org_id;
  req.apiKeyPermissions = keyData.permission_scopes;
  next();
});

const apiKeySchemas = {
  generate: z.object({
    body: z.object({
      name: z.string().min(1).max(100),
      permissionScopes: z.array(z.string()).optional(),
    }),
  }),
  validate: z.object({
    body: z.object({
      key: z.string().min(1),
    }),
  }),
};

router.post("/", authMiddleware, requireOrgAccess, validate(schemas.apiKey.generate), asyncHandler(generateApiKey));
router.get("/", authMiddleware, requireOrgAccess, listApiKeys);
router.get("/:keyId", authMiddleware, requireOrgAccess, getApiKey);
router.post("/:keyId/revoke", authMiddleware, requireOrgAccess, revokeApiKey);
router.post("/validate", validate(schemas.apiKey.validate), validateIncomingApiKey);

export default router;