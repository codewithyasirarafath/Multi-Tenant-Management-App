import pool from "../config/db.js";

const getAllProducts = async (orgId, { limit = 50, offset = 0, isActive, entId } = {}) => {
  const conditions = ["org_id = $1"];
  const params = [orgId];
  let idx = 2;

  if (isActive !== undefined) {
    conditions.push(`is_active = $${idx}`);
    params.push(isActive);
    idx++;
  }
  if (entId) {
    conditions.push(`ent_id = $${idx}`);
    params.push(entId);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText = `
    SELECT * FROM products 
    WHERE ${whereSql} 
    ORDER BY created_at DESC 
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);

  const result = await pool.query(queryText, params);
  return result.rows;
};

const getProductById = async (id, orgId) => {
  const result = await pool.query(
    "SELECT * FROM products WHERE id = $1 AND org_id = $2",
    [id, orgId],
  );
  return result.rows[0];
};

const createProduct = async (orgId, { entId, name, sku, description, unit, costPrice, salePrice, trackInventory, minStockLevel, maxStockLevel }) => {
  const result = await pool.query(
    `INSERT INTO products (org_id, ent_id, name, sku, description, unit, cost_price, sale_price, track_inventory, min_stock_level, max_stock_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      orgId,
      entId || null,
      name,
      sku,
      description || null,
      unit || 'piece',
      costPrice || 0,
      salePrice || 0,
      trackInventory || true,
      minStockLevel || 5,
      maxStockLevel || 100,
    ],
  );
  return result.rows[0];
};

const updateProduct = async (id, orgId, { entId, name, sku, description, unit, costPrice, salePrice, trackInventory, minStockLevel, maxStockLevel }) => {
  const result = await pool.query(
    `UPDATE products
     SET ent_id = $1, name = $2, sku = $3, description = $4, unit = $5, cost_price = $6, sale_price = $7, track_inventory = $8, min_stock_level = $9, max_stock_level = $10, updated_at = NOW()
     WHERE id = $11 AND org_id = $12 RETURNING *`,
    [entId || null, name, sku, description || null, unit || 'piece', costPrice || 0, salePrice || 0, trackInventory || true, minStockLevel || 5, maxStockLevel || 100, id, orgId],
  );
  return result.rows[0];
};

const deleteProduct = async (id, orgId) => {
  const result = await pool.query(
    "DELETE FROM products WHERE id = $1 AND org_id = $2 RETURNING *",
    [id, orgId],
  );
  return result.rows[0];
};

// Inventory functions
const getInventoryByProduct = async (orgId, productId, { entId } = {}) => {
  const conditions = ["org_id = $1 AND product_id = $2"];
  const params = [orgId, productId];
  let idx = 3;

  if (entId) {
    conditions.push(`ent_id = $${idx}`);
    params.push(entId);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText = `
    SELECT * FROM inventory 
    WHERE ${whereSql}
  `;
  const result = await pool.query(queryText, params);
  return result.rows[0];
};

const updateInventory = async (orgId, productId, { entId, quantity, reserved } = {}) => {
  const conditions = ["org_id = $1 AND product_id = $2"];
  const params = [orgId, productId];
  let idx = 3;

  if (entId !== undefined) {
    conditions.push(`ent_id = $${idx}`);
    params.push(entId);
    idx++;
  }
  if (quantity !== undefined) {
    conditions.push(`quantity = $${idx}`);
    params.push(quantity);
    idx++;
  }
  if (reserved !== undefined) {
    conditions.push(`reserved = $${idx}`);
    params.push(reserved);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText = `
    UPDATE inventory
     SET quantity = COALESCE($${idx}, quantity), reserved = COALESCE($${idx + 1}, reserved), updated_at = NOW()
     WHERE ${whereSql} RETURNING *
  `;
  params.push(quantity, reserved);

  const result = await pool.query(queryText, params);
  return result.rows[0];
};

const adjustInventory = async (orgId, productId, { entId, quantity, movementType, notes, performedBy }) => {
  const result = await pool.query(
    `WITH updated AS (
       UPDATE inventory
            SET quantity = $3, reserved = GREATEST(0, quantity - $4), updated_at = NOW()
       WHERE org_id = $1 AND product_id = $2 AND (ent_id IS NULL OR ent_id = $5)
       RETURNING *
     )
     INSERT INTO inventory_movements (org_id, ent_id, product_id, movement_type, quantity, notes, performed_by)
     VALUES ($1, $6, $2, $7, $3 - COALESCE((SELECT reserved FROM inventory WHERE org_id = $1 AND product_id = $2), 0), $8, $9)
     RETURNING *`,
    [orgId, productId, quantity, reserved || 0, entId || null, movementType || 'adjustment', notes || null, performedBy || null],
  );
  return result.rows[0];
};

// ... more inventory functions could be added

export {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getInventoryByProduct,
  updateInventory,
  adjustInventory,
};