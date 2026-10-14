const db = require('../db');
const carbone = require('carbone');
const path = require('path');
const rootDir = path.join(__dirname, '..');
const { randomBytes, randomInt, randomUUID } = require('crypto');
const { hashPassword } = require('../passwords');
const { calculateInvoice, validateCharges } = require('../invoicePricing');

module.exports = function registerOfficeRoutes(app, { sendWhatsAppMessage }) {
const invoiceJobSql = `
  SELECT j.jobCardId, j.status AS jobStatus, j.createdDate,
         v.registrationNo, v.make, v.model, c.name AS customerName, c.phone
  FROM job_card j
  LEFT JOIN service_request sr ON sr.requestId = j.requestId
  JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
  LEFT JOIN customer c ON c.customerId = v.customerId
  WHERE j.jobCardId = ?
`;

async function getInvoiceDetails(connection, jobCardId) {
  const [[job], [parts], [charges], [invoices]] = await Promise.all([
    connection.query(invoiceJobSql, [jobCardId]),
    connection.query(`SELECT i.itemName, ji.quantityUsed, ji.pricePerUnit
                      FROM job_item ji JOIN inventory_item i ON i.itemId = ji.itemId
                      WHERE ji.jobCardId = ? ORDER BY i.itemName`, [jobCardId]),
    connection.query(`SELECT chargeId, chargeType, description, amount
                      FROM invoice_charge WHERE jobCardId = ? ORDER BY chargeId`, [jobCardId]),
    connection.query(`SELECT invoiceId, issueDate, netAmount, laborCharge, workshopFee,
                             taxAmount, grandTotal, paymentStatus
                      FROM invoice WHERE jobCardId = ? ORDER BY issueDate DESC, invoiceId DESC`, [jobCardId])
  ]);
  return { job: job[0], parts, charges, invoices };
}

function paidInvoice(invoices) {
  return invoices.find(invoice => String(invoice.paymentStatus).toUpperCase() === 'PAID');
}
app.post('/api/om/register-customer', async (req, res) => {
  const { name, nic, email, phone, registrationNo } = req.body;
  if (![name, nic, phone, registrationNo].every(value => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ success: false, error: 'Name, NIC, phone, and vehicle number plate are required.' });
  }
  const userId = `CUST_${Date.now()}${randomInt(100, 1000)}`;
  const vehicleId = `V_${Date.now()}${randomInt(100, 1000)}`;
  const username = 'cus_' + phone + '_' + randomBytes(4).toString('hex');
  let passwordHash;
  try {
    passwordHash = await hashPassword(randomBytes(32).toString('hex'));
  } catch (error) {
    console.error('Could not prepare customer account:', error);
    return res.status(500).json({ success: false, error: 'Could not register customer.' });
  }
  const vehiclePassId = 'VID_' + randomBytes(6).toString('hex').toUpperCase();

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO user (userId, username, passwordHash, name, phone, role) VALUES (?, ?, ?, ?, ?, 'CUSTOMER')",
      [userId, username, passwordHash, name, phone]
    );
    await connection.query(
      'INSERT INTO customer (customerId, name, nic, email, phone, vehiclePassId) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, nic, email || null, phone, vehiclePassId]
    );
    await connection.query(
      "INSERT INTO vehicle (vehicleId, registrationNo, customerId, vehiclePassId, status) VALUES (?, ?, ?, ?, 'PENDING_ADVISOR')",
      [vehicleId, registrationNo.trim().toUpperCase(), userId, vehiclePassId]
    );
    await connection.commit();

    const whatsappSent = await sendWhatsAppMessage(phone, `Dear ${name}, your registration is complete at Lakisha Auto Mart. Vehicle: ${registrationNo.trim().toUpperCase()}. Your Vehicle ID: ${vehiclePassId}. Use this ID to open the customer portal.`);
    res.json({
      success: true,
      message: `Customer and vehicle number plate registered. ${whatsappSent ? 'WhatsApp message sent.' : 'WhatsApp message not sent; check the connection.'}`,
      customerId: userId,
      vehicleId,
      vehiclePassId,
      whatsappSent,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Customer registration failed:', error);
    const duplicatePlate = error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('registrationNo');
    res.status(duplicatePlate ? 409 : 500).json({ success: false, error: duplicatePlate ? 'This vehicle number plate is already registered.' : 'Could not register customer.' });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/om/search-customer', (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const sql = `
    SELECT
      c.customerId AS userId,
      c.name,
      c.email,
      c.phone,
      c.nic,
      v.vehicleId,
      v.registrationNo,
      v.make,
      v.model
    FROM customer c
    LEFT JOIN vehicle v ON c.customerId = v.customerId
    ${query ? 'WHERE c.name LIKE ? OR c.nic LIKE ? OR c.phone LIKE ? OR v.registrationNo LIKE ?' : ''}
    ORDER BY c.name, v.registrationNo
  `;
  const searchTerm = `%${query}%`;
  db.query(sql, query ? [searchTerm, searchTerm, searchTerm, searchTerm] : [], (err, results) => {
    if (err) {
      console.error("Search Query Error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, customers: results });
  });
});

app.get('/api/om/customer-history/:customerId', (req, res) => {
  const { customerId } = req.params;
  const sql = `
    SELECT sr.*, v.registrationNo, i.jobCardId, i.invoiceId, i.grandTotal, i.paymentStatus
    FROM service_request sr
    JOIN vehicle v ON sr.vehicleId = v.vehicleId
    LEFT JOIN invoice i ON i.invoiceId = (
      SELECT latest.invoiceId
      FROM invoice latest
      JOIN job_card j ON j.jobCardId = latest.jobCardId
      WHERE j.requestId = sr.requestId
      ORDER BY latest.issueDate DESC, latest.invoiceId DESC
      LIMIT 1
    )
    WHERE sr.customerId = ? OR (sr.customerId IS NULL AND v.customerId = ?)
    ORDER BY sr.requestDate DESC
  `;
  db.query(sql, [customerId, customerId], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, history: results });
  });
});

app.get('/api/om/invoice-work', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT j.jobCardId, j.stageName, j.status AS jobStatus, j.createdDate,
             CASE WHEN LOWER(TRIM(j.stageName)) = 'custom mod'
                    OR COALESCE(sr.isCustomModification, 0) = 1
                  THEN 'CUSTOM_MODIFICATION' ELSE 'GENERAL' END AS billType,
             v.registrationNo, c.name AS customerName,
             paid.invoiceId, paid.grandTotal, paid.issueDate
      FROM job_card j
      LEFT JOIN service_request sr ON sr.requestId = j.requestId
      JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
      LEFT JOIN customer c ON c.customerId = v.customerId
      LEFT JOIN invoice paid ON paid.invoiceId = (
        SELECT i.invoiceId FROM invoice i
        WHERE i.jobCardId = j.jobCardId AND UPPER(i.paymentStatus) = 'PAID'
        ORDER BY i.issueDate DESC, i.invoiceId DESC LIMIT 1
      )
      WHERE UPPER(j.status) = 'COMPLETED' OR paid.invoiceId IS NOT NULL
      ORDER BY j.createdDate DESC
    `);
    res.json({
      success: true,
      pending: rows.filter(row => !row.invoiceId),
      completed: rows.filter(row => row.invoiceId)
    });
  } catch (error) {
    console.error('Could not load invoice work:', error);
    res.status(500).json({ success: false, error: 'Could not load invoices.' });
  }
});

