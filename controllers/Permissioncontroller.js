import * as permissionModel from "../models/Permissionmodel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await permissionModel.getAllPermissions();
  res.status(200).json(permissions);
});

const getRolePermissions = asyncHandler(async (req, res) => {
  const { roleId } = req.params;
  const permissions = await permissionModel.getPermissionsForRole(roleId);
  res.status(200).json(permissions);
});

const assignPermission = asyncHandler(async (req, res) => {
  const { roleId } = req.params;
  const { permissionId } = req.validated.body;
  const assignment = await permissionModel.assignPermissionToRole(roleId, permissionId);
  res.status(201).json(assignment);
});

const removePermission = asyncHandler(async (req, res) => {
  const { roleId, permissionId } = req.params;
  const removed = await permissionModel.removePermissionFromRole(roleId, permissionId);
  if (!removed) return res.status(404).json({ error: "Permission assignment not found" });
  res.status(200).json({ message: "Permission removed from role", assignment: removed });
});

const getMyPermissions = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const permissions = await permissionModel.getUserPermissions(req.auth.userId, orgId);
  res.status(200).json(permissions);
});

export { getPermissions, getRolePermissions, assignPermission, removePermission, getMyPermissions };