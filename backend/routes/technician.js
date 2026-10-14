const db = require('../db');

module.exports = function registerTechnicianRoutes(app) {
app.get('/api/technician/assigned-jobs/:technicianId', (req, res) => {
  const { technicianId } = req.params;

  const query = `
    SELECT
      jc.jobCardId, jc.status, jc.stageName, jc.instructionComment, jc.createdDate,
      sr.repairRequirements, sr.description AS serviceDescription, sr.damagedParts,
      (SELECT startTime FROM job_time_log WHERE jobCardId = jc.jobCardId AND status = 'RUNNING' AND endTime IS NULL ORDER BY logId DESC LIMIT 1) AS startTime,
      (SELECT MAX(endTime) FROM job_time_log WHERE jobCardId = jc.jobCardId) AS endTime,
      (SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, startTime, endTime)), 0) FROM job_time_log WHERE jobCardId = jc.jobCardId AND startTime IS NOT NULL AND endTime IS NOT NULL) AS accumulatedMinutes,
      v.vehicleId, v.registrationNo, v.make, v.model,
      (SELECT status FROM job_time_log WHERE jobCardId = jc.jobCardId ORDER BY logId DESC LIMIT 1) AS timerStatus
    FROM job_card jc
    LEFT JOIN service_request sr ON jc.requestId = sr.requestId
    LEFT JOIN vehicle v ON v.vehicleId = COALESCE(sr.vehicleId, jc.vehicleId)
    WHERE jc.technicianId = ? AND jc.status != 'REJECTED'
    ORDER BY
      CASE
        WHEN jc.status IN ('CREATED', 'ASSIGNED', 'PENDING') THEN 1
        WHEN jc.status = 'ACCEPTED' THEN 2
        WHEN jc.status IN ('IN_PROGRESS', 'ONGOING', 'RUNNING') THEN 3
        WHEN jc.status = 'PAUSED' THEN 4
        ELSE 5
      END ASC, jc.createdDate DESC
  `;

  db.query(query, [technicianId], (err, jobs) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    if (!jobs || jobs.length === 0) {
      return res.json({ success: true, jobs: [] });
    }

    const jobIds = jobs.map(j => j.jobCardId);
    const partsQuery = `
      SELECT ji.jobCardId, ii.itemName, ji.quantityUsed, ji.pricePerUnit
      FROM job_item ji
      JOIN inventory_item ii ON ji.itemId = ii.itemId
      WHERE ji.jobCardId IN (?)
    `;

    db.query(partsQuery, [jobIds], (err2, parts) => {
      if (err2) return res.status(500).json({ success: false, error: err2.message });

      const formattedJobs = jobs.map(job => ({
        ...job,
        spareParts: parts ? parts.filter(p => p.jobCardId === job.jobCardId) : []
      }));

      res.json({ success: true, jobs: formattedJobs });
    });
  });
});

