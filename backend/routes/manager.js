const db = require('../db');
const { hashPassword, verifyPassword } = require('../passwords');
const { previewUserId, verifyUserIdPreview } = require('../userIds');

module.exports = function registerManagerRoutes(app) {
app.get('/api/manager/dashboard-stats', (req, res) => {
    const stats = {
        activeJobs: 0,
        pendingApprovals: 0,
        lowStockItems: 0
    };

    db.query("SELECT COUNT(*) AS count FROM job_card WHERE status = 'IN_PROGRESS'", (err1, res1) => {
        if (err1) return res.status(500).json({ error: err1.message });
        stats.activeJobs = res1[0].count;

        db.query("SELECT COUNT(*) AS count FROM salary_advance WHERE status = 'PENDING'", (err2, res2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            stats.pendingApprovals = res2[0].count;

            db.query("SELECT COUNT(*) AS count FROM inventory_item WHERE isActive = 1 AND quantityInStock <= reorderLevel", (err3, res3) => {
                if (err3) return res.status(500).json({ error: err3.message });
                stats.lowStockItems = res3[0].count;

                res.json(stats);
            });
        });
    });
});

app.get('/api/manager/all-users', (req, res) => {
    db.query("SELECT userId, username, name, phone, role FROM user", (err, result) => {
        if (err) {
            console.error("Error fetching users:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(result);
    });
});

app.put('/api/manager/change-password/:id', async (req, res) => {
    const { managerUserId, managerPassword, newPassword } = req.body;
    if (managerUserId !== req.auth.userId) {
        return res.status(403).json({ error: 'Use your own manager account to authorize this change.' });
    }
    if (![managerUserId, managerPassword, newPassword].every(value => typeof value === 'string' && value) ||
        newPassword.length < 8 || newPassword.length > 128) {
        return res.status(400).json({ error: 'Enter your manager password and a new password of 8–128 characters.' });
    }
    try {
        const [[manager]] = await db.promise().query('SELECT role, passwordHash FROM user WHERE userId = ?', [managerUserId]);
        if (!manager || manager.role !== 'MANAGER' || !(await verifyPassword(managerPassword, manager.passwordHash)).valid) {
            return res.status(403).json({ error: 'Manager password is incorrect.' });
        }
        req.auditActor = managerUserId;
        req.auditRole = 'MANAGER';
        const hash = await hashPassword(newPassword);
        const [result] = await db.promise().query('UPDATE user SET passwordHash = ? WHERE userId = ?', [hash, req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });
        res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Could not change password:', error);
        res.status(500).json({ error: 'Could not change password.' });
    }
});

app.get('/api/manager/user-id-preview', (req, res) => {
    if (!['TECHNICIAN', 'SERVICE_ADVISOR', 'OFFICE_MANAGEMENT', 'MANAGER'].includes(req.query.role)) {
        return res.status(400).json({ error: 'Select a staff role.' });
    }
    const preview = previewUserId(req.query.role);
    if (!preview) return res.status(400).json({ error: 'Select a staff role.' });
    res.json(preview);
});

app.post('/api/manager/employees', async (req, res) => {
    const { userId, userIdToken, name, role, username, phone, password } = req.body;
    if (!['TECHNICIAN', 'SERVICE_ADVISOR', 'OFFICE_MANAGEMENT', 'MANAGER'].includes(role) ||
        ![name, role, username, password].every(value => typeof value === 'string' && value.trim()) ||
        password.length < 8 ||
        !verifyUserIdPreview(role, userId, userIdToken)) {
        return res.status(400).json({ error: 'Complete the staff account form, use its generated User ID, and enter a password of at least 8 characters.' });
    }

    let passwordHash;
    try {
        passwordHash = await hashPassword(password);
    } catch (error) {
        console.error('Could not hash employee password:', error);
        return res.status(500).json({ error: 'Could not create employee.' });
    }

    const roleSql = {
        TECHNICIAN: 'INSERT INTO technician (technicianId, activeJobCount, dailyWorkingHours) VALUES (?, 0, 8)',
        SERVICE_ADVISOR: 'INSERT INTO service_advisor (advisorId) VALUES (?)',
        OFFICE_MANAGEMENT: 'INSERT INTO office_management (officeUserId) VALUES (?)',
        MANAGER: "INSERT INTO manager (managerId, managerRoleType) VALUES (?, 'General Manager')"
    };

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        await connection.query(
            'INSERT INTO user (userId, username, passwordHash, name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, username, passwordHash, name, phone || null, role]
        );
        if (roleSql[role]) await connection.query(roleSql[role], [userId]);
        await connection.commit();
        res.json({ message: 'Employee added successfully!', userId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Could not add employee:', error);
        res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Username or User ID already exists.' : 'Could not add employee.' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/manager/update-user/:id', (req, res) => {
    const { id } = req.params;
    const { name, username, phone } = req.body;
    if (!name?.trim() || !username?.trim()) return res.status(400).json({ error: 'Name and username are required.' });

    db.query("UPDATE user SET name=?, username=?, phone=? WHERE userId=?", [name.trim(), username.trim(), phone || null, id], (err, result) => {
        if (err) {
            console.error("Error updating user:", err);
            return res.status(500).json({ error: err.message });
        }
        if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });
        res.json({ message: "User updated successfully!" });
    });
});

app.delete('/api/manager/delete-user/:id', (req, res) => {
    const { id } = req.params;

    db.query("DELETE FROM user WHERE userId=?", [id], (err) => {
        if (err) {
            console.error("Error deleting user:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "User deactivated/deleted successfully!" });
    });
});

app.get('/api/manager/salary-advances', (req, res) => {
    const sql = `
        SELECT sa.*, u.name AS technicianName
        FROM salary_advance sa
        JOIN user u ON sa.technicianId = u.userId
        ORDER BY sa.requestedDate DESC
    `;
    db.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching salary advances:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(result);
    });
});

app.put('/api/manager/salary-advance/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const rejectionReason = typeof req.body.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
    if (!['APPROVED', 'REJECTED'].includes(status) ||
        (status === 'REJECTED' && (!rejectionReason || rejectionReason.length > 500))) {
        return res.status(400).json({ error: 'A rejection reason of up to 500 characters is required.' });
    }
    try {
        const [result] = await db.promise().query(
            "UPDATE salary_advance SET status = ?, rejectionReason = ? WHERE advanceId = ? AND status = 'PENDING'",
            [status, status === 'REJECTED' ? rejectionReason : null, id]
        );
        if (!result.affectedRows) return res.status(409).json({ error: 'This request is no longer pending.' });
        res.json({ message: `Salary advance ${status.toLowerCase()} successfully!` });
    } catch (error) {
        console.error('Error updating salary advance:', error);
        res.status(500).json({ error: 'Could not update salary advance.' });
    }
});

app.get('/api/manager/suppliers', (req, res) => {
    db.query("SELECT supplierId, supplierUserId, supplierName, contactPerson, phone, email, category, deliveryAddress, isActive FROM suppliers ORDER BY isActive DESC, supplierId DESC", (err, result) => {
        if (err) {
            console.error("Error fetching suppliers:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(result);
    });
});

app.post('/api/manager/suppliers', async (req, res) => {
    const { supplierName, contactPerson, phone, email, category, deliveryAddress, username, password } = req.body;
    if (![supplierName, username, password].every(value => typeof value === 'string' && value.trim()) ||
        supplierName.trim().length > 100 || username.trim().length > 100 || password.length < 8 ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return res.status(400).json({ error: 'Supplier name, username, and a password of at least 8 characters are required.' });
    }
    const supplierUserId = previewUserId('SUPPLIER').userId;
    let connection;
    try {
        const passwordHash = await hashPassword(password);
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        await connection.query(
            "INSERT INTO user (userId, username, passwordHash, name, phone, role) VALUES (?, ?, ?, ?, ?, 'SUPPLIER')",
            [supplierUserId, username.trim(), passwordHash, supplierName.trim(), phone || null]
        );
        const [result] = await connection.query(
            'INSERT INTO suppliers (supplierUserId, supplierName, contactPerson, phone, email, category, deliveryAddress) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [supplierUserId, supplierName.trim(), contactPerson || null, phone || null, email || null,
                category || null, deliveryAddress || null]
        );
        await connection.commit();
        res.status(201).json({ message: 'Supplier account created.', supplierId: result.insertId, supplierUserId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding supplier:', error);
        res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Username already exists.' : 'Could not register supplier.' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/manager/suppliers/:id', async (req, res) => {
    const { id } = req.params;
    const { supplierName, contactPerson, phone, email, category, deliveryAddress } = req.body;
    if (typeof supplierName !== 'string' || !supplierName.trim() || supplierName.trim().length > 100 ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return res.status(400).json({ error: 'A valid supplier name and email are required.' });
    }
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [[supplier]] = await connection.query('SELECT supplierUserId FROM suppliers WHERE supplierId = ? FOR UPDATE', [id]);
        if (!supplier) { await connection.rollback(); return res.status(404).json({ error: 'Supplier not found.' }); }
        await connection.query(
            'UPDATE suppliers SET supplierName = ?, contactPerson = ?, phone = ?, email = ?, category = ?, deliveryAddress = ? WHERE supplierId = ?',
            [supplierName.trim(), contactPerson || null, phone || null, email || null, category || null, deliveryAddress || null, id]
        );
        if (supplier.supplierUserId) await connection.query('UPDATE user SET name = ?, phone = ? WHERE userId = ?',
            [supplierName.trim(), phone || null, supplier.supplierUserId]);
        await connection.commit();
        res.json({ message: 'Supplier updated successfully.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating supplier:', error);
        res.status(500).json({ error: 'Could not update supplier.' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/manager/suppliers/:id', (req, res) => {
    const { id } = req.params;
    db.query('UPDATE suppliers SET isActive = 0 WHERE supplierId = ? AND isActive = 1', [id], (err, result) => {
        if (err) {
            console.error('Error archiving supplier:', err);
            return res.status(500).json({ error: 'Could not archive supplier.' });
        }
        if (!result.affectedRows) return res.status(404).json({ error: 'Active supplier not found.' });
        res.json({ message: 'Supplier archived. Past orders remain available.' });
    });
});

app.patch('/api/manager/suppliers/:id/restore', async (req, res) => {
    try {
        const [result] = await db.promise().query('UPDATE suppliers SET isActive = 1 WHERE supplierId = ? AND isActive = 0', [req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Archived supplier not found.' });
        res.json({ message: 'Supplier restored.' });
    } catch (error) {
        console.error('Could not restore supplier:', error);
        res.status(500).json({ error: 'Could not restore supplier.' });
    }
});

app.get('/api/manager/audit-logs', (req, res) => {
    db.query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

app.get('/api/manager/active-vehicles', (req, res) => {
    const sql = `SELECT j.jobCardId, j.status AS jobStatus, j.stageName, v.registrationNo, v.make, v.model, u.name AS technicianName FROM job_card j LEFT JOIN vehicle v ON j.vehicleId = v.vehicleId LEFT JOIN user u ON j.technicianId = u.userId WHERE j.status = 'IN_PROGRESS'`;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

app.get('/api/manager/customer-feedbacks', (req, res) => {
    const sql = `SELECT f.feedbackId, f.customerId, f.jobCardId, f.rating, f.comment, f.photoUrl,
      f.createdDate, c.name AS customerName FROM feedback f
      LEFT JOIN customer c ON f.customerId = c.customerId ORDER BY f.createdDate DESC`;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

app.get('/api/manager/daily-transactions', async (req, res) => {
    const date = req.query.date;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
    }
    const filter = date || null;
    try {
        const [[invoices], [payments], [sparePartsUsed]] = await Promise.all([
            db.promise().query(`SELECT i.invoiceId, i.issueDate, i.grandTotal, i.paymentStatus,
                               v.registrationNo, c.name AS customerName
                               FROM invoice i
                               LEFT JOIN job_card j ON j.jobCardId = i.jobCardId
                               LEFT JOIN service_request sr ON sr.requestId = j.requestId
                               LEFT JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
                               LEFT JOIN customer c ON c.customerId = v.customerId
                               WHERE (? IS NULL OR DATE(i.issueDate) = ?)
                               ORDER BY i.issueDate DESC`, [filter, filter]),
            db.promise().query(`SELECT p.paymentId, p.paymentDate, p.amount, p.paymentMethod,
                               i.invoiceId, v.registrationNo, c.name AS customerName
                               FROM payment p JOIN invoice i ON i.invoiceId = p.invoiceId
                               LEFT JOIN job_card j ON j.jobCardId = i.jobCardId
                               LEFT JOIN service_request sr ON sr.requestId = j.requestId
                               LEFT JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
                               LEFT JOIN customer c ON c.customerId = v.customerId
                               WHERE (? IS NULL OR DATE(p.paymentDate) = ?)
                               ORDER BY p.paymentDate DESC`, [filter, filter]),
            db.promise().query(`SELECT ji.jobCardId, ii.itemName, ji.quantityUsed, ji.pricePerUnit,
                               (ji.quantityUsed * ji.pricePerUnit) AS totalCost, j.createdDate
                               FROM job_item ji JOIN inventory_item ii ON ji.itemId = ii.itemId
                               JOIN job_card j ON ji.jobCardId = j.jobCardId
                               WHERE (? IS NULL OR DATE(j.createdDate) = ?)
                               ORDER BY j.createdDate DESC`, [filter, filter])
        ]);
        res.json({ invoices, payments, sparePartsUsed });
    } catch (error) {
        console.error('Could not load financial records:', error);
        res.status(500).json({ error: 'Could not load financial records.' });
    }
});

app.get('/api/manager/inventory', (req, res) => {

    const sql = "SELECT * FROM inventory_item WHERE isActive = 1 ORDER BY quantityInStock ASC";
    db.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching inventory:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(result);
    });
});

app.get('/api/manager/business-reports', (req, res) => {
    const sqlInv = `
        SELECT
            COUNT(*) as totalCategories,
            SUM(quantityInStock) as totalItems,
            SUM(quantityInStock * unitPrice) as totalStockValue,
            SUM(CASE WHEN quantityInStock <= reorderLevel THEN 1 ELSE 0 END) as lowStockCount
        FROM inventory_item
        WHERE isActive = 1
    `;

    db.query(sqlInv, (error, rows) => {
        if (error) return res.status(500).json({ error: error.message });
        res.json({ inventorySummary: rows[0] || {} });
    });
});

};
