import express from "express";
import * as userMembershipController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.userMembership.list), userMembershipController.getUserMemberships);
router.get("/codes", validate(schemas.user.getMembershipCodes), userMembershipController.getUserMembershipCodes);
router.post("/", validate(schemas.userMembership.assign), userMembershipController.assignMembership);
router.put("/:membershipId", validate(schemas.userMembership.remove), userMembershipController.updateMembership);
router.delete("/:membershipId", validate(schemas.userMembership.remove), userMembershipController.removeMembership);

export default router;