app.put('/api/technician/accept-job/:jobCardId', async (req, res) => {
  const { jobCardId } = req.params;
  const { technicianId } = req.body;
  if (!technicianId) return res.status(400).json({ success: false, error: 'Technician is required.' });

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE job_card SET status = 'ACCEPTED' WHERE jobCardId = ? AND technicianId = ? AND status IN ('CREATED', 'ASSIGNED', 'PENDING')",
      [jobCardId, technicianId]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'This job is no longer pending for this technician.' });
    }
    await connection.query(
      "INSERT INTO job_time_log (jobCardId, technicianId, startTime, status) VALUES (?, ?, NOW(), 'ACCEPTED')",
      [jobCardId, technicianId]
    );
    await connection.commit();
    res.json({ success: true, message: 'Job Accepted Successfully!' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Job acceptance failed:', error);
    res.status(500).json({ success: false, error: 'Could not accept the job.' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/technician/reject-job/:jobCardId', async (req, res) => {
  const { jobCardId } = req.params;
  const { reason, technicianId } = req.body;
  const rejectionReason = typeof reason === 'string' ? reason.trim() : '';
  if (!technicianId || !rejectionReason) {
    return res.status(400).json({ success: false, error: 'Technician and rejection reason are required.' });
  }

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE job_card SET status = 'REJECTED' WHERE jobCardId = ? AND technicianId = ? AND status IN ('CREATED', 'ASSIGNED', 'PENDING')",
      [jobCardId, technicianId]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'This job is no longer pending for this technician.' });
    }
    await connection.query(
      "INSERT INTO job_time_log (jobCardId, technicianId, startTime, status, rejectReason) VALUES (?, ?, NOW(), 'REJECTED', ?)",
      [jobCardId, technicianId, rejectionReason]
    );
    await connection.commit();
    res.json({ success: true, message: 'Job rejected and reason recorded.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Job rejection failed:', error);
    res.status(500).json({ success: false, error: 'Could not reject the job.' });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/technician/job-history/:technicianId', (req, res) => {
  const { technicianId } = req.params;
  const sql = `
    SELECT jc.jobCardId, jc.stageName, jc.createdDate, jc.status AS jobStatus,
           v.registrationNo, decision.status AS decision,
           decision.rejectReason, decision.startTime AS decisionAt,
           CASE WHEN jc.technicianId = ? THEN 1 ELSE 0 END AS stillAssigned
    FROM job_card jc
    LEFT JOIN service_request sr ON jc.requestId = sr.requestId
    LEFT JOIN vehicle v ON v.vehicleId = COALESCE(sr.vehicleId, jc.vehicleId)
    LEFT JOIN job_time_log decision ON decision.logId = (
      SELECT MAX(logId) FROM job_time_log
      WHERE jobCardId = jc.jobCardId AND technicianId = ?
        AND status IN ('ACCEPTED', 'REJECTED')
    )
    WHERE decision.logId IS NOT NULL
       OR (jc.technicianId = ? AND jc.status NOT IN ('CREATED', 'ASSIGNED', 'PENDING'))
       OR EXISTS (
         SELECT 1 FROM job_time_log worked
         WHERE worked.jobCardId = jc.jobCardId AND worked.technicianId = ?
           AND worked.status IN ('RUNNING', 'PAUSED', 'COMPLETED')
       )
    ORDER BY COALESCE(decision.startTime, jc.createdDate) DESC, jc.jobCardId DESC
  `;
  db.query(sql, [technicianId, technicianId, technicianId, technicianId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const history = rows.map(row => ({
      ...row,
      decision: row.decision || (row.jobStatus === 'REJECTED' ? 'REJECTED' : 'ACCEPTED')
    }));
    res.json({ success: true, history });
  });
});

