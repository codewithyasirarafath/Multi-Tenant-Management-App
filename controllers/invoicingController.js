import * as invoicingModel from "../models/invoicingModel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getAllInvoices = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { limit, offset, status, customerId, deliveryId } = req.validated.query;
  const invoices = await invoicingModel.getAllInvoices(orgId, { limit, offset, status, customerId, deliveryId });
  res.status(200).json(invoices);
});

const getInvoiceById = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const invoice = await invoicingModel.getInvoiceById(id, orgId);
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.status(200).json(invoice);
});

const createInvoice = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { deliveryId, customerId, entId, invoiceNumber, subtotal, tax, total, dueDate, notes } = req.validated.body;
  const newInvoice = await invoicingModel.createInvoice(orgId, {
    deliveryId,
    customerId,
    entId,
    invoiceNumber,
    subtotal,
    tax,
    total,
    dueDate,
    notes,
  });
  res.status(201).json(newInvoice);
});

const updateInvoice = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const { status, subtotal, tax, total, notes, dueDate } = req.validated.body;
  const updated = await invoicingModel.updateInvoice(id, orgId, {
    status,
    subtotal,
    tax,
    total,
    notes,
    dueDate,
  });
  if (!updated) return res.status(404).json({ error: "Invoice not found" });
  res.status(200).json(updated);
});

export { getAllInvoices, getInvoiceById, createInvoice, updateInvoice };