const db = require('../db');

module.exports = function registerSupplierRoutes(app) {
function ownSupplier(req, res, next) {
  const id = req.params.supplierId || req.body?.supplierId || req.params.userId;
  if (String(id) !== String(req.auth.supplierId) && String(id) !== String(req.auth.userId)) {
    return res.status(403).json({ success: false, error: 'This supplier account cannot access that record.' });
  }
  next();
}

function ownOrder(req, res, next) {
  db.query('SELECT 1 FROM purchase_orders WHERE poId = ? AND supplierId = ? LIMIT 1',
    [req.params.orderId, req.auth.supplierId], (error, rows) => {
      if (error) return res.status(500).json({ success: false, error: 'Could not verify supplier order.' });
      if (!rows.length) return res.status(403).json({ success: false, error: 'This order does not belong to your supplier account.' });
      next();
    });
}

app.get('/api/supplier/profile/:userId', ownSupplier, (req, res) => {
  const { userId } = req.params;
  const sql = `
    SELECT s.*, u.username, u.name AS accountName
    FROM suppliers s
    LEFT JOIN user u ON s.supplierUserId = u.userId
    WHERE s.isActive = 1 AND (s.supplierUserId = ? OR s.supplierId = ?)
  `;
  db.query(sql, [userId, userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, profile: results[0] || {} });
  });
});

app.put('/api/supplier/profile/update/:supplierId', ownSupplier, (req, res) => {
  const { supplierId } = req.params;
  const { supplierName, contactPerson, phone, email, category, deliveryAddress } = req.body;
  const sql = `
    UPDATE suppliers
    SET supplierName = ?, contactPerson = ?, phone = ?, email = ?, category = ?, deliveryAddress = ?
    WHERE supplierId = ?
  `;
  db.query(sql, [supplierName, contactPerson, phone, email, category, deliveryAddress, supplierId], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Profile updated successfully!" });
  });
});

app.get('/api/supplier/office-orders/:supplierId', ownSupplier, (req, res) => {
  const { supplierId } = req.params;
  const sql = `
    SELECT
      po.poId AS orderId,
      poi.itemName AS orderItem,
      poi.quantity AS quantity,
      po.estimatedDeliveryDate AS requiredDate,
      po.status AS status
    FROM purchase_orders po
    LEFT JOIN purchase_order_items poi ON po.poId = poi.poId
    WHERE po.supplierId = ?
    ORDER BY po.poId DESC
  `;

  db.query(sql, [supplierId], (err, results) => {
    if (err) {
      console.error("Error fetching office orders:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, orders: results || [] });
  });
});

app.put('/api/supplier/order/accept/:orderId', ownOrder, (req, res) => {
  const { orderId } = req.params;
  const sql = "UPDATE purchase_orders SET status = 'ACCEPTED' WHERE poId = ?";
  db.query(sql, [orderId], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Order accepted successfully!" });
  });
});

app.put('/api/supplier/order/reject/:orderId', ownOrder, (req, res) => {
  const { orderId } = req.params;
  const { rejectionReason } = req.body;
  const sql = "UPDATE purchase_orders SET status = 'REJECTED', rejectionReason = ? WHERE poId = ?";
  db.query(sql, [rejectionReason, orderId], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Order rejected!" });
  });
});

app.post('/api/supplier/quotation/create', ownSupplier, (req, res) => {
  const { supplierId, partName, quantity, unitPrice, notes } = req.body;
  const requestDetails = `${partName} (Qty: ${quantity}) - ${notes || ''}`;
  const quotedAmount = (quantity || 1) * (unitPrice || 0);

  const sql = `
    INSERT INTO quotations (supplierId, requestDetails, quotedAmount, status)
    VALUES (?, ?, ?, 'PENDING')
  `;
  db.query(sql, [supplierId, requestDetails, quotedAmount], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Quotation created successfully!" });
  });
});

app.get('/api/supplier/quotations/:supplierId', ownSupplier, (req, res) => {
  const { supplierId } = req.params;
  const sql = "SELECT * FROM quotations WHERE supplierId = ? ORDER BY quotationId DESC";
  db.query(sql, [supplierId], (err, results) => {
    if (err) {
      console.error("Error fetching quotations:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, quotations: results || [] });
  });
});

app.put('/api/supplier/order/update-status/:orderId', ownOrder, (req, res) => {
  const { orderId } = req.params;
  const { status, estimatedDeliveryDate } = req.body;
  const sql = "UPDATE purchase_orders SET status = ?, estimatedDeliveryDate = ? WHERE poId = ?";
  db.query(sql, [status, estimatedDeliveryDate || null, orderId], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Order status updated!" });
  });
});

app.put('/api/supplier/order/complete/:orderId', ownOrder, (req, res) => {
  const { orderId } = req.params;
  const sql = "UPDATE purchase_orders SET status = 'COMPLETED' WHERE poId = ?";
  db.query(sql, [orderId], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Order marked as completed!" });
  });
});
};
