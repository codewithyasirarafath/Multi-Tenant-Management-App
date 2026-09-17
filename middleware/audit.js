import { logAudit } from "../models/Auditmodel.js";

export const auditMiddleware = (action, resourceType, getResourceId = (req) => req.params.id) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    let responseBody;
    
    res.json = function(body) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    try {
      await next();
      
      // Only log on successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const resourceId = getResourceId(req);
        
        await logAudit({
          userId: req.auth?.userId,
          orgId: req.params.orgId || req.auth?.currentOrgId,
          entId: req.params.entId || req.auth?.currentEntId,
          action,
          resourceType,
          resourceId,
          newValues: responseBody,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          requestId: req.requestId,
        }).catch(err => console.error("Audit log failed:", err));
      }
    } catch (err) {
      // Log failed attempts too
      const resourceId = getResourceId(req);
      await logAudit({
        userId: req.auth?.userId,
        orgId: req.params.orgId || req.auth?.currentOrgId,
        entId: req.params.entId || req.auth?.currentEntId,
        action: `${action}.failed`,
        resourceType,
        resourceId,
        newValues: { error: err.message },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        requestId: req.requestId,
      }).catch(err => console.error("Audit log failed:", err));
      throw err;
    }
  };
};

// Convenience functions for common operations
export const auditCreate = (resourceType) => auditMiddleware(`${resourceType}.created`, resourceType);
export const auditUpdate = (resourceType) => auditMiddleware(`${resourceType}.updated`, resourceType);
export const auditDelete = (resourceType) => auditMiddleware(`${resourceType}.deleted`, resourceType);
export const auditStatusChange = (resourceType) => auditMiddleware(`${resourceType}.status_changed`, resourceType);