app.get('/api/om/payment-history', async (req, res) => {
  try {
    const [payments] = await db.promise().query(`
      SELECT p.paymentId, p.paymentDate, p.amount, p.paymentMethod,
             i.invoiceId, j.jobCardId, v.registrationNo, c.name AS customerName
      FROM payment p
      JOIN invoice i ON i.invoiceId = p.invoiceId
      LEFT JOIN job_card j ON j.jobCardId = i.jobCardId
      LEFT JOIN service_request sr ON sr.requestId = j.requestId
      LEFT JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
      LEFT JOIN customer c ON c.customerId = v.customerId
      ORDER BY p.paymentDate DESC, p.paymentId DESC
    `);
    res.json({ success: true, payments });
  } catch (error) {
    console.error('Could not load payment history:', error);
    res.status(500).json({ success: false, error: 'Could not load payment history.' });
  }
});

app.get('/api/om/invoice-summary/:jobCardId', async (req, res) => {
  try {
    const { job, parts, charges, invoices } = await getInvoiceDetails(db.promise(), req.params.jobCardId);
    if (!job) return res.status(404).json({ success: false, error: 'Job card not found.' });
    const paid = paidInvoice(invoices);
    if (String(job.jobStatus).toUpperCase() !== 'COMPLETED' && !paid) {
      return res.status(409).json({ success: false, error: 'This job is not complete yet.' });
    }
    const totals = calculateInvoice(parts, charges, 0);
    res.json({
      success: true, job, parts, charges, paid: Boolean(paid),
      invoice: paid || null,
      totals: paid ? { ...totals, partsSubtotal: Number(paid.netAmount),
        laborCharge: Number(paid.laborCharge), workshopFee: Number(paid.workshopFee),
        taxAmount: Number(paid.taxAmount), grandTotal: Number(paid.grandTotal) } : totals
    });
  } catch (error) {
    console.error('Could not load invoice summary:', error);
    res.status(500).json({ success: false, error: 'Could not load invoice summary.' });
  }
});

