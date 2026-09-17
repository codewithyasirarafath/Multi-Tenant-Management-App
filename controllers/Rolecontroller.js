import * as roleModel from "../models/Rolemodel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getRoles = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const roles = await roleModel.getAllRolesForOrg(orgId);
  res.status(200).json(roles);
});

const addRole = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { name, description } = req.validated.body;
  const newRole = await roleModel.createRole(orgId, name, description);
  res.status(201).json(newRole);
});

export { getRoles, addRole };