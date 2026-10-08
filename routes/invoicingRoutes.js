import express from "express";
import * as invoicingController from "../controllers/invoicingController.js";
import { validate } from "../middleware/validation.js";
import { schemas } from "../middleware/validation.js";

const router = express.Router({ mergeParams: true });

router.get("/", validate(schemas.invoicing.list), invoicingController.getAllInvoices);
router.get("/:id", validate(schemas.invoicing.get), invoicingController.getInvoiceById);
router.post("/", validate(schemas.invoicing.create), invoicingController.createInvoice);
router.put("/:id", validate(schemas.invoicing.update), invoicingController.updateInvoice);

export default router;