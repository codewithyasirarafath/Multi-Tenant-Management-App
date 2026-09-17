import express from "express";
import * as roleController from "../controllers/Rolecontroller.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.role.list), roleController.getRoles);
router.post("/", validate(schemas.role.create), roleController.addRole);

export default router;