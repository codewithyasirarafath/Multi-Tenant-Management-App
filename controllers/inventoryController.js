import * as inventoryModel from "../models/inventoryModel.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const getAllProducts = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { limit, offset, isActive, entId } = req.validated.query;
  const products = await inventoryModel.getAllProducts(orgId, { limit, offset, isActive, entId });
  res.status(200).json(products);
});

const getProductById = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const product = await inventoryModel.getProductById(id, orgId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.status(200).json(product);
});

const createProduct = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { entId, name, sku, description, unit, costPrice, salePrice, trackInventory, minStockLevel, maxStockLevel } = req.validated.body;
  const newProduct = await inventoryModel.createProduct(orgId, {
    entId,
    name,
    sku,
    description,
    unit,
    costPrice,
    salePrice,
    trackInventory,
    minStockLevel,
    maxStockLevel,
  });
  res.status(201).json(newProduct);
});

const updateProduct = asyncHandler(async (req, res) => {
  const { orgId, id } = req.params;
  const { entId, name, sku, description, unit, costPrice, salePrice, trackInventory, minStockLevel, maxStockLevel } = req.validated.body;
  const updated = await inventoryModel.updateProduct(id, orgId, {
    entId,
    name,
    sku,
    description,
    unit,
    costPrice,
    salePrice,
    trackInventory,
    minStockLevel,
    maxStockLevel,
  });
  if (!updated) return res.status(404).json({ error: "Product not found" });
  res.status(200).json(updated);
});

export { getAllProducts, getProductById, createProduct, updateProduct };