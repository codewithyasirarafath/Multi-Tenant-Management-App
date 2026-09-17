import * as userMembershipModel from "../models/UserMembershipmodel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getUserMemberships = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const memberships = await userMembershipModel.getMembershipsForUser(userId);
  res.status(200).json(memberships);
});

const getUserMembershipCodes = asyncHandler(async (req, res) => {
  const { email } = req.validated.body;
  const user = await userMembershipModel.getUserByEmailWithMemberships(email);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  const codes = user.memberships
    ?.filter(m => m.is_active)
    .map(m => m.org_code * 1000 + (m.ent_code || 0)) || [];
  
  res.status(200).json({ email, membershipCodes: codes });
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