import * as customerModel from "../models/customerModel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getAllCustomers = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { limit, offset, isActive, entId } = req.validated.query;
  const customers = await customerModel.getAllCustomers(orgId, { limit, offset, isActive, entId });
  res.status(200).json(customers);
});

const getCustomerById = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const customer = await customerModel.getCustomerById(id, orgId);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.status(200).json(customer);
});

const createCustomer = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { entId, name, email, mobile, address } = req.validated.body;
  const newCustomer = await customerModel.createCustomer(orgId, {
    entId,
    name,
    email,
    mobile,
    address,
  });
  res.status(201).json(newCustomer);
});

const updateCustomer = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const { entId, name, email, mobile, address } = req.validated.body;
  const updated = await customerModel.updateCustomer(id, orgId, {
    entId,
    name,
    email,
    mobile,
    address,
  });
  if (!updated) return res.status(404).json({ error: "Customer not found" });
  res.status(200).json(updated);
});

export { getAllCustomers, getCustomerById, createCustomer, updateCustomer };