app.put('/api/om/invoice-charges/:jobCardId', async (req, res) => {
  const charges = req.body.charges;
  const validationError = validateCharges(charges);
  if (validationError) return res.status(400).json({ success: false, error: validationError });
  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    const [[job]] = await connection.query('SELECT status FROM job_card WHERE jobCardId = ? FOR UPDATE', [req.params.jobCardId]);
    if (!job) { await connection.rollback(); return res.status(404).json({ success: false, error: 'Job card not found.' }); }
    if (String(job.status).toUpperCase() !== 'COMPLETED') {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'Complete the job before adding invoice charges.' });
    }
    const [paid] = await connection.query(
      "SELECT invoiceId FROM invoice WHERE jobCardId = ? AND UPPER(paymentStatus) = 'PAID' LIMIT 1", [req.params.jobCardId]
    );
    if (paid.length) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'Paid invoice charges cannot be changed.' });
    }
    await connection.query('DELETE FROM invoice_charge WHERE jobCardId = ?', [req.params.jobCardId]);
    for (const charge of charges) {
      await connection.query(
        'INSERT INTO invoice_charge (jobCardId, chargeType, description, amount) VALUES (?, ?, ?, ?)',
        [req.params.jobCardId, charge.chargeType, charge.description.trim(), Number(charge.amount)]
      );
    }
    await connection.commit();
    res.json({ success: true, message: 'Additional charges saved.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Could not save invoice charges:', error);
    res.status(500).json({ success: false, error: 'Could not save invoice charges.' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/om/process-payment', async (req, res) => {
  const { jobCardId, paymentMethod, officeUserId, taxPercentage = 0 } = req.body;
  const taxRate = Number(taxPercentage);
  if (typeof jobCardId !== 'string' || !jobCardId || !['CASH', 'CARD'].includes(paymentMethod) ||
      !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 ||
      !/^\d+(\.\d{1,2})?$/.test(String(taxPercentage))) {
    return res.status(400).json({ success: false, error: 'Invalid job, tax percentage, or payment method.' });
  }
  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    const [[job]] = await connection.query('SELECT status FROM job_card WHERE jobCardId = ? FOR UPDATE', [jobCardId]);
    if (!job) { await connection.rollback(); return res.status(404).json({ success: false, error: 'Job card not found.' }); }
    if (String(job.status).toUpperCase() !== 'COMPLETED') {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'Complete the job before recording payment.' });
    }
    const { parts, charges, invoices } = await getInvoiceDetails(connection, jobCardId);
    if (paidInvoice(invoices)) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'This job has already been paid.' });
    }
    const totals = calculateInvoice(parts, charges, taxRate);
    if (totals.grandTotal <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Add a spare part or service charge before recording payment.' });
    }
    const invoiceId = invoices[0]?.invoiceId || `INV_${jobCardId}`;
    if (invoices.length) {
      await connection.query(`UPDATE invoice SET netAmount = ?, laborCharge = ?, workshopFee = ?,
        taxAmount = ?, grandTotal = ?, officeUserId = ?, paymentStatus = 'Paid' WHERE invoiceId = ?`,
        [totals.partsSubtotal, totals.laborCharge, totals.workshopFee, totals.taxAmount,
          totals.grandTotal, officeUserId || null, invoiceId]);
    } else {
      await connection.query(`INSERT INTO invoice
        (invoiceId, netAmount, laborCharge, workshopFee, taxAmount, grandTotal, paymentStatus, jobCardId, officeUserId)
        VALUES (?, ?, ?, ?, ?, ?, 'Paid', ?, ?)`,
        [invoiceId, totals.partsSubtotal, totals.laborCharge, totals.workshopFee,
          totals.taxAmount, totals.grandTotal, jobCardId, officeUserId || null]);
    }
    await connection.query(
      'INSERT INTO payment (paymentId, amount, paymentMethod, invoiceId) VALUES (?, ?, ?, ?)',
      ['PAY_' + randomUUID(), totals.grandTotal, paymentMethod, invoiceId]
    );
    await connection.commit();
    res.json({ success: true, invoiceId, totals,
      message: `Payment of Rs.${totals.grandTotal.toFixed(2)} via ${paymentMethod} recorded successfully.` });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Could not record payment:', error);
    res.status(500).json({ success: false, error: 'Could not record payment.' });
  } finally {
    if (connection) connection.release();
  }
});

