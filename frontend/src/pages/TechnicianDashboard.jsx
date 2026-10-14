import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/TechnicianDashboard.css';

const API_BASE = 'http://localhost:5000/api/technician';

function JobAssignmentDetails({ job }) {
  if (!job) return null;
  const vehicleModel = [job.make, job.model].filter(Boolean).join(' ');

  return (
    <div className="tech-assignment-details">
      <div><strong>Vehicle</strong><span>{job.registrationNo || job.vehicleId || 'N/A'}{vehicleModel && ` · ${vehicleModel}`}</span></div>
      <div><strong>Vehicle ID</strong><span>{job.vehicleId || 'N/A'}</span></div>
      <div><strong>Job card</strong><span>{job.jobCardId}</span></div>
      <div><strong>Repair stage</strong><span>{job.stageName || 'Not specified'}</span></div>
      <div><strong>Work requested</strong><span>{job.repairRequirements || 'No repair requirements recorded.'}</span></div>
      {job.serviceDescription && <div><strong>Inspection notes</strong><span>{job.serviceDescription}</span></div>}
      {job.damagedParts && <div><strong>Damaged parts</strong><span>{job.damagedParts}</span></div>}
      <div><strong>Advisor instructions</strong><span>{job.instructionComment || 'No additional instructions.'}</span></div>
      <div>
        <strong>Assigned parts</strong>
        <span>{job.spareParts?.length ? job.spareParts.map(part => `${part.itemName} × ${part.quantityUsed}`).join(', ') : 'No parts assigned yet.'}</span>
      </div>
    </div>
  );
}

export default function TechnicianDashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [expandedJobId, setExpandedJobId] = useState(null);

  const [newJobAlert, setNewJobAlert] = useState(null);

  const [pendingModal, setPendingModal] = useState({ open: false, job: null, showRejectInput: false, rejectReason: '' });

  const [startModal, setStartModal] = useState({ open: false, jobId: null });
  const [actionModal, setActionModal] = useState({ open: false, job: null });

  const [pauseReason, setPauseReason] = useState('');
  const [showPauseInput, setShowPauseInput] = useState(false);

  const [techNotes, setTechNotes] = useState({});
  const [now, setNow] = useState(Date.now());

  const [timeLogs, setTimeLogs] = useState([]);
  const [jobHistory, setJobHistory] = useState([]);
  const [salaryData, setSalaryData] = useState({ requests: [], summary: {} });
  const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '' });

  const techId = user?.userId || 'TECH_001';

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common.Authorization;
    sessionStorage.clear();
    if (typeof setUser === 'function') setUser(null);
    window.location.href = '/';
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/assigned-jobs/${techId}`);
      if (res.data.success) {
        const fetchedJobs = res.data.jobs || [];
        setJobs(fetchedJobs);

        const newlyAssigned = fetchedJobs.find(j =>
          ['PENDING', 'CREATED', 'ASSIGNED'].includes(j.status?.toUpperCase())
        );
        setNewJobAlert(newlyAssigned || null);
      }
    } catch (err) {
      console.error(err);
    }
  }, [techId]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const fetchWorkingHours = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/working-hours/${techId}`);
      if (res.data.success) setTimeLogs(res.data.logs || []);
    } catch (err) { console.error(err); }
  }, [techId]);

  const fetchJobHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/job-history/${techId}`);
      if (res.data.success) setJobHistory(res.data.history || []);
    } catch (err) { console.error(err); }
  }, [techId]);

  const fetchSalary = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/salary-details/${techId}`);
      if (res.data.success) setSalaryData(res.data);
    } catch (err) { console.error(err); }
  }, [techId]);

  useEffect(() => {
    if (activeTab === 'hours') fetchWorkingHours();
    if (activeTab === 'history') fetchJobHistory();
    if (activeTab === 'salary') fetchSalary();
  }, [activeTab, fetchWorkingHours, fetchJobHistory, fetchSalary]);

