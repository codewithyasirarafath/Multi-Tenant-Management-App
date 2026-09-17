import express from "express";
import * as permissionController from "../controllers/Permissioncontroller.js";
import { validate } from "../middleware/validation.js";
import { z } from "zod";
import { authMiddleware, requireOrgAccess } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router({ mergeParams: true });

const permissionSchemas = {
  assign: z.object({
    body: z.object({
      permissionId: z.string().uuid(),
    }),
    params: z.object({
      roleId: z.string().uuid(),
    }),
  }),
  remove: z.object({
    params: z.object({
      roleId: z.string().uuid(),
      permissionId: z.string().uuid(),
    }),
  }),
  list: z.object({
    params: z.object({
      orgId: z.string().uuid(),
    }),
  }),
};

router.get("/", authMiddleware, requireOrgAccess, validate(permissionSchemas.list), permissionController.getPermissions);
router.get("/my-permissions", authMiddleware, requireOrgAccess, permissionController.getMyPermissions);
router.get("/roles/:roleId", authMiddleware, requireOrgAccess, permissionController.getRolePermissions);
router.post("/roles/:roleId", authMiddleware, requireOrgAccess, validate(permissionSchemas.assign), permissionController.assignPermission);
router.delete("/roles/:roleId/:permissionId", authMiddleware, requireOrgAccess, validate(permissionSchemas.remove), permissionController.removePermission);

export default router;