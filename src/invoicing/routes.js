import express from "express";
import * as invoicingController from "./controller.js";
import { validate } from "../shared/middleware/validation.js";
import { schemas } from "../shared/middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.invoicing.list), invoicingController.getAllInvoices);
router.get("/:id", validate(schemas.invoicing.get), invoicingController.getInvoiceById);
router.post("/", validate(schemas.invoicing.create), invoicingController.createInvoice);
router.put("/:id", validate(schemas.invoicing.update), invoicingController.updateInvoice);
router.get("/:id/payments", validate(schemas.invoicing.get), invoicingController.getPayments);
router.post("/:id/payments", validate(schemas.invoicing.pay), invoicingController.addPayment);

export default router;