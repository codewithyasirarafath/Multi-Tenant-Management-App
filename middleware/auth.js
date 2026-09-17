import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { userHasPermission } from '../models/Permissionmodel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
};

export const getUserMemberships = async (userId) => {
  const result = await pool.query(
    `SELECT 
        um.id AS membership_id,
        um.org_id,
        um.ent_id,
        um.role_id,
        um.is_active,
        o.org_code,
        o.name AS org_name,
        o.slug AS org_slug,
        e.ent_code,
        e.name AS entity_name,
        e.code AS entity_code,
        r.name AS role_name,
        r.description AS role_description
     FROM user_memberships um
     JOIN organizations o ON o.id = um.org_id
     LEFT JOIN entities e ON e.id = um.ent_id
     JOIN roles r ON r.id = um.role_id
     WHERE um.user_id = $1 AND um.is_active = TRUE AND o.is_active = TRUE
     ORDER BY o.org_code, e.ent_code`,
    [userId]
  );
  return result.rows;
};

export const getMembershipCodes = async (userId) => {
  const result = await pool.query(
    `SELECT (o.org_code * 1000 + COALESCE(e.ent_code, 0)) AS membership_code
     FROM user_memberships um
     JOIN organizations o ON o.id = um.org_id
     LEFT JOIN entities e ON e.id = um.ent_id
     WHERE um.user_id = $1 AND um.is_active = TRUE AND o.is_active = TRUE
     ORDER BY o.org_code, e.ent_code`,
    [userId]
  );
  return result.rows.map(r => r.membership_code);
};

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header missing or invalid');
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);

    const memberships = await getUserMemberships(decoded.userId);
    
    if (memberships.length === 0) {
      throw new ForbiddenError('User has no active memberships');
    }

    req.auth = {
      userId: decoded.userId,
      email: decoded.email,
      memberships,
      membershipCodes: memberships.map(m => m.org_code * 1000 + (m.ent_code || 0))
    };

    next();
  } catch (err) {
    next(err);
  }
};

export const requireOrgAccess = (req, res, next) => {
  const { orgId } = req.params;
  if (!orgId) return next();

  const hasAccess = req.auth.memberships.some(m => m.org_id === orgId);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this organization');
  }

  req.auth.currentOrgId = orgId;
  req.auth.currentOrgMemberships = req.auth.memberships.filter(m => m.org_id === orgId);
  next();
};

export const requireEntityAccess = (req, res, next) => {
  const { orgId, entId } = req.params;
  if (!entId) return next();

  const hasAccess = req.auth.memberships.some(
    m => m.org_id === orgId && m.ent_id === entId
  );
  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this entity');
  }

  req.auth.currentEntId = entId;
  next();
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRoles = req.auth.memberships.map(m => m.role_name);
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenError(`Requires one of roles: ${allowedRoles.join(', ')}`);
    }
    next();
  };
};

export const requireOrgRole = (...allowedRoles) => {
  return (req, res, next) => {
    const orgId = req.params.orgId || req.auth.currentOrgId;
    if (!orgId) return next();

    const orgMemberships = req.auth.memberships.filter(m => m.org_id === orgId);
    const userRoles = orgMemberships.map(m => m.role_name);
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      throw new ForbiddenError(`Requires one of roles in this org: ${allowedRoles.join(', ')}`);
    }
    next();
  };
};

export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    const orgId = req.params.orgId || req.auth.currentOrgId;
    if (!orgId) return next();

    const hasPermission = await userHasPermission(req.auth.userId, orgId, permissionName);
    if (!hasPermission) {
      throw new ForbiddenError(`Requires permission: ${permissionName}`);
    }
    next();
  };
};

export const requireAnyPermission = (...permissionNames) => {
  return async (req, res, next) => {
    const orgId = req.params.orgId || req.auth.currentOrgId;
    if (!orgId) return next();

    const userPermissions = await getUserPermissions(req.auth.userId, orgId);
    const userPermissionNames = userPermissions.map(p => p.name);
    const hasPermission = permissionNames.some(p => userPermissionNames.includes(p));
    
    if (!hasPermission) {
      throw new ForbiddenError(`Requires one of permissions: ${permissionNames.join(', ')}`);
    }
    next();
  };
};

const getUserPermissions = async (userId, orgId) => {
  const result = await pool.query(
    `SELECT DISTINCT p.name FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_memberships um ON um.role_id = rp.role_id
     WHERE um.user_id = $1 AND um.org_id = $2 AND um.is_active = TRUE`,
    [userId, orgId],
  );
  return result.rows;
};