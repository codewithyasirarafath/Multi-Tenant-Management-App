import express from "express";
import * as roleController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.role.list), roleController.getRoles);
router.post("/", validate(schemas.role.create), roleController.addRole);

export default router;