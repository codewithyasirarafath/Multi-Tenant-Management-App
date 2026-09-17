import express from "express";
import * as deliveryController from "../controllers/deliveryController.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.delivery.list), deliveryController.getDeliveries);
router.get("/track/:trackingNumber", validate(schemas.delivery.track), deliveryController.trackDelivery);
router.get("/:id", validate(schemas.delivery.get), deliveryController.getDelivery);
router.post("/", validate(schemas.delivery.create), deliveryController.addDelivery);
router.put("/:id", validate(schemas.delivery.update), deliveryController.editDelivery);
router.patch("/:id/status", validate(schemas.delivery.changeStatus), deliveryController.changeStatus);
router.delete("/:id", validate(schemas.delivery.get), deliveryController.removeDelivery);

export default router;