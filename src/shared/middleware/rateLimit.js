import rateLimit from "express-rate-limit";

const createRateLimiter = (options = {}) => {
  const {
    max = options.max || 100,
    windowMs = options.windowMs || 15 * 60 * 1000,
    // role-based limits default
    roleLimits = options.roleLimits || {
      // default limits if no role match
      default: max,
      org_admin: max * 5,
      ent_manager: max * 3,
      staff: max / 2,
      delivery_agent: max / 4,
      guest: max / 10,
    },
    keyGenerator = options.keyGenerator || ((req) => req.ip),
  } = options;

  // Determine the rate limit based on user role from auth
  return rateLimit({
    windowMs,
    max: roleLimits[options.roleKey] || roleLimits.default,
    message: { error: "Too many requests, please try again later" },
    statusCode: 429,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new Error("Too many requests, please try again later"));
    },
    skip: options.skip || (() => false),
    keyGenerator: (req) => {
      // Try to get role key from auth
      const authRole = req.auth?.role_name;
      return keyGenerator(req);
    },
  });
};

// Global limiter - same for all
export const globalRateLimiter = createRateLimiter({
  max: 200,
  windowMs: 15 * 60 * 1000,
});

// Auth limiter - stricter for auth endpoints
export const authRateLimiter = createRateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  roleKey: "role_name", // use role_name from req.auth
});

// API limiter - per-org based
export const apiRateLimiter = createRateLimiter({
  max: 60,
  windowMs: 60 * 1000,
  roleKey: "role_name",
  roleLimits: {
    default: 60,
    org_admin: 200,
    ent_manager: 100,
    staff: 30,
    delivery_agent: 20,
  },
});

// Org-scoped limiter - based on org_id + role
export const createOrgScopedLimiter = (max = 100, windowMs = 60 * 1000, roleKey = "role_name") => {
  return createRateLimiter({
    max,
    windowMs,
    roleKey,
    keyGenerator: (req) => `${req.auth?.userId || req.ip}:${req.params.orgId}`,
  });
};

export default createRateLimiter;