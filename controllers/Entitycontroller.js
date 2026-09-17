import * as entityModel from "../models/Entitymodel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getEntities = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { limit, offset } = req.validated.query;
  const entities = await entityModel.getAllEntities(orgId, { limit, offset });
  res.status(200).json(entities);
});

const getEntity = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const entity = await entityModel.getEntityById(id, orgId);
  if (!entity) return res.status(404).json({ error: "Entity not found" });
  res.status(200).json(entity);
});

const addEntity = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { name, code, entCode } = req.validated.body;
  const newEntity = await entityModel.createEntity(orgId, name, code, entCode);
  res.status(201).json(newEntity);
});

const editEntity = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const { name, code, isActive } = req.validated.body;
  const updated = await entityModel.updateEntity(id, orgId, name, code, isActive);
  if (!updated) return res.status(404).json({ error: "Entity not found" });
  res.status(200).json(updated);
});

const removeEntity = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const deleted = await entityModel.deleteEntity(id, orgId);
  if (!deleted) return res.status(404).json({ error: "Entity not found" });
  res.status(200).json({ message: "Entity deleted", entity: deleted });
});

export { getEntities, getEntity, addEntity, editEntity, removeEntity };