const handleAcceptJob = async (jobIdToAccept) => {
    const jobId = jobIdToAccept || pendingModal.job?.jobCardId;
    try {
      const res = await axios.put(`${API_BASE}/accept-job/${jobId}`, { technicianId: techId });
      if (res.data.success) {
        setNewJobAlert(null);
        setPendingModal({ open: false, job: null, showRejectInput: false, rejectReason: '' });
        fetchJobs();
        fetchJobHistory();
      }
    } catch (err) {
      alert('Failed to accept job');
    }
  };

  const handleRejectSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pendingModal.rejectReason.trim()) return alert("Please enter a reason for rejection.");

    try {
      await axios.put(`${API_BASE}/reject-job/${pendingModal.job?.jobCardId || newJobAlert?.jobCardId}`, {
        reason: pendingModal.rejectReason,
        technicianId: techId
      });
      setPendingModal({ open: false, job: null, showRejectInput: false, rejectReason: '' });
      setNewJobAlert(null);
      fetchJobs();
      fetchJobHistory();
    } catch (err) {
      alert('Failed to reject job');
    }
  };

  const handleStartWork = async (targetJobId) => {
    const jobIdToStart = targetJobId || startModal.jobId;
    try {
      await axios.post(`${API_BASE}/start-work`, { jobCardId: jobIdToStart, technicianId: techId });
      setStartModal({ open: false, jobId: null });
      setActionModal({ open: false, job: null });
      fetchJobs();
      if (activeTab === 'hours') fetchWorkingHours();
    } catch (err) { alert('Failed to start work'); }
  };

  const handleWorkToggle = async (action) => {
    if (action === 'PAUSE' && !pauseReason.trim()) {
      alert('Please provide a reason for pausing the work.');
      return;
    }
    try {
      await axios.put(`${API_BASE}/toggle-work-status`, {
        jobCardId: actionModal.job.jobCardId,
        action,
        reason: action === 'PAUSE' ? pauseReason : '',
        technicianId: techId
      });
      setActionModal({ open: false, job: null });
      setShowPauseInput(false);
      setPauseReason('');
      fetchJobs();
      if (activeTab === 'hours') fetchWorkingHours();
    } catch (err) { alert('Error updating status'); }
  };

  const handleCompleteWork = async () => {
    try {
      await axios.put(`${API_BASE}/complete-work`, {
        jobCardId: actionModal.job.jobCardId,
        technicianId: techId
      });
      setActionModal({ open: false, job: null });
      fetchJobs();
      if (activeTab === 'hours') fetchWorkingHours();
    } catch (err) { alert('Error completing job'); }
  };

  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/request-advance`, { ...advanceForm, technicianId: techId });
      alert('Advance Request Submitted!');
      setAdvanceForm({ amount: '', reason: '' });
      fetchSalary();
    } catch (err) { alert('Error submitting request'); }
  };

  const formatTimer = (startTime, accumulatedMins = 0) => {
    if (!startTime) return '00:00:00';
    const currentRunSecs = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000));
    const totalSecs = currentRunSecs + (accumulatedMins * 60);

    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(Math.floor(totalSecs % 60)).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const calculateTotalHours = () => {
    if (!Array.isArray(timeLogs)) return '0.00';
    const totalMins = timeLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
    return (totalMins / 60).toFixed(2);
  };

  const pendingJobs = jobs.filter(j => ['PENDING', 'CREATED', 'ASSIGNED'].includes(j.status?.toUpperCase()));
  const activeJobs = jobs.filter(j => !['PENDING', 'CREATED', 'ASSIGNED', 'REJECTED'].includes(j.status?.toUpperCase()));

return (
    <div className="tech-dashboard-container">
      <div className="tech-header">
        <h2>🛠️ Technician Dashboard</h2>
        <div className="tech-user-info">
          <span>Welcome, <b>{user?.name || 'Technician'}</b></span>
          <button className="btn-logout" onClick={handleLogout}>🚪 LOGOUT</button>
        </div>
      </div>

      {newJobAlert && !pendingModal.open && (
        <div className="tech-alert-overlay">
          <div className="tech-red-alert-card flashing-alert">
            <span className="tech-alert-icon">🚨</span>
            <h2 className="alert-title">NEW JOB ASSIGNED!</h2>
            <JobAssignmentDetails job={newJobAlert} />
            <div className="alert-actions" style={{ marginTop: '15px' }}>
              <button className="tech-btn btn-accept-main" onClick={() => handleAcceptJob(newJobAlert.jobCardId)}>
                ACCEPT JOB
              </button>
              <button className="tech-btn btn-danger-sm" onClick={() => setPendingModal({ open: true, job: newJobAlert, showRejectInput: true, rejectReason: '' })}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tech-nav-tabs">
        <button className={`tech-tab-btn ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>📋 Assigned Jobs</button>
        <button className={`tech-tab-btn ${activeTab === 'hours' ? 'active' : ''}`} onClick={() => setActiveTab('hours')}>⏱️ Working Hours</button>
        <button className={`tech-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📚 Work History</button>
        <button className={`tech-tab-btn ${activeTab === 'salary' ? 'active' : ''}`} onClick={() => setActiveTab('salary')}>💰 Salary & Advances</button>
      </div>

      {activeTab === 'jobs' && (
        <div className="tech-card-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {pendingJobs.length > 0 && (
            <div className="tech-card" style={{ borderLeft: '5px solid #ef4444', backgroundColor: '#fef2f2' }}>
              <h3 style={{ color: '#dc2626', marginTop: 0 }}>🚨 New Pending Job Requests</h3>
              <div className="tech-job-list">
                {pendingJobs.map(job => {
                  const isExpanded = expandedJobId === job.jobCardId;
                  return (
                    <div key={job.jobCardId} className="tech-job-bar" style={{ border: '1px solid #fca5a5', backgroundColor: '#fff' }}>
                      <div className="tech-job-bar-header" onClick={() => setExpandedJobId(isExpanded ? null : job.jobCardId)}>
                        <div className="tech-bar-left">
                          <span className="red-dot-light" style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '50%', display: 'inline-block', marginRight: '10px' }}></span>
                          <span className="tech-veh-id">🚘 {job.vehicleId || 'N/A'} ({job.registrationNo || 'No Reg'})</span>
                          <span className="tech-job-id">Card: {job.jobCardId}</span>
                        </div>
                        <div className="tech-bar-right" onClick={e => e.stopPropagation()}>
                          <button
                            className="tech-btn"
                            style={{ backgroundColor: '#f59e0b', color: 'white', padding: '8px 14px', borderRadius: '5px', fontWeight: 'bold' }}
                            onClick={() => setPendingModal({ open: true, job, showRejectInput: false, rejectReason: '' })}
                          >
                            ⚠️ Action Required
                          </button>
                          <span className="expand-icon" onClick={() => setExpandedJobId(isExpanded ? null : job.jobCardId)}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="tech-job-accordion-body">
                          <div className="accordion-grid">
                            <div>
                              <h4>📝 Advisor Instructions:</h4>
                              <p>{job.instructionComment || 'No special notes provided.'}</p>
                              <p><b>Stage:</b> {job.stageName}</p>
                            </div>
                            <div>
                              <h4>🔩 Spare Parts Required:</h4>
                              {job.spareParts && job.spareParts.length > 0 ? (
                                <ul className="parts-list">
                                  {job.spareParts.map((p, idx) => (
                                    <li key={idx}>{p.itemName} - Qty: {p.quantityUsed}</li>
                                  ))}
                                </ul>
                              ) : <p>No spare parts assigned.</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="tech-card">
            <h3>⚙️ My Workspace (Active Jobs)</h3>
            <div className="tech-job-list">
              {activeJobs && activeJobs.length > 0 ? (
                activeJobs.map(job => {
                  const statusUpper = job.status?.toUpperCase() || '';
                  const isAccepted = statusUpper === 'ACCEPTED';
                  const isOngoing = ['IN_PROGRESS', 'ONGOING', 'RUNNING'].includes(statusUpper);
                  const isPaused = statusUpper === 'PAUSED';
                  const isCompleted = ['COMPLETED', 'DONE'].includes(statusUpper);
                  const isExpanded = expandedJobId === job.jobCardId;

                  return (
                    <div key={job.jobCardId} className="tech-job-bar">
                      <div className="tech-job-bar-header" onClick={() => setExpandedJobId(isExpanded ? null : job.jobCardId)}>
                        <div className="tech-bar-left">
                          <span className="tech-veh-id">🚘 {job.vehicleId || 'N/A'} ({job.registrationNo || 'No Reg'})</span>
                          <span className="tech-job-id">Card: {job.jobCardId}</span>
                        </div>

                        <div className="tech-bar-right" onClick={e => e.stopPropagation()}>
                          {isOngoing && (
                            <span className="live-timer-badge" style={{ backgroundColor: '#1e293b', color: '#22c55e', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', marginRight: '10px' }}>
                              ⏱️ {formatTimer(job.startTime, job.accumulatedMinutes || 0)}
                            </span>
                          )}

                          {isAccepted && (
                            <button className="tech-btn" style={{ backgroundColor: '#16a34a', color: 'white', padding: '8px 14px', borderRadius: '5px', fontWeight: 'bold' }} onClick={() => setStartModal({ open: true, jobId: job.jobCardId })}>
                              🟢 Ready to Start
                            </button>
                          )}

                          {(isOngoing || isPaused) && (
                            <button
                              className="clickable-status-btn"
                              style={{
                                backgroundColor: isPaused ? '#d97706' : '#2563eb',
                                color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                              }}
                              onClick={() => {
                                setShowPauseInput(false);
                                setActionModal({ open: true, job });
                              }}
                            >
                              ⚙️ {job.status} (Update)
                            </button>
                          )}

                          {isCompleted && <span className="status-badge status-done">COMPLETED</span>}

                          <span className="expand-icon" onClick={() => setExpandedJobId(isExpanded ? null : job.jobCardId)}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="tech-job-accordion-body">
                          <div className="accordion-grid">
                            <div>
                              <h4>📝 Advisor Instructions:</h4>
                              <p>{job.instructionComment || 'No special notes provided.'}</p>
                              <p><b>Stage:</b> {job.stageName}</p>
                            </div>
                            <div>
                              <h4>🔩 Spare Parts Required:</h4>
                              {job.spareParts && job.spareParts.length > 0 ? (
                                <ul className="parts-list">
                                  {job.spareParts.map((p, idx) => (
                                    <li key={idx}>{p.itemName} - Qty: {p.quantityUsed}</li>
                                  ))}
                                </ul>
                              ) : <p>No spare parts assigned.</p>}
                            </div>
                          </div>

                          <div className="tech-note-box">
                            <label>Technician Notes:</label>
                            <textarea
                              rows="2"
                              placeholder="Add your work findings..."
                              value={techNotes[job.jobCardId] || ''}
                              onChange={e => setTechNotes({ ...techNotes, [job.jobCardId]: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p style={{ padding: '15px' }}>No active jobs in your workspace.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hours' && (
        <div className="tech-card">
          <h3>Daily Working Hours Overview</h3>
          <div className="hours-summary-box" style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #16a34a' }}>
            <h4 style={{ margin: 0, fontSize: '18px' }}>Total Daily Calculated Hours: <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{calculateTotalHours()} Hours</span></h4>
          </div>
          <table className="tech-table">
            <thead>
              <tr>
                <th>Vehicle & Job Card</th>
                <th>Start Time</th>
                <th>End / Status Time</th>
                <th>Duration (Mins)</th>
                <th>Duration (Hours)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {timeLogs && timeLogs.map((log, idx) => (
                <tr key={idx}>
                  <td><b>{log.registrationNo || 'Vehicle'}</b> ({log.jobCardId})</td>
                  <td>{log.startTime ? new Date(log.startTime).toLocaleString('en-LK') : 'N/A'}</td>
                  <td>{log.endTime ? new Date(log.endTime).toLocaleString('en-LK') : 'Ongoing...'}</td>
                  <td><b>{log.durationMinutes || 0} mins</b></td>
                  <td><b>{((log.durationMinutes || 0) / 60).toFixed(2)} hrs</b></td>
                  <td><span className={`status-badge status-${log.status?.toLowerCase()}`}>{log.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="tech-card">
          <h3>Work History</h3>
          <table className="tech-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Vehicle</th>
                <th>Stage</th>
                <th>Decision</th>
                <th>Current Job Status</th>
                <th>Rejection Reason</th>
                <th>Decision Time</th>
              </tr>
            </thead>
            <tbody>
              {jobHistory.map(job => (
                <tr key={job.jobCardId}>
                  <td>{job.jobCardId}</td>
                  <td>{job.registrationNo || 'N/A'}</td>
                  <td>{job.stageName || 'N/A'}</td>
                  <td><span className={`status-badge status-${job.decision?.toLowerCase()}`}>{job.decision}</span></td>
                  <td>{job.jobStatus}{!job.stillAssigned && ' (reassigned)'}</td>
                  <td>{job.decision === 'REJECTED' ? (job.rejectReason || 'Not recorded') : '—'}</td>
                  <td>{job.decisionAt ? new Date(job.decisionAt).toLocaleString('en-LK') : 'Earlier record'}</td>
                </tr>
              ))}
              {jobHistory.length === 0 && <tr><td colSpan="7">No accepted or rejected jobs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'salary' && (
        <div className="tech-grid-2">
          <div className="tech-card">
            <h3>Request Salary Advance</h3>
            <form onSubmit={handleAdvanceSubmit}>
              <div className="tech-form-group">
                <label>Requested Amount (Rs.): *</label>
                <input type="number" className="tech-input" value={advanceForm.amount} onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })} required />
              </div>
              <div className="tech-form-group">
                <label>Reason for Request: *</label>
                <textarea className="tech-textarea" rows="3" value={advanceForm.reason} onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })} required />
              </div>
              <button type="submit" className="tech-btn btn-primary">Submit Advance Request</button>
            </form>
          </div>

          <div className="tech-card">
            <h3>Monthly Salary & Status Summary</h3>
            <div className="salary-info-cards">
              <div className="sal-card"><span>Base Salary:</span> <b>Rs.{salaryData.summary?.baseSalary || 0}</b></div>
              <div className="sal-card"><span>Advances Taken:</span> <b className="text-red">Rs.{salaryData.summary?.totalAdvance || 0}</b></div>
              <div className="sal-card"><span>Remaining Payable:</span> <b className="text-green">Rs.{salaryData.summary?.remainingSalary || 0}</b></div>
            </div>

            <h4 style={{ marginTop: '20px' }}>Advance Request Status</h4>
            <table className="tech-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Decision Reason</th>
                </tr>
              </thead>
              <tbody>
                {salaryData.requests?.map(req => (
                  <tr key={req.advanceId}>
                    <td>{new Date(req.requestedDate).toLocaleDateString('en-LK')}</td>
                    <td>Rs.{req.amount}</td>
                    <td>{req.reason}</td>
                    <td><span className={`status-badge status-${req.status?.toLowerCase()}`}>{req.status}</span></td>
                    <td>{req.rejectionReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

{pendingModal.open && (
        <div className="tech-modal-overlay">
          <div className="tech-modal text-center" style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '22px', marginBottom: '15px' }}>⚠️ Job Assignment</h3>
            <JobAssignmentDetails job={pendingModal.job} />

            {!pendingModal.showRejectInput ? (
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                <button className="tech-btn" style={{ backgroundColor: '#16a34a', color: '#fff', padding: '10px 20px', borderRadius: '6px' }} onClick={() => handleAcceptJob()}>✅ Accept Job</button>
                <button className="tech-btn" style={{ backgroundColor: '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: '6px' }} onClick={() => setPendingModal({...pendingModal, showRejectInput: true})}>❌ Reject Job</button>
              </div>
            ) : (
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontWeight: 'bold' }}>Reason for Rejection: *</label>
                <textarea
                  className="tech-textarea"
                  rows="3"
                  style={{ width: '100%', marginTop: '8px', padding: '10px' }}
                  value={pendingModal.rejectReason}
                  onChange={e => setPendingModal({...pendingModal, rejectReason: e.target.value})}
                  placeholder="State why you cannot take this job..."
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button className="tech-btn" style={{ backgroundColor: '#dc2626', color: '#fff', padding: '10px', flex: 1, borderRadius: '6px' }} onClick={handleRejectSubmit}>Confirm Reject</button>
                  <button className="tech-btn" style={{ backgroundColor: '#64748b', color: '#fff', padding: '10px', borderRadius: '6px' }} onClick={() => setPendingModal({...pendingModal, showRejectInput: false})}>Back</button>
                </div>
              </div>
            )}

            {!pendingModal.showRejectInput && (
              <button className="tech-btn" style={{ marginTop: '20px', backgroundColor: '#e2e8f0', padding: '8px 20px', borderRadius: '6px', width: '100%' }} onClick={() => setPendingModal({ open: false, job: null })}>Close</button>
            )}
          </div>
        </div>
      )}

      {startModal.open && (
        <div className="tech-modal-overlay">
          <div className="tech-modal text-center" style={{ background: '#fff', padding: '30px', borderRadius: '12px', maxWidth: '450px' }}>
            <h2 style={{ fontSize: '22px', color: '#16a34a', marginBottom: '10px' }}>🚀 Start Job Repair Timer</h2>
            <p style={{ color: '#475569', margin: '10px 0 20px 0' }}>
              Job Card ID: <b>{startModal.jobId}</b><br />
              Click the button below to start time calculation.
            </p>
            <button className="tech-btn btn-start-large" style={{ backgroundColor: '#16a34a', color: '#fff', padding: '15px 30px', fontSize: '16px', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', width: '100%' }} onClick={() => handleStartWork(startModal.jobId)}>
              🟢 START WORK NOW
            </button>
            <button className="tech-btn" style={{ marginTop: '15px', backgroundColor: '#e2e8f0', padding: '10px', width: '100%', borderRadius: '6px' }} onClick={() => setStartModal({ open: false, jobId: null })}>Cancel</button>
          </div>
        </div>
      )}

      {actionModal.open && (
        <div className="tech-modal-overlay">
          <div className="tech-modal text-center" style={{ background: '#fff', padding: '30px', borderRadius: '12px', maxWidth: '450px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>⚙️ Job Progress Control</h3>
            <div className="status-info-box" style={{ padding: '10px', background: '#f1f5f9', borderRadius: '6px', marginBottom: '15px' }}>
              Job Card: <b>{actionModal.job?.jobCardId}</b> | Current Status: <b style={{ color: actionModal.job?.status === 'PAUSED' ? '#d97706' : '#2563eb' }}>{actionModal.job?.status}</b>
            </div>

            {showPauseInput ? (
              <div className="pause-reason-box">
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', textAlign: 'left' }}>Reason for Pausing Work: *</label>
                <textarea
                  className="tech-textarea"
                  rows="3"
                  style={{ width: '100%', padding: '10px' }}
                  placeholder="e.g. Waiting for spare parts, Lunch break..."
                  value={pauseReason}
                  onChange={e => setPauseReason(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button className="tech-btn" style={{ flex: 1, backgroundColor: '#dc2626', color: '#fff', padding: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }} onClick={() => handleWorkToggle('PAUSE')}>Confirm Pause</button>
                  <button className="tech-btn" style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '5px' }} onClick={() => setShowPauseInput(false)}>Back</button>
                </div>
              </div>
            ) : (
              <div className="action-button-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {['IN_PROGRESS', 'ONGOING', 'RUNNING'].includes(actionModal.job?.status?.toUpperCase()) && (
                  <button
                    className="tech-btn"
                    style={{ padding: '12px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    onClick={() => setShowPauseInput(true)}
                  >
                    ⏸️ Pause Work
                  </button>
                )}

                {actionModal.job?.status?.toUpperCase() === 'PAUSED' && (
                  <button
                    className="tech-btn"
                    style={{ padding: '12px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    onClick={() => handleWorkToggle('RESUME')}
                  >
                    ▶️ Resume Work
                  </button>
                )}

                {['IN_PROGRESS', 'ONGOING', 'RUNNING', 'PAUSED'].includes(actionModal.job?.status?.toUpperCase()) && (
                  <button
                    className="tech-btn"
                    style={{ padding: '12px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    onClick={handleCompleteWork}
                  >
                    ✅ Complete Job
                  </button>
                )}
              </div>
            )}

            {!showPauseInput && (
              <button
                className="tech-btn"
                style={{ marginTop: '15px', padding: '8px 16px', borderRadius: '5px', border: 'none', backgroundColor: '#64748b', color: '#fff', cursor: 'pointer', width: '100%' }}
                onClick={() => { setActionModal({ open: false, job: null }); setShowPauseInput(false); }}
              >
                Close Window
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
