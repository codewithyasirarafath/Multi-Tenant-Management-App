import express from "express";
import * as inventoryController from "../controllers/inventoryController.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.inventory.list), inventoryController.getAllProducts);
router.get("/:id", validate(schemas.inventory.get), inventoryController.getProductById);
router.post("/", validate(schemas.inventory.create), inventoryController.createProduct);
router.put("/:id", validate(schemas.inventory.update), inventoryController.updateProduct);

export default router;