function sparePartInput(body) {
  const name = typeof body.itemName === 'string' ? body.itemName.trim() : '';
  const price = Number(body.unitPrice);
  const quantity = Number(body.quantityInStock);
  const reorderLevel = Number(body.reorderLevel ?? 10);
  if (!name || name.length > 100 || !/^\d+(\.\d{1,2})?$/.test(String(body.unitPrice)) ||
      price < 0 || price > 99999999.99 || !Number.isSafeInteger(quantity) || quantity < 0 ||
      !Number.isSafeInteger(reorderLevel) || reorderLevel < 0 || quantity > 1000000 || reorderLevel > 1000000) return null;
  return { name, price, quantity, reorderLevel };
}

app.get('/api/om/spare-parts', async (req, res) => {
  try {
    const [parts] = await db.promise().query(
      'SELECT itemId, itemName, unitPrice, quantityInStock, reorderLevel, isActive FROM inventory_item ORDER BY isActive DESC, itemName'
    );
    res.json({ success: true, parts });
  } catch (error) {
    console.error('Could not load spare parts:', error);
    res.status(500).json({ success: false, error: 'Could not load spare parts.' });
  }
});

app.post('/api/om/add-spare-part', async (req, res) => {
  const part = sparePartInput(req.body);
  if (!part) return res.status(400).json({ success: false, error: 'Enter a name, valid price, stock quantity, and reorder level.' });
  const itemId = `ITEM_${randomBytes(8).toString('hex').toUpperCase()}`;
  try {
    await db.promise().query(
      'INSERT INTO inventory_item (itemId, itemName, unitPrice, quantityInStock, reorderLevel) VALUES (?, ?, ?, ?, ?)',
      [itemId, part.name, part.price, part.quantity, part.reorderLevel]
    );
    res.status(201).json({ success: true, itemId, message: 'Spare part added.' });
  } catch (error) {
    console.error('Could not add spare part:', error);
    res.status(500).json({ success: false, error: 'Could not add spare part.' });
  }
});

