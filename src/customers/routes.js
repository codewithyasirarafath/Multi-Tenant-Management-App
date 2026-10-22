import express from "express";
import * as customerController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.customer.list), customerController.getAllCustomers);
router.get("/:id", validate(schemas.customer.get), customerController.getCustomerById);
router.post("/", validate(schemas.customer.create), customerController.createCustomer);
router.put("/:id", validate(schemas.customer.update), customerController.updateCustomer);
router.delete("/:id", validate(schemas.customer.get), customerController.deleteCustomer);

export default router;