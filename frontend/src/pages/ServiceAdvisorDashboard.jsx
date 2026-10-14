import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/ServiceAdvisor.css';

const API_BASE = 'http://localhost:5000/api/sa';

export default function ServiceAdvisorDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('register');

  const [vehicles, setVehicles] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [jobProgress, setJobProgress] = useState([]);
  const [selectedProgressId, setSelectedProgressId] = useState(null);
  const [workflowJobId, setWorkflowJobId] = useState('');
  const [workflowNotice, setWorkflowNotice] = useState('');

  const [reassignModsData, setReassignModsData] = useState({ completedJobs: [], pendingMods: [] });
  const [selectedMod, setSelectedMod] = useState(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showModModal, setShowModModal] = useState(false);

  const [regVehicle, setRegVehicle] = useState({ customerId: '', vehicleId: '', make: '', model: '', year: '' });
  const [inspection, setInspection] = useState({ vehicleId: '', fuelLevel: '50%', mileage: '', damagedParts: '', repairRequirements: '', description: '' });
  const [assignTech, setAssignTech] = useState({ requestId: '', technicianId: '', stageName: 'Stage 1', instructionComment: '' });
  const [assignPart, setAssignPart] = useState({ jobCardId: '', itemId: '', quantityUsed: 1, pricePerUnit: 0 });
  const [qualityCheck, setQualityCheck] = useState({ requestId: '', qualityCheckStatus: 'PASS', qualityRemarks: '', releaseApproved: false });

  const showTab = useCallback(tab => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = () => {
    fetchVehicles();
    fetchRequests();
    fetchTechnicians();
    fetchSpareParts();
    fetchJobProgress();
    fetchReassignModsData();
  };

  const fetchVehicles = async () => { try { const res = await axios.get(`${API_BASE}/vehicles`); if (res.data.success) {
    const rows = res.data.vehicles || [];
    setVehicles(rows);
    setInspection(current => rows.some(v => v.vehicleId === current.vehicleId && v.isFullyClosed) ? { ...current, vehicleId: '' } : current);
  } } catch (e) { console.error(e); } };
  const fetchPendingRegistrations = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/pending-registrations`);
      if (res.data.success) setPendingRegistrations(res.data.registrations || []);
    } catch (err) { console.error('Could not load pending vehicle registrations:', err); }
  }, []);

  useEffect(() => {
    if (activeTab !== 'register') return undefined;
    fetchPendingRegistrations();
    const interval = setInterval(fetchPendingRegistrations, 15000);
    return () => clearInterval(interval);
  }, [activeTab, fetchPendingRegistrations]);
  const fetchRequests = async () => { try { const res = await axios.get(`${API_BASE}/requests`); if (res.data.success) {
    const rows = res.data.requests || [];
    setRequests(rows);
    setAssignTech(current => rows.some(r => r.requestId === current.requestId && r.isFullyClosed) ? { ...current, requestId: '' } : current);
    setQualityCheck(current => rows.some(r => r.requestId === current.requestId && r.isFullyClosed) ? { ...current, requestId: '' } : current);
  } } catch (e) { console.error(e); } };
  const fetchTechnicians = async () => { try { const res = await axios.get(`${API_BASE}/technicians`); if (res.data.success) setTechnicians(res.data.technicians || []); } catch (e) { console.error(e); } };
  const fetchSpareParts = async () => { try { const res = await axios.get(`${API_BASE}/spare-parts`); if (res.data.success) setSpareParts(res.data.items || []); } catch (e) { console.error(e); } };
  const fetchJobProgress = useCallback(async () => { try { const res = await axios.get(`${API_BASE}/job-progress`); if (res.data.success) {
    const rows = res.data.progress || [];
    setJobProgress(rows);
    setAssignPart(current => rows.some(j => j.jobCardId === current.jobCardId && j.isFullyClosed) ? { ...current, jobCardId: '' } : current);
  } } catch (e) { console.error(e); } }, []);

  useEffect(() => {
    if (!workflowNotice) return undefined;
    const timeout = setTimeout(() => setWorkflowNotice(''), 8000);
    return () => clearTimeout(timeout);
  }, [workflowNotice]);

  useEffect(() => {
    if (activeTab !== 'progress') return undefined;
    fetchJobProgress();
    const interval = setInterval(fetchJobProgress, 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchJobProgress]);

  const fetchReassignModsData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/reassign-mods-data`);
      if (res.data.success) setReassignModsData({ completedJobs: res.data.completedJobs, pendingMods: res.data.pendingMods });
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (activeTab !== 'reassign') return undefined;
    fetchReassignModsData();
    const interval = setInterval(fetchReassignModsData, 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchReassignModsData]);

  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    try {
      const vehicleId = regVehicle.vehicleId;
      await axios.put(`${API_BASE}/register-vehicle/${vehicleId}`, regVehicle);
      setRegVehicle({ customerId: '', vehicleId: '', make: '', model: '', year: '' });
      setInspection(current => ({ ...current, vehicleId }));
      await Promise.all([fetchPendingRegistrations(), fetchVehicles()]);
      setWorkflowNotice('Vehicle registered. Continue with its inspection.');
      showTab('inspection');
    } catch (err) { alert(err.response?.data?.error || 'Vehicle registration failed.'); }
  };

  const handleInspectionSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/inspection-report`, inspection);
      setInspection({ vehicleId: '', fuelLevel: '50%', mileage: '', damagedParts: '', repairRequirements: '', description: '' });
      setAssignTech(current => ({ ...current, requestId: res.data.requestId, technicianId: '', stageName: 'Stage 1', instructionComment: '' }));
      await Promise.all([fetchRequests(), fetchVehicles()]);
      setWorkflowNotice('Inspection saved. Assign a technician and any required parts.');
      showTab('assign');
    } catch (err) { alert(err.response?.data?.error || 'Failed to save inspection.'); }
  };

  const pendingCustomerVehicles = pendingRegistrations.filter(v => v.customerId === regVehicle.customerId);
  const selectedPendingVehicle = pendingRegistrations.find(v => v.vehicleId === regVehicle.vehicleId);

  const handleAssignTechSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/assign-technician`, { ...assignTech, advisorId: user?.userId || null });
      setAssignTech({ requestId: '', technicianId: '', stageName: 'Stage 1', instructionComment: '' });
      setAssignPart(current => ({ ...current, jobCardId: res.data.jobCardId, itemId: '', quantityUsed: 1, pricePerUnit: 0 }));
      setWorkflowJobId(res.data.jobCardId);
      setWorkflowNotice('Technician assigned. Add any required spare parts while work is in progress.');
      setShowReassignModal(false);
      fetchJobProgress();
      fetchRequests();
      fetchReassignModsData();
    } catch (err) { alert('Assign Failed!'); }
  };

  const handleAssignPartSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/assign-spare-parts`, assignPart);
      setAssignPart(current => ({ jobCardId: current.jobCardId, itemId: '', quantityUsed: 1, pricePerUnit: 0 }));
      setWorkflowNotice(res.data.message || 'Part allocated. You can add another part to this job.');
      fetchSpareParts();
    } catch (err) { alert('Part Allocation Failed!'); }
  };

  const handleFinishAssignment = () => {
    setWorkflowJobId('');
    setAssignPart({ jobCardId: '', itemId: '', quantityUsed: 1, pricePerUnit: 0 });
    setWorkflowNotice('Assignment finished. Ready to register the next vehicle.');
    showTab('register');
    fetchPendingRegistrations();
  };

  const handleQualitySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/quality-check`, qualityCheck);
      alert(res.data.message);
      setQualityCheck({ requestId: '', qualityCheckStatus: 'PASS', qualityRemarks: '', releaseApproved: false });
      fetchVehicles();
      fetchJobProgress();
      fetchRequests();
      fetchReassignModsData();
    } catch (err) { alert('Quality Check Failed!'); }
  };

  const handleModApproveSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/approve-mod-assign`, {
        ...assignTech,
        requestId: selectedMod?.requestId,
        modRequestId: selectedMod?.modRequestId,
        advisorId: user?.userId || null
      });
      alert(res.data.message);
      setShowModModal(false);
      setSelectedMod(null);
      setAssignTech({ requestId: '', technicianId: '', stageName: 'Custom Mod', instructionComment: '' });
      fetchJobProgress();
      fetchReassignModsData();
      fetchRequests();
    } catch (err) { alert('Mod Approval Failed!'); }
  };

  const handleRejectMod = async () => {
    if(window.confirm("Are you sure you want to REJECT this modification?")) {
        try {
            await axios.post(`${API_BASE}/approve-mod`, {
              requestId: selectedMod?.requestId,
              modRequestId: selectedMod?.modRequestId,
              modApprovalStatus: 'REJECTED'
            });
            alert("Modification Rejected!");
            setShowModModal(false);
            setSelectedMod(null);
            fetchReassignModsData();
            fetchRequests();
        } catch (err) { alert('Reject Failed!'); }
    }
  };

  const handleLogout = () => {
    if (onLogout) { onLogout(); }
    else { localStorage.clear(); sessionStorage.clear(); window.location.href = '/'; }
  };

  const openReassignModal = (reqId) => {
    setAssignTech({ ...assignTech, requestId: reqId });
    setShowReassignModal(true);
  };

  const openModModal = (mod) => {
    setSelectedMod(mod);
    setAssignTech({ requestId: mod.requestId || '', technicianId: '', stageName: 'Custom Mod', instructionComment: mod.repairRequirements || '' });
    setShowModModal(true);
  };

  return (
    <div className="sa-container">

      <div className="sa-header-container">
        <h2 className="sa-header" style={{ margin: 0 }}>Service Advisor Dashboard</h2>
        <button className="sa-btn sa-btn-danger" onClick={handleLogout}>Logout</button>
      </div>

      <div className="sa-nav">
        <button className={`sa-nav-btn ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}>1. Register Vehicle</button>
        <button className={`sa-nav-btn ${activeTab === 'inspection' ? 'active' : ''}`} onClick={() => { setActiveTab('inspection'); fetchVehicles(); }}>2. Inspection Report</button>
        <button className={`sa-nav-btn ${activeTab === 'assign' ? 'active' : ''}`} onClick={() => { setActiveTab('assign'); fetchRequests(); fetchJobProgress(); }}>3. Assign Tech & Parts</button>
        <button className={`sa-nav-btn ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>4. Progress Tracker</button>
        <button className={`sa-nav-btn ${activeTab === 'reassign' ? 'active' : ''}`} onClick={() => setActiveTab('reassign')}>5. Reassign & Mods</button>
        <button className={`sa-nav-btn ${activeTab === 'quality' ? 'active' : ''}`} onClick={() => { setActiveTab('quality'); fetchRequests(); }}>6. Quality Check</button>
        <button className={`sa-nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>7. Vehicles List</button>
      </div>
      {workflowNotice && <p className="sa-workflow-notice" role="status">{workflowNotice}</p>}

      {activeTab === 'register' && (
        <div className="sa-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 className="sa-card-title">Complete Vehicle Registration</h3>
          <form onSubmit={handleRegisterVehicle}>
            <div className="sa-form-group">
                <label>Customer *</label>
                <select className="sa-select" value={regVehicle.customerId} onChange={e => {
                  const customerId = e.target.value;
                  const matches = pendingRegistrations.filter(v => v.customerId === customerId);
                  setRegVehicle({ ...regVehicle, customerId, vehicleId: matches.length === 1 ? matches[0].vehicleId : '' });
                }} required>
                  <option value="">-- Select Customer --</option>
                  {pendingRegistrations.filter((vehicle, index, all) => all.findIndex(v => v.customerId === vehicle.customerId) === index).map(vehicle => (
                    <option key={vehicle.customerId} value={vehicle.customerId}>{vehicle.customerName} ({vehicle.customerId})</option>
                  ))}
                </select>
            </div>
            {pendingCustomerVehicles.length > 1 && (
              <div className="sa-form-group">
                <label>Vehicle *</label>
                <select className="sa-select" value={regVehicle.vehicleId} onChange={e => setRegVehicle({ ...regVehicle, vehicleId: e.target.value })} required>
                  <option value="">-- Select Vehicle --</option>
                  {pendingCustomerVehicles.map(vehicle => <option key={vehicle.vehicleId} value={vehicle.vehicleId}>{vehicle.registrationNo}</option>)}
                </select>
              </div>
            )}
            <div className="sa-form-group">
                <label>Vehicle Number Plate</label>
                <input className="sa-input" type="text" value={selectedPendingVehicle?.registrationNo || ''} readOnly placeholder="Select a customer first" />
            </div>
            <div className="sa-form-group">
                <label>Make *</label>
                <input className="sa-input" type="text" placeholder="e.g., Toyota" value={regVehicle.make} onChange={e => setRegVehicle({...regVehicle, make: e.target.value})} required />
            </div>
            <div className="sa-form-group">
                <label>Model *</label>
                <input className="sa-input" type="text" placeholder="e.g., Corolla" value={regVehicle.model} onChange={e => setRegVehicle({...regVehicle, model: e.target.value})} required />
            </div>
            <div className="sa-form-group">
                <label>Year</label>
                <input className="sa-input" type="number" placeholder="e.g., 2018" value={regVehicle.year} onChange={e => setRegVehicle({...regVehicle, year: e.target.value})} />
            </div>
            <button className="sa-btn sa-btn-primary" type="submit" disabled={!regVehicle.vehicleId}>Complete Registration</button>
          </form>
        </div>
      )}

      {activeTab === 'inspection' && (
        <div className="sa-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3 className="sa-card-title">Create Inspection Report</h3>
          <form onSubmit={handleInspectionSubmit}>
            <div className="sa-form-group">
                <label>Select Vehicle *</label>
                <select className="sa-select" value={inspection.vehicleId} onChange={e => setInspection({...inspection, vehicleId: e.target.value})} required>
                  <option value="">-- Select Registered Vehicle --</option>
                  {vehicles.filter(v => !v.isFullyClosed && v.status !== 'PENDING_ADVISOR').map(v => (
                    <option key={v.vehicleId} value={v.vehicleId}>{v.registrationNo} - {v.make} {v.model}</option>
                  ))}
                </select>
            </div>
            <div className="sa-form-group">
                <label>Fuel Level</label>
                <input className="sa-input" type="text" value={inspection.fuelLevel} onChange={e => setInspection({...inspection, fuelLevel: e.target.value})} />
            </div>
            <div className="sa-form-group">
                <label>Mileage (KM) *</label>
                <input className="sa-input" type="number" value={inspection.mileage} onChange={e => setInspection({...inspection, mileage: e.target.value})} required />
            </div>
            <div className="sa-form-group">
                <label>Damaged Parts</label>
                <textarea className="sa-textarea" value={inspection.damagedParts} onChange={e => setInspection({...inspection, damagedParts: e.target.value})} />
            </div>
            <div className="sa-form-group">
                <label>Repair Requirements</label>
                <textarea className="sa-textarea" value={inspection.repairRequirements} onChange={e => setInspection({...inspection, repairRequirements: e.target.value})} />
            </div>
            <div className="sa-form-group">
                <label>Description / Customer Notes</label>
                <textarea className="sa-textarea" value={inspection.description} onChange={e => setInspection({...inspection, description: e.target.value})} />
            </div>
            <div style={{ marginTop: '20px' }}>
                <button className="sa-btn sa-btn-primary" type="submit">Save Inspection Report</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'assign' && (
        <div className="sa-grid-2">
          <div className="sa-card">
            <h3 className="sa-card-title">Assign Technician</h3>
            <form onSubmit={handleAssignTechSubmit}>
              <div className="sa-form-group">
                  <label>Service Request *</label>
                  <select className="sa-select" value={assignTech.requestId} onChange={e => setAssignTech({...assignTech, requestId: e.target.value})} required>
                    <option value="">-- Select Request --</option>
                    {requests.filter(r => !r.isFullyClosed).map(r => (
                      <option key={r.requestId} value={r.requestId}>{r.registrationNo} ({r.requestId})</option>
                    ))}
                  </select>
              </div>
              <div className="sa-form-group">
                  <label>Stage Name</label>
                  <select className="sa-select" value={assignTech.stageName} onChange={e => setAssignTech({...assignTech, stageName: e.target.value})}>
                    <option value="Stage 1">Stage 1: Engine & Transmission</option>
                    <option value="Stage 2">Stage 2: Electrical & Wiring</option>
                    <option value="Stage 3">Stage 3: Body & Painting</option>
                  </select>
              </div>
              <div className="sa-form-group">
                  <label>Technician *</label>
                  <select className="sa-select" value={assignTech.technicianId} onChange={e => setAssignTech({...assignTech, technicianId: e.target.value})} required>
                    <option value="">-- Select Technician --</option>
                    {technicians.map(t => (
                      <option key={t.userId} value={t.userId}>{t.name}</option>
                    ))}
                  </select>
              </div>
              <div className="sa-form-group">
                  <label>Instructions</label>
                  <textarea className="sa-textarea" value={assignTech.instructionComment} onChange={e => setAssignTech({...assignTech, instructionComment: e.target.value})} />
              </div>
              <button className="sa-btn sa-btn-primary" type="submit">Assign Technician</button>
            </form>
          </div>

          <div className="sa-card">
            <h3 className="sa-card-title">Allocate Spare Parts</h3>
            <form onSubmit={handleAssignPartSubmit}>
              <div className="sa-form-group">
                  <label>Job Card *</label>
                  <select className="sa-select" value={assignPart.jobCardId} onChange={e => setAssignPart({...assignPart, jobCardId: e.target.value})} required>
                    <option value="">-- Select Job Card --</option>
                    {jobProgress.filter(j => !j.isFullyClosed).map(j => (
                      <option key={j.jobCardId} value={j.jobCardId}>{j.registrationNo} - {j.stageName} ({j.jobCardId})</option>
                    ))}
                  </select>
              </div>
              <div className="sa-form-group">
                  <label>Spare Part *</label>
                  <select
                    className="sa-select"
                    value={assignPart.itemId}
                    onChange={e => {
                      const part = spareParts.find(p => p.itemId === e.target.value);
                      setAssignPart({ ...assignPart, itemId: e.target.value, pricePerUnit: part ? part.unitPrice : 0 });
                    }}
                    required
                  >
                    <option value="">-- Select Part --</option>
                    {spareParts.map(p => (
                      <option key={p.itemId} value={p.itemId}>{p.itemName} (Stock: {p.quantityInStock} | Rs.{p.unitPrice})</option>
                    ))}
                  </select>
              </div>
              <div className="sa-form-group">
                  <label>Quantity *</label>
                  <input className="sa-input" type="number" min="1" value={assignPart.quantityUsed} onChange={e => setAssignPart({...assignPart, quantityUsed: parseInt(e.target.value) || 1})} required />
              </div>
              <button className="sa-btn sa-btn-success" type="submit">Allocate Part</button>
            </form>
            {workflowJobId && (
              <div className="sa-assignment-finish">
                <p>Add all required parts, or finish now if this job needs none.</p>
                <button className="sa-btn sa-btn-primary" type="button" onClick={handleFinishAssignment}>Finish Assignment &amp; Register Next Vehicle</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="sa-card">
          <h3 className="sa-card-title">Job Progress Tracker</h3>
          <table className="sa-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Vehicle</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Tech Name</th>
                <th>Decision</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobProgress.map(j => (
                <React.Fragment key={j.jobCardId}>
                  <tr>
                    <td>{j.jobCardId}</td>
                    <td><b>{j.registrationNo}</b></td>
                    <td>{j.stageName}</td>
                    <td><span className="sa-badge">{j.jobStatus}</span></td>
                    <td>{j.techName || 'N/A'}</td>
                    <td><span className={`sa-badge sa-decision-${j.technicianDecision?.toLowerCase()}`}>{j.technicianDecision}</span></td>
                    <td><button type="button" className="sa-btn sa-btn-primary" onClick={() => setSelectedProgressId(selectedProgressId === j.jobCardId ? null : j.jobCardId)}>{selectedProgressId === j.jobCardId ? 'Hide' : 'View'}</button></td>
                  </tr>
                  {selectedProgressId === j.jobCardId && (
                    <tr>
                      <td colSpan="7">
                        <div className="sa-progress-detail" aria-live="polite">
                          <h4>Job {j.jobCardId}</h4>
                          <p><b>Vehicle:</b> {j.registrationNo || 'N/A'} &nbsp; <b>Stage:</b> {j.stageName || 'N/A'}</p>
                          <p><b>Technician:</b> {j.techName || 'N/A'} &nbsp; <b>Job status:</b> {j.jobStatus}</p>
                          <p><b>Technician decision:</b> {j.technicianDecision}
                            {j.decisionAt && ` on ${new Date(j.decisionAt).toLocaleString('en-LK')}`}</p>
                          {j.technicianDecision === 'REJECTED' && <p><b>Rejection reason:</b> {j.rejectReason || 'No reason recorded for this older job.'}</p>}
                          <p><b>Advisor instructions:</b> {j.instructionComment || 'None'}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {jobProgress.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center' }}>No jobs found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reassign' && (
        <div className="sa-grid-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="sa-card">
            <h3 className="sa-card-title">🔄 Reassign Jobs (Next Stage)</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>Jobs completed by previous technicians, waiting for the next repair stage.</p>
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Completed Stage</th>
                  <th>Done By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reassignModsData.completedJobs.length > 0 ? reassignModsData.completedJobs.map(job => (
                  <tr key={job.jobCardId}>
                    <td><b>{job.registrationNo}</b></td>
                    <td>{job.stageName} <span className="sa-badge">Done</span></td>
                    <td>{job.techName}</td>
                    <td>
                      <button className="action-btn btn-reassign" onClick={() => openReassignModal(job.requestId)}>Reassign Next</button>
                    </td>
                  </tr>
                )) : <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b' }}>No completed jobs waiting for reassignment.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="sa-card">
            <h3 className="sa-card-title">🎨 Manage Custom Modification Requests</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>Pending modification requests from customers awaiting your approval.</p>
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Requirements</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reassignModsData.pendingMods.length > 0 ? reassignModsData.pendingMods.map(mod => (
                  <tr key={mod.modRequestId || mod.requestId}>
                    <td><b>{mod.registrationNo}</b></td>
                    <td>{mod.customerName || 'N/A'}</td>
                    <td>{mod.repairRequirements}</td>
                    <td>
                      <button className="action-btn btn-review" onClick={() => openModModal(mod)}>Review & Approve</button>
                    </td>
                  </tr>
                )) : <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b' }}>No pending custom modifications.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="sa-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 className="sa-card-title">Quality Check & Release Approval</h3>
          <form onSubmit={handleQualitySubmit}>
            <div className="sa-form-group">
                <label>Service Request *</label>
                <select className="sa-select" value={qualityCheck.requestId} onChange={e => setQualityCheck({...qualityCheck, requestId: e.target.value})} required>
                  <option value="">-- Select Request --</option>
                  {requests.filter(r => !r.isFullyClosed).map(r => (
                    <option key={r.requestId} value={r.requestId}>{r.registrationNo} ({r.status})</option>
                  ))}
                </select>
            </div>
            <div className="sa-form-group">
                <label>Quality Status</label>
                <select className="sa-select" value={qualityCheck.qualityCheckStatus} onChange={e => setQualityCheck({...qualityCheck, qualityCheckStatus: e.target.value})}>
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                </select>
            </div>
            <div className="sa-form-group">
                <label>Remarks</label>
                <textarea className="sa-textarea" value={qualityCheck.qualityRemarks} onChange={e => setQualityCheck({...qualityCheck, qualityRemarks: e.target.value})} />
            </div>
            <div className="sa-checkbox-group">
              <input type="checkbox" id="relCheck" checked={qualityCheck.releaseApproved} onChange={e => setQualityCheck({...qualityCheck, releaseApproved: e.target.checked})} />
              <label htmlFor="relCheck">Approve Vehicle Release</label>
            </div>
            <div style={{ marginTop: '20px' }}>
                <button className="sa-btn sa-btn-primary" type="submit">Submit Status</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="sa-card">
          <h3 className="sa-card-title">Registered Vehicles</h3>
          <table className="sa-table">
            <thead>
              <tr>
                <th>Reg No</th>
                <th>Make & Model</th>
                <th>Year</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.vehicleId}>
                  <td><b>{v.registrationNo}</b></td>
                  <td>{v.make} {v.model}</td>
                  <td>{v.year || 'N/A'}</td>
                  <td><span className="sa-badge">{v.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

{showReassignModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Reassign to Next Technician</h3>
              <button className="btn-close" onClick={() => setShowReassignModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAssignTechSubmit}>
              <div className="sa-form-group">
                  <label>Next Stage Name</label>
                  <select className="sa-select" value={assignTech.stageName} onChange={e => setAssignTech({...assignTech, stageName: e.target.value})}>
                    <option value="Stage 1">Stage 1: Engine & Transmission</option>
                    <option value="Stage 2">Stage 2: Electrical & Wiring</option>
                    <option value="Stage 3">Stage 3: Body & Painting</option>
                    <option value="Stage 4">Stage 4: Interior & Finishing</option>
                  </select>
              </div>
              <div className="sa-form-group">
                  <label>Select Next Technician *</label>
                  <select className="sa-select" value={assignTech.technicianId} onChange={e => setAssignTech({...assignTech, technicianId: e.target.value})} required>
                    <option value="">-- Select Technician --</option>
                    {technicians.map(t => <option key={t.userId} value={t.userId}>{t.name}</option>)}
                  </select>
              </div>
              <div className="sa-form-group">
                  <label>Specific Instructions</label>
                  <textarea className="sa-textarea" value={assignTech.instructionComment} onChange={e => setAssignTech({...assignTech, instructionComment: e.target.value})} placeholder="What needs to be done next?"></textarea>
              </div>
              <button className="sa-btn action-btn btn-reassign" style={{ width: '100%', padding: '12px' }} type="submit">Reassign Job</button>
            </form>
          </div>
        </div>
      )}

      {showModModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Review Custom Modification</h3>
              <button className="btn-close" onClick={() => setShowModModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleModApproveSubmit}>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '15px' }}>If you approve this request, please assign a technician to start the modification job.</p>
              <p><b>Customer request:</b> {selectedMod?.repairRequirements || 'No details provided.'}</p>

              <div className="sa-form-group">
                  <label>Assign Technician *</label>
                  <select className="sa-select" value={assignTech.technicianId} onChange={e => setAssignTech({...assignTech, technicianId: e.target.value})} required>
                    <option value="">-- Select Technician --</option>
                    {technicians.map(t => <option key={t.userId} value={t.userId}>{t.name}</option>)}
                  </select>
              </div>
              <div className="sa-form-group">
                  <label>Instructions / Design Notes</label>
                  <textarea className="sa-textarea" value={assignTech.instructionComment} onChange={e => setAssignTech({...assignTech, instructionComment: e.target.value})} placeholder="Provide modification details..."></textarea>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="sa-btn action-btn btn-review" style={{ flex: 1, padding: '10px' }} type="submit">Approve & Assign</button>
                <button className="sa-btn sa-btn-danger" style={{ flex: 1, padding: '10px' }} type="button" onClick={handleRejectMod}>Reject Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