app.put('/api/om/spare-parts/:itemId', async (req, res) => {
  const part = sparePartInput(req.body);
  if (!part) return res.status(400).json({ success: false, error: 'Enter valid spare part details.' });
  try {
    const [result] = await db.promise().query(
      'UPDATE inventory_item SET itemName = ?, unitPrice = ?, quantityInStock = ?, reorderLevel = ? WHERE itemId = ? AND isActive = 1',
      [part.name, part.price, part.quantity, part.reorderLevel, req.params.itemId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Active spare part not found.' });
    res.json({ success: true, message: 'Spare part updated.' });
  } catch (error) {
    console.error('Could not update spare part:', error);
    res.status(500).json({ success: false, error: 'Could not update spare part.' });
  }
});

app.delete('/api/om/spare-parts/:itemId', async (req, res) => {
  try {
    const [result] = await db.promise().query('UPDATE inventory_item SET isActive = 0 WHERE itemId = ? AND isActive = 1', [req.params.itemId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Active spare part not found.' });
    res.json({ success: true, message: 'Spare part archived. Past job records are preserved.' });
  } catch (error) {
    console.error('Could not archive spare part:', error);
    res.status(500).json({ success: false, error: 'Could not archive spare part.' });
  }
});

app.patch('/api/om/spare-parts/:itemId/restore', async (req, res) => {
  try {
    const [result] = await db.promise().query('UPDATE inventory_item SET isActive = 1 WHERE itemId = ? AND isActive = 0', [req.params.itemId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'Archived spare part not found.' });
    res.json({ success: true, message: 'Spare part restored.' });
  } catch (error) {
    console.error('Could not restore spare part:', error);
    res.status(500).json({ success: false, error: 'Could not restore spare part.' });
  }
});

app.post('/api/om/notify-customer', async (req, res) => {
  const { phone, registrationNo } = req.body;
  if (typeof phone !== 'string' || !phone.trim() || typeof registrationNo !== 'string' || !registrationNo.trim()) {
    return res.status(400).json({ success: false, message: 'Phone and registration number are required.' });
  }
  const msg = `Dear Customer, your vehicle (${registrationNo}) is fully repaired and ready for pickup at Lakisha Auto Mart!`;
  const sent = await sendWhatsAppMessage(phone, msg);
  res.json({ success: sent, message: sent ? `WhatsApp notification sent to ${phone}` : 'WhatsApp is unavailable. Start it in backend/.env and connect the client.' });
});

app.get('/api/om/print-invoice/:jobCardId', (req, res) => {
  const { jobCardId } = req.params;
  const sql = `
    SELECT j.*, c.name AS customerName, c.phone, v.registrationNo, v.make, v.model
    FROM job_card j
    JOIN customer c ON j.customerId = c.customerId
    JOIN vehicle v ON j.vehicleId = v.vehicleId
    WHERE j.jobCardId = ?
  `;
  db.query(sql, [jobCardId], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (results.length === 0) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, invoice: results[0] });
  });
});

app.post('/api/om/appointments', (req, res) => {
  const { customerId, appointmentDate, notes } = req.body;
  const appointmentId = 'APP_' + Date.now();

  const sql = "INSERT INTO appointment (appointmentId, customerId, appointmentDate, notes) VALUES (?, ?, ?, ?)";
  db.query(sql, [appointmentId, customerId, appointmentDate, notes], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Appointment Scheduled Successfully!" });
  });
});

