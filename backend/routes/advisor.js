const db = require('../db');

module.exports = function registerAdvisorRoutes(app) {
const fullyClosedVehicleSql = `
    UPPER(v.status) = 'RELEASED'
    AND EXISTS (
        SELECT 1 FROM service_request finished
        WHERE finished.vehicleId = v.vehicleId AND UPPER(finished.status) = 'COMPLETED'
    )
    AND NOT EXISTS (
        SELECT 1 FROM service_request unfinished
        WHERE unfinished.vehicleId = v.vehicleId AND UPPER(unfinished.status) <> 'COMPLETED'
    )
    AND EXISTS (
        SELECT 1 FROM invoice paid
        JOIN job_card paidJob ON paidJob.jobCardId = paid.jobCardId
        LEFT JOIN service_request paidRequest ON paidRequest.requestId = paidJob.requestId
        WHERE COALESCE(paidJob.vehicleId, paidRequest.vehicleId) = v.vehicleId
          AND UPPER(paid.paymentStatus) = 'PAID'
    )
    AND NOT EXISTS (
        SELECT 1 FROM invoice unpaid
        JOIN job_card unpaidJob ON unpaidJob.jobCardId = unpaid.jobCardId
        LEFT JOIN service_request unpaidRequest ON unpaidRequest.requestId = unpaidJob.requestId
        WHERE COALESCE(unpaidJob.vehicleId, unpaidRequest.vehicleId) = v.vehicleId
          AND COALESCE(UPPER(unpaid.paymentStatus), '') <> 'PAID'
    )
    AND NOT EXISTS (
        SELECT 1 FROM job_card activeJob
        LEFT JOIN service_request activeRequest ON activeRequest.requestId = activeJob.requestId
        WHERE COALESCE(activeJob.vehicleId, activeRequest.vehicleId) = v.vehicleId
          AND UPPER(activeJob.status) NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')
    )
`;

app.get('/api/sa/vehicles', (req, res) => {
    const sql = `SELECT v.*, (${fullyClosedVehicleSql}) AS isFullyClosed
                 FROM vehicle v ORDER BY v.registeredDate DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, vehicles: results });
    });
});

app.get('/api/sa/pending-registrations', (req, res) => {
    const sql = `
        SELECT v.vehicleId, v.registrationNo, c.customerId, c.name AS customerName
        FROM vehicle v
        JOIN customer c ON c.customerId = v.customerId
        WHERE v.status = 'PENDING_ADVISOR'
        ORDER BY c.name, v.registrationNo
    `;
    db.query(sql, (err, registrations) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, registrations });
    });
});

app.put('/api/sa/register-vehicle/:vehicleId', (req, res) => {
    const { customerId, make, model, year } = req.body;
    if (![customerId, make, model].every(value => typeof value === 'string' && value.trim())) {
        return res.status(400).json({ success: false, error: 'Select a customer and enter the vehicle make and model.' });
    }
    const sql = `
        UPDATE vehicle SET make = ?, model = ?, year = ?, status = 'REGISTERED'
        WHERE vehicleId = ? AND customerId = ? AND status = 'PENDING_ADVISOR'
    `;
    db.query(sql, [make.trim(), model.trim(), year || null, req.params.vehicleId, customerId], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!result.affectedRows) return res.status(409).json({ success: false, error: 'This vehicle is no longer pending registration. Refresh the list.' });
        res.json({ success: true, message: 'Vehicle registration completed.', vehicleId: req.params.vehicleId });
    });
});

app.post('/api/sa/inspection-report', (req, res) => {
    const { vehicleId, fuelLevel, mileage, damagedParts, repairRequirements, description } = req.body;
    const requestId = 'REQ_' + Date.now();

    const sql = `INSERT INTO service_request
        (requestId, vehicleId, customerId, fuelLevel, mileage, damagedParts, repairRequirements, description, isCustomModification, modApprovalStatus, qualityCheckStatus, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT_CHECKED', 'Pending')`;

    db.query('SELECT status, customerId FROM vehicle WHERE vehicleId = ?', [vehicleId], (lookupError, vehicles) => {
        if (lookupError) return res.status(500).json({ success: false, error: lookupError.message });
        if (!vehicles.length) return res.status(404).json({ success: false, error: 'Vehicle not found.' });
        if (vehicles[0].status === 'PENDING_ADVISOR') {
            return res.status(409).json({ success: false, error: 'Complete vehicle registration before creating an inspection report.' });
        }
        db.query(sql, [requestId, vehicleId, vehicles[0].customerId || null, fuelLevel, mileage || 0, damagedParts, repairRequirements, description, 0, 'N/A'], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            db.query("UPDATE vehicle SET status = 'INSPECTED' WHERE vehicleId = ?", [vehicleId]);
            res.json({ success: true, message: "Inspection Report Saved & Service Request Created!", requestId });
        });
    });
});

app.get('/api/sa/requests', (req, res) => {
    const sql = `
        SELECT sr.*, v.registrationNo, (${fullyClosedVehicleSql}) AS isFullyClosed
        FROM service_request sr
        JOIN vehicle v ON sr.vehicleId = v.vehicleId
        ORDER BY sr.requestDate DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, requests: results });
    });
});

app.get('/api/sa/technicians', (req, res) => {
    const sql = `
        SELECT u.userId, u.name
        FROM user u
        INNER JOIN technician t ON u.userId = t.technicianId
        WHERE UPPER(REPLACE(u.role, ' ', '_')) IN ('TECHNICIAN', 'TECH')
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, technicians: results });
    });
});

