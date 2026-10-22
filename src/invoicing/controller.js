import * as invoicingModel from "./model.js";
import { asyncHandler } from "../shared/middleware/errorHandler.js";

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

const addPayment = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const { amount, paymentMethod, transactionId } = req.validated.body;
  const result = await invoicingModel.recordPayment(orgId, {
    invoiceId: id,
    amount,
    paymentMethod,
    transactionId,
  });
  res.status(201).json(result);
});

const getPayments = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const payments = await invoicingModel.getPaymentsByInvoice(id, orgId);
  res.status(200).json(payments);
});

export { getAllInvoices, getInvoiceById, createInvoice, updateInvoice, addPayment, getPayments };