app.get('/api/om/appointments', (req, res) => {
  const { date } = req.query;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD.' });
  }
  const sql = `
    SELECT a.*, DATE_FORMAT(a.appointmentDate, '%Y-%m-%d') AS appointmentDay,
           DATE_FORMAT(a.appointmentDate, '%H:%i') AS appointmentTime,
           c.name AS customerName, v.registrationNo
    FROM appointment a
    LEFT JOIN customer c ON c.customerId = a.customerId
    LEFT JOIN vehicle v ON v.vehicleId = a.vehicleId
    ${date ? 'WHERE DATE(a.appointmentDate) = ?' : ''}
    ORDER BY a.appointmentDate DESC
  `;
  db.query(sql, date ? [date] : [], (err, results) => {
    if (err) {
      console.error("Fetch Appointments Error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, appointments: results });
  });
});

app.patch('/api/om/appointments/:id/status', (req, res) => {
  const { status } = req.body;
  const previousStatus = { APPROVED: 'PENDING', COMPLETED: 'APPROVED' }[status];
  if (!previousStatus) {
    return res.status(400).json({ success: false, error: 'Status must be APPROVED or COMPLETED.' });
  }

  db.query(
    'UPDATE appointment SET status = ? WHERE appointmentId = ? AND status = ?',
    [status, req.params.id, previousStatus],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!result.affectedRows) {
        return res.status(409).json({ success: false, error: 'Appointment was not found or its status has changed. Refresh the list.' });
      }
      res.json({ success: true, status });
    }
  );
});

app.put('/api/om/appointments/:id', (req, res) => {
  const { id } = req.params;
  const { customerId, appointmentDate, timeSlot, notes, status } = req.body;

  const sql = "UPDATE appointment SET customerId = ?, appointmentDate = ?, timeSlot = ?, notes = ?, status = ? WHERE appointmentId = ?";
  db.query(sql, [customerId, appointmentDate, timeSlot || null, notes, status || 'PENDING', id], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Appointment updated successfully!" });
  });
});

app.delete('/api/om/appointments/:id', (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM appointment WHERE appointmentId = ?";
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Appointment deleted successfully!" });
  });
});

const vehiclePassLookup = `
  SELECT v.vehicleId, v.registrationNo, v.customerId, v.vehiclePassId,
         c.name AS customerName, c.phone
  FROM vehicle v
  LEFT JOIN customer c ON c.customerId = v.customerId
  WHERE v.vehicleId = ? OR v.registrationNo = ?
  LIMIT 1
`;

app.get('/api/om/vehicle-pass', (req, res) => {
  const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId.trim() : '';
  if (!vehicleId) return res.status(400).json({ success: false, error: 'Vehicle number plate is required.' });
  db.query(vehiclePassLookup, [vehicleId, vehicleId], (error, vehicles) => {
    if (error) return res.status(500).json({ success: false, error: 'Could not find Vehicle ID.' });
    if (!vehicles.length) return res.status(404).json({ success: false, error: 'Vehicle not found.' });
    const { phone, ...pass } = vehicles[0];
    res.json({ success: true, pass });
  });
});

