import pool from "../config/db.js";

const getAllInvoices = async (orgId, { limit = 50, offset = 0, status, customerId, deliveryId } = {}) => {
  const conditions = ["org_id = $1"];
  const params = [orgId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (customerId) {
    conditions.push(`customer_id = $${idx}`);
    params.push(customerId);
    idx++;
  }
  if (deliveryId) {
    conditions.push(`delivery_id = $${idx}`);
    params.push(deliveryId);
    idx++;
  }

  const whereSql = conditions.join(" AND ");
  const queryText = `
    SELECT i.*, c.name AS customer_name, d.tracking_number AS delivery_tracking
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN deliveries d ON d.id = i.delivery_id
    WHERE ${whereSql} 
    ORDER BY i.issue_date DESC 
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);

  const result = await pool.query(queryText, params);
  return result.rows;
};

const getInvoiceById = async (id, orgId) => {
  const result = await pool.query(
    `SELECT i.*, c.name AS customer_name, d.tracking_number AS delivery_tracking
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id
     LEFT JOIN deliveries d ON d.id = i.delivery_id
     WHERE i.id = $1 AND i.org_id = $2`,
    [id, orgId],
  );
  return result.rows[0];
};

const createInvoice = async (orgId, { deliveryId, customerId, entId, invoiceNumber, subtotal, tax, total, dueDate, notes }) => {
  const result = await pool.query(
    `INSERT INTO invoices (org_id, delivery_id, customer_id, ent_id, invoice_number, subtotal, tax, total, due_date, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10) RETURNING *`,
    [orgId, deliveryId || null, customerId || null, entId || null, invoiceNumber, subtotal || 0, tax || 0, total || 0, dueDate || null, notes || null],
  );
  return result.rows[0];
};

const updateInvoice = async (id, orgId, { status, subtotal, tax, total, notes, dueDate }) => {
  const result = await pool.query(
    `UPDATE invoices
     SET status = $1, subtotal = $2, tax = $3, total = $4, notes = $5, due_date = $6, updated_at = NOW()
     WHERE id = $7 AND org_id = $8 RETURNING *`,
    [status, subtotal || 0, tax || 0, total || 0, notes || null, dueDate || null, id, orgId],
  );
  return result.rows[0];
};

const recordPayment = async (orgId, { invoiceId, amount, paymentMethod, transactionId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create payment record
    const paymentResult = await client.query(
      `INSERT INTO payments (org_id, invoice_id, amount, payment_method, transaction_id, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [orgId, invoiceId, amount, paymentMethod || null, transactionId || null],
    );

    // Update invoice status if fully paid
    const invoiceCheck = await client.query(
      `SELECT total, COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = $1 AND status = 'completed'), 0) AS paid_total
       FROM invoices WHERE id = $1`,
      [invoiceId],
    );

    let newInvoiceStatus = 'pending';
    if (invoiceCheck.rows[0].paid_total >= invoiceCheck.rows[0].total) {
      newInvoiceStatus = 'paid';
    } else if (invoiceCheck.rows[0].due_date && invoiceCheck.rows[0].due_date < NOW() && newInvoiceStatus !== 'paid') {
      newInvoiceStatus = 'overdue';
    }

    const invoiceResult = await client.query(
      `UPDATE invoices SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newInvoiceStatus, invoiceId],
    );

    await client.query('COMMIT');
    return { payment: paymentResult.rows[0], invoice: invoiceResult.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
};

const getPaymentsByInvoice = async (invoiceId, orgId) => {
  const result = await pool.query(
    `SELECT * FROM payments WHERE invoice_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
    [invoiceId, orgId],
  );
  return result.rows;
};

export {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  recordPayment,
  getPaymentsByInvoice,
};