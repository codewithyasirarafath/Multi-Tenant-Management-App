import express from "express";
import * as organizationController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";

const router = express.Router();

router.get("/", organizationController.getOrganizations);
router.get("/:id", validate(schemas.organization.get), organizationController.getOrganization);
router.post("/", validate(schemas.organization.create), organizationController.addOrganization);
router.put("/:id", validate(schemas.organization.update), organizationController.editOrganization);
router.delete("/:id", validate(schemas.organization.get), organizationController.removeOrganization);

export default router;