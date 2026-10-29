import * as userMembershipModel from "./model.js";
import { asyncHandler } from "../shared/middleware/errorHandler.js";

const getUserMemberships = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const memberships = await userMembershipModel.getMembershipsForUser(userId);
  res.status(200).json(memberships);
});

const getUserMembershipCodes = asyncHandler(async (req, res) => {
  // Org-scoped GET: codes for the URL's user within this organization.
  const { orgId, userId } = req.params;
  const codes = await userMembershipModel.getMembershipCodes(userId, orgId);
  res.status(200).json(codes);
});

const assignMembership = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { orgId, entId, roleId } = req.validated.body;
  const membership = await userMembershipModel.assignMembership(userId, orgId, roleId, entId);
  res.status(201).json(membership);
});

const updateMembership = asyncHandler(async (req, res) => {
  const { userId, membershipId } = req.params;
  const { roleId, entId, isActive } = req.validated.body;
  const updated = await userMembershipModel.updateMembership(membershipId, userId, roleId, entId, isActive);
  if (!updated) return res.status(404).json({ error: "Membership not found" });
  res.status(200).json(updated);
});

const removeMembership = asyncHandler(async (req, res) => {
  const { userId, membershipId } = req.params;
  const removed = await userMembershipModel.removeMembership(membershipId, userId);
  if (!removed) return res.status(404).json({ error: "Membership not found" });
  res.status(200).json({ message: "Membership removed", membership: removed });
});

export { getUserMemberships, getUserMembershipCodes, assignMembership, updateMembership, removeMembership };