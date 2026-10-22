import express from "express";
import * as userController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.user.list), userController.getUsers);
router.get("/:id", validate(schemas.user.get), userController.getUser);
router.post("/", validate(schemas.user.create), userController.addUser);
router.put("/:id", validate(schemas.user.update), userController.editUser);
router.delete("/:id", validate(schemas.user.get), userController.removeUser);

export default router;