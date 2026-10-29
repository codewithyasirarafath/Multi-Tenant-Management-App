import * as organizationModel from "./model.js";
import * as membershipModel from "../memberships/model.js";
import { asyncHandler } from "../shared/middleware/errorHandler.js";

const getOrganizations = asyncHandler(async (req, res) => {
  const orgs = await organizationModel.getAllOrganizations();
  res.status(200).json(orgs);
});

const getOrganization = asyncHandler(async (req, res) => {
  const org = await organizationModel.getOrganizationById(req.params.id);
  if (!org) return res.status(404).json({ error: "Organization not found" });
  res.status(200).json(org);
});

const addOrganization = asyncHandler(async (req, res) => {
  const { name, slug, orgCode } = req.validated.body;
  const newOrg = await organizationModel.createOrganization(name, slug, orgCode);
  // Onboarding: the creator becomes the org's first org_admin, otherwise
  // they could never access the org they just created.
  if (req.auth?.userId) {
    await membershipModel.assignMembershipAsOrgAdmin(req.auth.userId, newOrg.id);
  }
  res.status(201).json(newOrg);
});

const editOrganization = asyncHandler(async (req, res) => {
  const { name, slug, isActive } = req.validated.body;
  const updated = await organizationModel.updateOrganization(
    req.params.id,
    name,
    slug,
    isActive,
  );
  if (!updated) return res.status(404).json({ error: "Organization not found" });
  res.status(200).json(updated);
});

const removeOrganization = asyncHandler(async (req, res) => {
  const deleted = await organizationModel.deleteOrganization(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Organization not found" });
  res.status(200).json({ message: "Organization deleted", organization: deleted });
});

export {
  getOrganizations,
  getOrganization,
  addOrganization,
  editOrganization,
  removeOrganization,
};