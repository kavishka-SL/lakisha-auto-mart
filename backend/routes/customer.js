const db = require('../db');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const rootDir = path.join(__dirname, '..');
const uploadsDir = path.join(rootDir, 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

module.exports = function registerCustomerRoutes(app) {
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.post('/api/customer/login', (req, res) => {
  const { vehiclePassId } = req.body;
  if (typeof vehiclePassId !== 'string' || !vehiclePassId.trim()) {
    return res.status(400).json({ success: false, message: 'Enter your Vehicle ID.' });
  }
  const loginId = vehiclePassId.trim();

  const sql = `
    SELECT c.customerId, c.name, c.email, c.phone, c.themePreference, c.fontSizePreference,
           v.vehicleId, v.registrationNo, v.make, v.model, v.status AS vehicleStatus
    FROM customer c
    JOIN vehicle v ON c.customerId = v.customerId
    WHERE v.vehiclePassId = ?
    LIMIT 1
  `;

  db.query(sql, [loginId], (err, rows) => {
    if (err) {
      console.error("Login Query Error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle ID not found. Check the ID given by Office Management.' });
    }
    res.json({ success: true, data: rows[0] });
  });
});

app.get('/api/customer/status/:customerId', (req, res) => {
  const { customerId } = req.params;

  const jobSql = `
    SELECT j.jobCardId, j.requestId, j.status AS jobStatus,
           CASE WHEN UPPER(j.status) = 'PAUSED' THEN 'PAUSED' ELSE v.status END AS status,
           j.pauseReason, j.stageName, j.instructionComment,
           advisor.name AS advisorName, technician.name AS technicianName,
           v.registrationNo, v.model, v.status AS vehicleStatus
    FROM job_card j
    LEFT JOIN service_request sr ON j.requestId = sr.requestId
    JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
    LEFT JOIN user advisor ON j.advisorId = advisor.userId
    LEFT JOIN user technician ON j.technicianId = technician.userId
    WHERE v.customerId = ? AND UPPER(j.status) NOT IN ('REJECTED', 'CANCELLED')
    ORDER BY CASE WHEN UPPER(j.status) = 'COMPLETED' THEN 1 ELSE 0 END, j.createdDate DESC LIMIT 1
  `;

  db.query(jobSql, [customerId], (err, jobCardRows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    if (!jobCardRows || jobCardRows.length === 0) {
      return res.json({ success: true, activeJob: null, message: 'No repair job found.' });
    }

    const activeJob = jobCardRows[0];

    const partsSql = `
      SELECT i.itemName, ji.quantityUsed, ji.pricePerUnit, (ji.quantityUsed * ji.pricePerUnit) AS total
      FROM job_item ji
      JOIN inventory_item i ON ji.itemId = i.itemId
      WHERE ji.jobCardId IN (
        SELECT related.jobCardId FROM job_card related
        WHERE related.jobCardId = ? OR related.requestId = ?
      )
    `;

    db.query(partsSql, [activeJob.jobCardId, activeJob.requestId], (err2, partsRows) => {
      if (err2) return res.status(500).json({ success: false, error: err2.message });

      res.json({
        success: true,
        activeJob: { ...activeJob, replacedParts: partsRows || [] }
      });
    });
  });
});

app.get('/api/customer/invoice/:jobCardId', (req, res) => {
  const { jobCardId } = req.params;

  const sql = `
    SELECT i.invoiceId, i.issueDate, i.netAmount, i.laborCharge, i.workshopFee,
           (SELECT COALESCE(SUM(ic.amount), 0) FROM invoice_charge ic
            WHERE ic.jobCardId = i.jobCardId AND ic.chargeType IN ('CUSTOM_MODIFICATION', 'OTHER')) AS otherCharges,
           i.taxAmount, i.grandTotal, i.paymentStatus, j.status AS jobStatus
    FROM invoice i
    JOIN job_card j ON i.jobCardId = j.jobCardId
    WHERE i.jobCardId = ? OR j.requestId = (SELECT requestId FROM job_card WHERE jobCardId = ?)
    ORDER BY i.issueDate DESC LIMIT 1
  `;

  db.query(sql, [jobCardId, jobCardId], (err, invoiceRows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!invoiceRows || invoiceRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not generated yet.' });
    }
    res.json({ success: true, invoice: invoiceRows[0] });
  });
});

app.get('/api/customer/history/:customerId', (req, res) => {
  const { customerId } = req.params;

  const sql = `
    SELECT j.jobCardId, j.createdDate, j.stageName, j.totalAmount, j.status,
           v.registrationNo, v.model
    FROM job_card j
    LEFT JOIN service_request sr ON j.requestId = sr.requestId
    JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
    WHERE v.customerId = ? AND UPPER(j.status) = 'COMPLETED'
    ORDER BY j.createdDate DESC
  `;

  db.query(sql, [customerId], (err, historyRows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, history: historyRows || [] });
  });
});