app.post('/api/om/issue-vehicle-id', async (req, res) => {
  const { vehicleId } = req.body;
  if (typeof vehicleId !== 'string' || !vehicleId.trim()) {
    return res.status(400).json({ success: false, error: 'Vehicle number plate is required.' });
  }
  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    const lookupId = vehicleId.trim();
    const [vehicles] = await connection.query(`${vehiclePassLookup} FOR UPDATE`, [lookupId, lookupId]);
    if (!vehicles.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Vehicle not found.' });
    }
    const vehicle = vehicles[0];
    if (!vehicle.customerId || !vehicle.customerName) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'Register and link a customer to this vehicle first.' });
    }
    if (vehicle.vehiclePassId && req.body.replaceExisting !== true) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'This vehicle already has a Vehicle ID. View it or confirm replacement.' });
    }

    const vehiclePassId = 'VID_' + randomBytes(6).toString('hex').toUpperCase();
    await connection.query('UPDATE vehicle SET vehiclePassId = ? WHERE vehicleId = ?', [vehiclePassId, vehicle.vehicleId]);
    await connection.query('UPDATE customer SET vehiclePassId = ? WHERE customerId = ?', [vehiclePassId, vehicle.customerId]);
    await connection.commit();

    const whatsappSent = await sendWhatsAppMessage(
      vehicle.phone,
      `Dear ${vehicle.customerName}, your Lakisha Auto Mart Vehicle ID is ${vehiclePassId}. Use it to open your customer portal.`
    );
    res.json({ success: true, message: 'Vehicle ID issued.', vehiclePassId, whatsappSent });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Vehicle pass issue failed:', error);
    res.status(500).json({ success: false, error: 'Could not issue Vehicle ID.' });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/om/download-carbone-invoice/:jobCardId', async (req, res) => {
  const taxRate = Number(req.query.tax || 0);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return res.status(400).json({ success: false, error: 'Invalid tax percentage.' });
  }
  try {
    const { job, parts, charges, invoices } = await getInvoiceDetails(db.promise(), req.params.jobCardId);
    if (!job) return res.status(404).json({ success: false, error: 'Job card not found.' });
    const paid = paidInvoice(invoices);
    if (String(job.jobStatus).toUpperCase() !== 'COMPLETED' && !paid) {
      return res.status(409).json({ success: false, error: 'Complete the job before preparing an invoice.' });
    }
    const totals = calculateInvoice(parts, charges, paid ? 0 : taxRate);
    const items = parts.map(part => ({
      itemName: part.itemName,
      pricePerUnit: Number(part.pricePerUnit).toFixed(2),
      qty: part.quantityUsed,
      totalPrice: (Number(part.quantityUsed) * Number(part.pricePerUnit)).toFixed(2)
    }));
    const typeLabels = {
      LABOR: 'Repair labor', WORKSHOP: 'Workshop fee',
      CUSTOM_MODIFICATION: 'Custom modification', OTHER: 'Other service'
    };
    for (const charge of charges) items.push({
      itemName: `${typeLabels[charge.chargeType] || 'Service'}: ${charge.description}`,
      pricePerUnit: Number(charge.amount).toFixed(2), qty: 1,
      totalPrice: Number(charge.amount).toFixed(2)
    });
    const subtotal = paid ? Number(paid.grandTotal) - Number(paid.taxAmount) : totals.subtotal;
    const difference = Math.round((subtotal - totals.subtotal) * 100) / 100;
    if (paid && difference !== 0) items.push({
      itemName: 'Previously recorded invoice adjustment',
      pricePerUnit: difference.toFixed(2), qty: 1, totalPrice: difference.toFixed(2)
    });
    const data = {
      invoiceId: paid?.invoiceId || `INV_${req.params.jobCardId}`,
      date: new Date(paid?.issueDate || Date.now()).toLocaleDateString('en-GB'),
      customerName: job.customerName || 'Customer',
      phone: job.phone || 'N/A',
      vehicleNo: job.registrationNo,
      items: items.length ? items : [{ itemName: 'No charges', pricePerUnit: '0.00', qty: 0, totalPrice: '0.00' }],
      subtotal: subtotal.toFixed(2),
      tax: Number(paid?.taxAmount ?? totals.taxAmount).toFixed(2),
      grandTotal: Number(paid?.grandTotal ?? totals.grandTotal).toFixed(2)
    };
    carbone.render(path.join(rootDir, 'templates', 'invoice_template.docx'), data, (renderError, result) => {
      if (renderError) {
        console.error('Invoice document render failed:', renderError);
        return res.status(500).json({ success: false, error: 'Could not prepare invoice document.' });
      }
      res.setHeader('Content-Disposition', `attachment; filename="Invoice_${req.params.jobCardId}.docx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(result);
    });
  } catch (error) {
    console.error('Could not prepare invoice:', error);
    res.status(500).json({ success: false, error: 'Could not prepare invoice.' });
  }
});
};
