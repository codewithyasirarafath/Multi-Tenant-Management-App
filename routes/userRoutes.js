import express from "express";
import * as userController from "../controllers/userController.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.user.list), userController.getUsers);
router.get("/:id", validate(schemas.user.get), userController.getUser);
router.post("/", validate(schemas.user.create), userController.addUser);
router.put("/:id", validate(schemas.user.update), userController.editUser);
router.delete("/:id", validate(schemas.user.get), userController.removeUser);

export default router;