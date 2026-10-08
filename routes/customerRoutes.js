import express from "express";
import * as customerController from "../controllers/customerController.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.customer.list), customerController.getAllCustomers);
router.get("/:id", validate(schemas.customer.get), customerController.getCustomerById);
router.post("/", validate(schemas.customer.create), customerController.createCustomer);
router.put("/:id", validate(schemas.customer.update), customerController.updateCustomer);

export default router;