app.get('/api/sa/spare-parts', (req, res) => {
    const sql = "SELECT itemId, itemName, unitPrice, quantityInStock FROM inventory_item WHERE isActive = 1";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, items: results });
    });
});

app.post('/api/sa/assign-technician', (req, res) => {
    const { requestId, advisorId, technicianId, stageName, instructionComment } = req.body;
    const jobCardId = 'JOB_' + Date.now();

    const sql = `INSERT INTO job_card
        (jobCardId, requestId, vehicleId, advisorId, technicianId, stageName, instructionComment, status)
        VALUES (?, ?, (SELECT vehicleId FROM service_request WHERE requestId = ?), ?, ?, ?, ?, 'PENDING')`;

    db.query(sql, [jobCardId, requestId, requestId, advisorId || null, technicianId, stageName || 'Stage 1', instructionComment], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        db.query("UPDATE service_request SET status = 'IN_PROGRESS' WHERE requestId = ?", [requestId]);
        db.query("UPDATE vehicle v JOIN service_request sr ON v.vehicleId = sr.vehicleId SET v.status = 'IN_REPAIR' WHERE sr.requestId = ?", [requestId]);

        res.json({ success: true, message: "Job Card Created & Technician Assigned!", jobCardId });
    });
});

app.post('/api/sa/assign-spare-parts', async (req, res) => {
    const { jobCardId, itemId, quantityUsed } = req.body;
    const quantity = Number(quantityUsed);
    if (!jobCardId || !itemId || !Number.isSafeInteger(quantity) || quantity < 1) {
        return res.status(400).json({ success: false, error: 'Select a job and part, and enter a positive whole quantity.' });
    }
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [[job]] = await connection.query('SELECT jobCardId FROM job_card WHERE jobCardId = ?', [jobCardId]);
        const [[part]] = await connection.query(
            'SELECT unitPrice, quantityInStock FROM inventory_item WHERE itemId = ? AND isActive = 1 FOR UPDATE', [itemId]
        );
        if (!job || !part || part.quantityInStock < quantity) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: 'Job or active part was not found, or stock is insufficient.' });
        }
        await connection.query(
            'INSERT INTO job_item (jobCardId, itemId, quantityUsed, pricePerUnit) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantityUsed = quantityUsed + VALUES(quantityUsed)',
            [jobCardId, itemId, quantity, part.unitPrice]
        );
        await connection.query('UPDATE inventory_item SET quantityInStock = quantityInStock - ? WHERE itemId = ?', [quantity, itemId]);
        await connection.commit();
        res.json({ success: true, message: 'Spare Part Allocated to Job!' });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ success: false, error: 'Could not allocate spare part.' });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/sa/job-progress', (req, res) => {
    const sql = `
        SELECT j.jobCardId, v.registrationNo, j.stageName, j.status as jobStatus,
               u.name as techName, j.instructionComment, sr.isCustomModification, sr.requestId,
               decision.status AS technicianDecision, decision.rejectReason,
               decision.startTime AS decisionAt,
               (${fullyClosedVehicleSql}) AS isFullyClosed
        FROM job_card j
        LEFT JOIN service_request sr ON j.requestId = sr.requestId
        LEFT JOIN vehicle v ON v.vehicleId = COALESCE(sr.vehicleId, j.vehicleId)
        LEFT JOIN user u ON j.technicianId = u.userId
        LEFT JOIN job_time_log decision ON decision.logId = (
            SELECT MAX(logId) FROM job_time_log
            WHERE jobCardId = j.jobCardId AND status IN ('ACCEPTED', 'REJECTED')
        )
        ORDER BY j.createdDate DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, progress: results.map(job => ({
            ...job,
            technicianDecision: job.technicianDecision || (
                job.jobStatus === 'REJECTED' ? 'REJECTED' :
                ['ACCEPTED', 'IN_PROGRESS', 'ONGOING', 'RUNNING', 'PAUSED', 'COMPLETED', 'DONE'].includes(job.jobStatus) ? 'ACCEPTED' : 'PENDING'
            )
        })) });
    });
});

app.post('/api/sa/quality-check', async (req, res) => {
    const { requestId, qualityCheckStatus, qualityRemarks, releaseApproved } = req.body;
    if (!requestId || !['PASS', 'FAIL'].includes(qualityCheckStatus) ||
        (releaseApproved && qualityCheckStatus !== 'PASS')) {
        return res.status(400).json({ success: false, error: 'Select a request and a valid quality status. Release requires a pass.' });
    }
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [[request]] = await connection.query(
            'SELECT vehicleId, isCustomModification, modApprovalStatus FROM service_request WHERE requestId = ? FOR UPDATE', [requestId]
        );
        if (!request) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: 'Service request not found.' });
        }
        if (releaseApproved) {
            const [[work]] = await connection.query(`
                SELECT COUNT(*) AS jobCount,
                       SUM(CASE WHEN UPPER(status) = 'COMPLETED' THEN 1 ELSE 0 END) AS completedCount
                FROM job_card WHERE requestId = ? AND UPPER(status) NOT IN ('REJECTED', 'CANCELLED')`, [requestId]);
            const [[pending]] = await connection.query(`
                SELECT COUNT(*) AS count FROM custom_modification_request cm
                JOIN job_card j ON j.jobCardId = cm.jobCardId
                WHERE j.requestId = ? AND UPPER(cm.status) = 'PENDING'`, [requestId]);
            if (!work.jobCount || Number(work.completedCount) !== Number(work.jobCount) || pending.count ||
                (request.isCustomModification && String(request.modApprovalStatus).toUpperCase() === 'PENDING')) {
                await connection.rollback();
                return res.status(409).json({ success: false,
                    error: 'Finish all jobs and handle pending modification requests before approving release.' });
            }
        }
        await connection.query(
            `UPDATE service_request SET qualityCheckStatus = ?, qualityRemarks = ?,
             status = CASE WHEN ? THEN 'COMPLETED' ELSE status END WHERE requestId = ?`,
            [qualityCheckStatus, qualityRemarks || null, Boolean(releaseApproved), requestId]
        );
        if (releaseApproved) {
            await connection.query("UPDATE vehicle SET status = 'RELEASED' WHERE vehicleId = ?", [request.vehicleId]);
        }
        await connection.commit();
        res.json({ success: true, message: 'Quality check and release status updated.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Quality check failed:', error);
        res.status(500).json({ success: false, error: 'Could not update the quality check.' });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/sa/approve-mod', (req, res) => {
    const { requestId, modRequestId, modApprovalStatus } = req.body;
    if (modApprovalStatus !== 'REJECTED' || (!requestId && !modRequestId)) {
        return res.status(400).json({ success: false, error: 'A pending modification request is required.' });
    }
    const sql = modRequestId
        ? "UPDATE custom_modification_request SET status = 'REJECTED' WHERE modRequestId = ? AND status = 'PENDING'"
        : "UPDATE service_request SET modApprovalStatus = 'REJECTED' WHERE requestId = ? AND isCustomModification = 1 AND modApprovalStatus = 'PENDING'";
    db.query(sql, [modRequestId || requestId], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!result.affectedRows) return res.status(409).json({ success: false, error: 'This modification has already been handled.' });
        res.json({ success: true, message: 'Custom Modification REJECTED!' });
    });
});

app.get('/api/sa/reassign-mods-data', (req, res) => {
    const completedJobsSql = `
        SELECT j.jobCardId, j.requestId, j.stageName, v.registrationNo, u.name as techName
        FROM job_card j
        JOIN service_request sr ON j.requestId = sr.requestId
        JOIN vehicle v ON sr.vehicleId = v.vehicleId
        LEFT JOIN user u ON j.technicianId = u.userId
        WHERE j.status = 'COMPLETED' AND sr.status != 'COMPLETED'
    `;

    const pendingModsSql = `
        SELECT sr.requestId, NULL AS modRequestId, v.registrationNo,
               sr.repairRequirements, c.name AS customerName,
               sr.requestDate AS submittedAt, 'INSPECTION' AS source
        FROM service_request sr
        JOIN vehicle v ON sr.vehicleId = v.vehicleId
        LEFT JOIN customer c ON c.customerId = COALESCE(sr.customerId, v.customerId)
        WHERE sr.isCustomModification = 1 AND sr.modApprovalStatus = 'PENDING'
        UNION ALL
        SELECT j.requestId, cm.modRequestId, v.registrationNo,
               cm.requestNote AS repairRequirements, c.name AS customerName,
               cm.createdDate AS submittedAt, 'CUSTOMER' AS source
        FROM custom_modification_request cm
        JOIN job_card j ON j.jobCardId = cm.jobCardId
        LEFT JOIN service_request sr ON sr.requestId = j.requestId
        JOIN vehicle v ON v.vehicleId = COALESCE(j.vehicleId, sr.vehicleId)
        LEFT JOIN customer c ON c.customerId = v.customerId
        WHERE cm.status = 'PENDING'
        ORDER BY submittedAt DESC
    `;

    db.query(completedJobsSql, (err1, jobs) => {
        if (err1) return res.status(500).json({ success: false, error: err1.message });
        db.query(pendingModsSql, (err2, mods) => {
            if (err2) return res.status(500).json({ success: false, error: err2.message });
            res.json({ success: true, completedJobs: jobs, pendingMods: mods });
        });
    });
});

app.post('/api/sa/approve-mod-assign', async (req, res) => {
    const { requestId, modRequestId, advisorId, technicianId, stageName, instructionComment } = req.body;
    if ((!requestId && !modRequestId) || !technicianId) {
        return res.status(400).json({ success: false, error: 'Modification request and technician are required.' });
    }

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        let targetRequestId = requestId;
        let vehicleId;
        let customerNote = '';

        if (modRequestId) {
            const [update] = await connection.query(
                "UPDATE custom_modification_request SET status = 'APPROVED' WHERE modRequestId = ? AND status = 'PENDING'",
                [modRequestId]
            );
            if (!update.affectedRows) {
                await connection.rollback();
                return res.status(409).json({ success: false, error: 'This modification has already been handled.' });
            }
            const [rows] = await connection.query(`
                SELECT j.requestId, COALESCE(j.vehicleId, sr.vehicleId) AS vehicleId, cm.requestNote
                FROM custom_modification_request cm
                JOIN job_card j ON j.jobCardId = cm.jobCardId
                LEFT JOIN service_request sr ON sr.requestId = j.requestId
                WHERE cm.modRequestId = ?`, [modRequestId]);
            if (!rows.length || !rows[0].vehicleId) throw new Error('The original job or vehicle was not found.');
            targetRequestId = rows[0].requestId;
            vehicleId = rows[0].vehicleId;
            customerNote = rows[0].requestNote || '';
        } else {
            const [update] = await connection.query(
                "UPDATE service_request SET modApprovalStatus = 'APPROVED', status = 'IN_PROGRESS' WHERE requestId = ? AND isCustomModification = 1 AND modApprovalStatus = 'PENDING'",
                [requestId]
            );
            if (!update.affectedRows) {
                await connection.rollback();
                return res.status(409).json({ success: false, error: 'This modification has already been handled.' });
            }
            const [rows] = await connection.query('SELECT vehicleId FROM service_request WHERE requestId = ?', [requestId]);
            vehicleId = rows[0].vehicleId;
        }

        const jobCardId = 'JOB_' + Date.now();
        const notes = [customerNote.trim(), String(instructionComment || '').trim()]
            .filter((note, index, all) => note && all.indexOf(note) === index)
            .join('\n\nAdvisor notes: ');
        await connection.query(`
            INSERT INTO job_card (jobCardId, requestId, vehicleId, advisorId, technicianId, stageName, instructionComment, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [jobCardId, targetRequestId, vehicleId, advisorId || null, technicianId, stageName || 'Custom Mod', notes]
        );
        await connection.query("UPDATE vehicle SET status = 'IN_REPAIR' WHERE vehicleId = ?", [vehicleId]);
        if (targetRequestId) {
            await connection.query("UPDATE service_request SET status = 'IN_PROGRESS' WHERE requestId = ?", [targetRequestId]);
        }
        await connection.commit();
        res.json({ success: true, message: 'Modification Approved & Technician Assigned!', jobCardId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Modification approval failed:', error);
        res.status(500).json({ success: false, error: 'Could not approve the modification.' });
    } finally {
        if (connection) connection.release();
    }
});
};
