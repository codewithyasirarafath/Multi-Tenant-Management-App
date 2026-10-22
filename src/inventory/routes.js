import express from "express";
import * as inventoryController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.inventory.list), inventoryController.getAllProducts);
router.get("/:id", validate(schemas.inventory.get), inventoryController.getProductById);
router.post("/", validate(schemas.inventory.create), inventoryController.createProduct);
router.put("/:id", validate(schemas.inventory.update), inventoryController.updateProduct);
router.delete("/:id", validate(schemas.inventory.get), inventoryController.deleteProduct);

export default router;