app.post('/api/technician/start-work', async (req, res) => {
  const { jobCardId, technicianId } = req.body;
  if (!jobCardId || !technicianId) return res.status(400).json({ success: false, error: 'Job and technician are required.' });

  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE job_card SET status = 'IN_PROGRESS' WHERE jobCardId = ? AND technicianId = ? AND status = 'ACCEPTED'",
      [jobCardId, technicianId]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'Accept the assigned job before starting work.' });
    }
    await connection.query(
      "INSERT INTO job_time_log (jobCardId, technicianId, startTime, status) VALUES (?, ?, NOW(), 'RUNNING')",
      [jobCardId, technicianId]
    );
    await connection.commit();
    res.json({ success: true, message: 'Work Started Successfully!' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

app.put('/api/technician/toggle-work-status', async (req, res) => {
  const { jobCardId, technicianId, action, reason } = req.body;
  if (!jobCardId || !technicianId || !['PAUSE', 'RESUME'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Job, technician, and valid action are required.' });
  }

  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const pausing = action === 'PAUSE';
    const [result] = await connection.query(
      'UPDATE job_card SET status = ? WHERE jobCardId = ? AND technicianId = ? AND status = ?',
      [pausing ? 'PAUSED' : 'IN_PROGRESS', jobCardId, technicianId, pausing ? 'IN_PROGRESS' : 'PAUSED']
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'Job is not in the expected state.' });
    }
    if (pausing) {
      const [logResult] = await connection.query(
        "UPDATE job_time_log SET endTime = NOW(), status = 'PAUSED', rejectReason = ? WHERE jobCardId = ? AND technicianId = ? AND status = 'RUNNING' AND endTime IS NULL ORDER BY logId DESC LIMIT 1",
        [reason || null, jobCardId, technicianId]
      );
      if (!logResult.affectedRows) {
        await connection.rollback();
        return res.status(409).json({ success: false, error: 'No running time log was found.' });
      }
    } else {
      await connection.query(
        "INSERT INTO job_time_log (jobCardId, technicianId, startTime, status) VALUES (?, ?, NOW(), 'RUNNING')",
        [jobCardId, technicianId]
      );
    }
    await connection.commit();
    res.json({ success: true, message: pausing ? 'Work paused.' : 'Work resumed.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

app.put('/api/technician/complete-work', async (req, res) => {
  const { jobCardId } = req.body;
  if (!jobCardId) return res.status(400).json({ success: false, error: 'Job is required.' });

  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE job_card SET status = 'COMPLETED' WHERE jobCardId = ? AND status IN ('IN_PROGRESS', 'PAUSED')",
      [jobCardId]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'Job is not in progress.' });
    }
    await connection.query(
      "UPDATE job_time_log SET endTime = NOW(), status = 'COMPLETED' WHERE jobCardId = ? AND status = 'RUNNING' AND endTime IS NULL",
      [jobCardId]
    );
    await connection.commit();
    res.json({ success: true, message: 'Work Completed Successfully!' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/technician/working-hours/:technicianId', (req, res) => {
  const { technicianId } = req.params;
  const sql = `
    SELECT
      jtl.jobCardId, v.registrationNo,
      TIMESTAMPDIFF(MINUTE, jtl.startTime, IFNULL(jtl.endTime, NOW())) AS durationMinutes,
      jtl.status, jtl.startTime, jtl.endTime
    FROM job_time_log jtl
    JOIN job_card jc ON jtl.jobCardId = jc.jobCardId
    LEFT JOIN service_request sr ON jc.requestId = sr.requestId
    LEFT JOIN vehicle v ON v.vehicleId = COALESCE(sr.vehicleId, jc.vehicleId)
    WHERE jtl.technicianId = ? AND jtl.status IN ('RUNNING', 'PAUSED', 'COMPLETED')
    ORDER BY jtl.startTime DESC
  `;
  db.query(sql, [technicianId], (err, results) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, logs: results });
  });
});

app.post('/api/technician/request-advance', (req, res) => {
  const { technicianId, amount, reason } = req.body;
  const sql = "INSERT INTO salary_advance (technicianId, amount, reason) VALUES (?, ?, ?)";
  db.query(sql, [technicianId, amount, reason], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: 'Salary Advance Requested Successfully!' });
  });
});

app.get('/api/technician/salary-details/:technicianId', (req, res) => {
  const { technicianId } = req.params;
  const sql = "SELECT * FROM salary_advance WHERE technicianId = ? ORDER BY requestedDate DESC";
  db.query(sql, [technicianId], (err, requests) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const totalAdvance = requests
      ? requests.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + parseFloat(r.amount), 0)
      : 0;

    const baseSalary = (requests && requests.length > 0) ? (requests[0].monthlyBaseSalary || 75000.00) : 75000.00;

    res.json({
      success: true,
      requests: requests || [],
      summary: {
        baseSalary,
        totalAdvance,
        remainingSalary: baseSalary - totalAdvance,
        payDate: 'End of Month (30th/31st)'
      }
    });
  });
});
};
