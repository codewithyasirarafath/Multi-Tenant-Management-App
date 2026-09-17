import * as deliveryModel from "../models/deliveryModel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getDeliveries = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { limit, offset, status, entId } = req.validated.query;
  const deliveries = await deliveryModel.getAllDeliveries(orgId, { limit, offset, status, entId });
  res.status(200).json(deliveries);
});

const getDelivery = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const delivery = await deliveryModel.getDeliveryById(id, orgId);
  if (!delivery) return res.status(404).json({ error: "Delivery not found" });
  res.status(200).json(delivery);
});

const trackDelivery = asyncHandler(async (req, res) => {
  const { orgId, trackingNumber } = req.params;
  const delivery = await deliveryModel.getDeliveryByTrackingNumber(trackingNumber, orgId);
  if (!delivery) return res.status(404).json({ error: "No delivery with that tracking number" });
  res.status(200).json(delivery);
});

const addDelivery = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { entId, trackingNumber, senderName, receiverName, destination, status, createdBy } = req.validated.body;
  const newDelivery = await deliveryModel.createDelivery(orgId, entId, trackingNumber, senderName, receiverName, destination, status, createdBy);
  res.status(201).json(newDelivery);
});

const editDelivery = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const { entId, senderName, receiverName, destination } = req.validated.body;
  const updated = await deliveryModel.updateDelivery(id, orgId, entId, senderName, receiverName, destination);
  if (!updated) return res.status(404).json({ error: "Delivery not found" });
  res.status(200).json(updated);
});

const changeStatus = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const { status } = req.validated.body;
  const updated = await deliveryModel.updateDeliveryStatus(id, orgId, status);
  if (!updated) return res.status(404).json({ error: "Delivery not found" });
  res.status(200).json(updated);
});

const removeDelivery = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const deleted = await deliveryModel.deleteDelivery(id, orgId);
  if (!deleted) return res.status(404).json({ error: "Delivery not found" });
  res.status(200).json({ message: "Delivery deleted", delivery: deleted });
});

export { getDeliveries, getDelivery, trackDelivery, addDelivery, editDelivery, changeStatus, removeDelivery };