app.get('/api/customer/custom-modifications/:customerId', (req, res) => {
  const sql = `
    SELECT cm.modRequestId, cm.jobCardId, cm.requestNote, cm.status, cm.createdDate,
           v.registrationNo
    FROM custom_modification_request cm
    JOIN job_card j ON j.jobCardId = cm.jobCardId
    LEFT JOIN service_request sr ON sr.requestId = j.requestId
    JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
    WHERE v.customerId = ?
    ORDER BY cm.createdDate DESC, cm.modRequestId DESC
  `;
  db.query(sql, [req.params.customerId], (err, requests) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, requests });
  });
});

app.get('/api/appointments/available-slots', (req, res) => {
  const { date } = req.query;

  const sql = `SELECT timeSlot FROM appointment WHERE DATE(appointmentDate) = DATE(?) AND status != 'CANCELLED'`;

  db.query(sql, [date], (err, bookedSlots) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const allSlots = ['09:00 AM - 10:30 AM', '11:00 AM - 12:30 PM', '02:00 PM - 03:30 PM', '04:00 PM - 05:30 PM'];
    const takenSlots = bookedSlots ? bookedSlots.map(s => s.timeSlot) : [];
    const availableSlots = allSlots.filter(slot => !takenSlots.includes(slot));

    res.json({ success: true, availableSlots });
  });
});

app.get('/api/customer/appointments/:customerId', (req, res) => {
  const sql = `
    SELECT a.appointmentId, DATE_FORMAT(a.appointmentDate, '%Y-%m-%d') AS appointmentDay,
           DATE_FORMAT(a.appointmentDate, '%H:%i') AS appointmentTime,
           a.timeSlot, a.notes, a.status, v.registrationNo
    FROM appointment a
    LEFT JOIN vehicle v ON v.vehicleId = a.vehicleId
    WHERE a.customerId = ?
    ORDER BY a.appointmentDate DESC, a.appointmentId DESC
  `;
  db.query(sql, [req.params.customerId], (err, appointments) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, appointments });
  });
});

app.post('/api/appointments/book', (req, res) => {
  const { customerId, vehicleId, appointmentDate, timeSlot, notes } = req.body;
  const appointmentId = 'APT-' + Date.now();

  const sql = `
    INSERT INTO appointment (appointmentId, customerId, vehicleId, appointmentDate, timeSlot, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
  `;

  db.query(sql, [appointmentId, customerId, vehicleId, appointmentDate, timeSlot, notes], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: 'Appointment booked successfully!', appointmentId });
  });
});

app.post('/api/customer/custom-mod', (req, res) => {
  const { jobCardId, requestNote } = req.body;
  const modRequestId = 'MOD-' + Date.now();

  const sql = `
    INSERT INTO custom_modification_request (modRequestId, jobCardId, requestNote, status)
    VALUES (?, ?, ?, 'PENDING')
  `;

  db.query(sql, [modRequestId, jobCardId, requestNote], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: 'Modification request sent to Service Advisor!', modRequestId });
  });
});

app.post('/api/customer/feedback', upload.single('photo'), (req, res) => {
  const { customerId, jobCardId, rating, comment } = req.body;
  const feedbackId = 'FB-' + Date.now();
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const sql = `
    INSERT INTO feedback (feedbackId, customerId, jobCardId, rating, comment, photoUrl)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [feedbackId, customerId, jobCardId, rating, comment, photoUrl], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: 'Feedback submitted successfully!' });
  });
});

app.put('/api/customer/profile/:customerId', (req, res) => {
  const { customerId } = req.params;
  const { phone, email, themePreference, fontSizePreference } = req.body;

  const sql = `
    UPDATE customer
    SET phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        themePreference = COALESCE(?, themePreference),
        fontSizePreference = COALESCE(?, fontSizePreference)
    WHERE customerId = ?
  `;

  db.query(sql, [phone, email, themePreference, fontSizePreference, customerId], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: 'Profile and preferences updated!' });
  });
});

app.get('/api/customer/notifications/:customerId', (req, res) => {
  const { customerId } = req.params;

  const sql = `SELECT * FROM notification WHERE customerId = ? ORDER BY createdDate DESC`;

  db.query(sql, [customerId], (err, notifications) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, notifications: notifications || [] });
  });
});
};
