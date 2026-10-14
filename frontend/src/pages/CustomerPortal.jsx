import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/CustomerPortal.css';

const API_BASE = 'http://localhost:5000';

export default function CustomerPortal() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vehicleIdInput, setVehicleIdInput] = useState('');
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem('vehicleLoginId')));
  const [activeTab, setActiveTab] = useState('status');

  const [customer, setCustomer] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [history, setHistory] = useState([]);
  const [modifications, setModifications] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [customModNote, setCustomModNote] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [photoFile, setPhotoFile] = useState(null);

  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [theme, setTheme] = useState('dark-gold');
  const [fontSize, setFontSize] = useState('medium');

  const fetchInvoice = useCallback(async (jobId) => {
    try {
      const invRes = await axios.get(`${API_BASE}/api/customer/invoice/${jobId}`);
      if (invRes.data.success) setInvoice(invRes.data.invoice);
    } catch (err) {
      console.log('Invoice not yet generated.');
    }
  }, []);

  const fetchModifications = useCallback(async (cId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/customer/custom-modifications/${cId}`);
      if (res.data.success) setModifications(res.data.requests || []);
    } catch (err) {
      console.error('Could not load modification requests:', err);
    }
  }, []);

  const fetchAppointments = useCallback(async (cId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/customer/appointments/${cId}`);
      if (res.data.success) setAppointments(res.data.appointments || []);
    } catch (err) {
      console.error('Could not load appointments:', err);
    }
  }, []);

  const fetchDashboardData = useCallback(async (cId) => {
    try {
      const statusRes = await axios.get(`${API_BASE}/api/customer/status/${cId}`);
      if (statusRes.data.success) {
        setActiveJob(statusRes.data.activeJob);
        if (statusRes.data.activeJob && statusRes.data.activeJob.jobCardId) {
          await fetchInvoice(statusRes.data.activeJob.jobCardId);
        }
      }

      const historyRes = await axios.get(`${API_BASE}/api/customer/history/${cId}`);
      if (historyRes.data.success) {
        setHistory(historyRes.data.history);
      }

      const notifRes = await axios.get(`${API_BASE}/api/customer/notifications/${cId}`);
      if (notifRes.data.success) {
        setNotifications(notifRes.data.notifications);
      }
      await fetchModifications(cId);
      await fetchAppointments(cId);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  }, [fetchInvoice, fetchModifications, fetchAppointments]);

  const loadCustomer = useCallback(async (loginId) => {
    const res = await axios.post(`${API_BASE}/api/customer/login`, { vehiclePassId: loginId });
    const custData = res.data.data;
    setCustomer(custData);
    setEditPhone(custData.phone || '');
    setEditEmail(custData.email || '');
    setTheme(custData.themePreference || 'dark-gold');
    setFontSize(custData.fontSizePreference || 'medium');
    await fetchDashboardData(custData.customerId);
    sessionStorage.setItem('vehicleLoginId', loginId);
    setIsLoggedIn(true);
  }, [fetchDashboardData]);

  useEffect(() => {
    const savedId = sessionStorage.getItem('vehicleLoginId');
    if (!savedId) return;
    loadCustomer(savedId).catch(() => {
      sessionStorage.removeItem('vehicleLoginId');
    }).finally(() => setLoading(false));
  }, [loadCustomer]);

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'status' || !customer?.customerId) return undefined;
    const interval = setInterval(() => fetchDashboardData(customer.customerId), 15000);
    return () => clearInterval(interval);
  }, [isLoggedIn, activeTab, customer?.customerId, fetchDashboardData]);

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'appointment' || !customer?.customerId) return undefined;
    fetchAppointments(customer.customerId);
    const interval = setInterval(() => fetchAppointments(customer.customerId), 15000);
    return () => clearInterval(interval);
  }, [isLoggedIn, activeTab, customer?.customerId, fetchAppointments]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!vehicleIdInput.trim()) return alert('Please enter your Vehicle ID.');
    setLoading(true);
    try {
      await loadCustomer(vehicleIdInput.trim());
    } catch (err) {
      alert(err.response?.data?.message || 'Vehicle ID not found.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelection = async (dateVal) => {
    setAppointmentDate(dateVal);
    setSelectedSlot('');
    try {
      const res = await axios.get(`${API_BASE}/api/appointments/available-slots`, { params: { date: dateVal } });
      if (res.data.success) {
        setAvailableSlots(res.data.availableSlots);
      }
    } catch (err) {
      console.error("Error fetching slots", err);
    }
  };

  const handleBookAppointment = async () => {
    if (!appointmentDate || !selectedSlot) return alert("Please select date and time slot!");
    try {
      const res = await axios.post(`${API_BASE}/api/appointments/book`, {
        customerId: customer.customerId,
        vehicleId: customer.vehicleId,
        appointmentDate,
        timeSlot: selectedSlot,
        notes: appointmentNotes
      });
      if (res.data.success) {
        alert("Appointment booked successfully!");
        setAppointmentNotes('');
        setSelectedSlot('');
        fetchAppointments(customer.customerId);
        handleDateSelection(appointmentDate);
      }
    } catch (err) {
      alert("Failed to book appointment.");
    }
  };

  const handleCustomModSubmit = async () => {
    if (!customModNote.trim() || !activeJob) return alert("Enter modification request notes.");
    try {
      const res = await axios.post(`${API_BASE}/api/customer/custom-mod`, {
        jobCardId: activeJob.jobCardId,
        requestNote: customModNote
      });
      if (res.data.success) {
        alert("Custom modification request sent to Service Advisor!");
        setCustomModNote('');
        fetchModifications(customer.customerId);
      }
    } catch (err) {
      alert("Error sending modification request.");
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!activeJob) return alert("No active job card found for feedback.");

    const formData = new FormData();
    formData.append('customerId', customer.customerId);
    formData.append('jobCardId', activeJob.jobCardId);
    formData.append('rating', rating);
    formData.append('comment', feedbackComment);
    if (photoFile) formData.append('photo', photoFile);

    try {
      const res = await axios.post(`${API_BASE}/api/customer/feedback`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        alert("Thank you! Feedback submitted successfully.");
        setFeedbackComment('');
        setPhotoFile(null);
      }
    } catch (err) {
      alert("Error uploading feedback.");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(`${API_BASE}/api/customer/profile/${customer.customerId}`, {
        phone: editPhone,
        email: editEmail,
        themePreference: theme,
        fontSizePreference: fontSize
      });
      if (res.data.success) {
        alert("Profile and settings updated successfully!");
        setCustomer({ ...customer, phone: editPhone, email: editEmail, themePreference: theme, fontSizePreference: fontSize });
      }
    } catch (err) {
      alert("Failed to update profile.");
    }
  };

  if (loading) {
    return (
      <div className="tyre-loader-container">
        <div className="spinning-tyre">🛞</div>
        <h2>ACCESSING LAKSHA AUTO MART DATABASE...</h2>
        <p>Verifying Customer Credentials & Vehicle Telemetry</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="customer-login-wrapper">
        <button type="button" className="customer-back-button" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
        <div className="login-luxury-card">
          <div className="brand-badge">LAKSHA AUTO MART</div>
          <h1>CUSTOMER PORTAL</h1>
          <p>Enter the Vehicle ID given by Office Management to view your vehicle and repair updates.</p>

          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Vehicle ID (e.g. VID_A1B2C3D4E5F6)"
              value={vehicleIdInput}
              onChange={(e) => setVehicleIdInput(e.target.value)}
              required
            />
            <button type="submit" className="luxury-gold-btn">ACCESS DASHBOARD ➔</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`customer-portal-root ${theme} font-${fontSize}`}>

      <header className="portal-topbar">
        <div className="logo-area">
          <h2>LAKSHA AUTO MART</h2>
          <span>EXCLUSIVE CLIENT PORTAL</span>
        </div>

        <div className="client-info-badge">
          <span>👤 {customer.name}</span>
          <span className="car-tag">🚘 {customer.model || 'Vehicle'} [{customer.registrationNo || 'N/A'}]</span>
          <button className="logout-icon-btn" onClick={() => { sessionStorage.removeItem('vehicleLoginId'); setIsLoggedIn(false); setCustomer(null); }} title="Logout">🚪</button>
        </div>
      </header>

      {notifications.length > 0 && notifications.some(n => !n.isRead) && (
        <div className="notification-ticker">
          📢 <b>System Alert:</b> {notifications[0].message}
        </div>
      )}

      <nav className="portfolio-tabs">
        <button className={activeTab === 'status' ? 'active' : ''} onClick={() => setActiveTab('status')}>🚘 Live Status</button>
        <button className={activeTab === 'invoice' ? 'active' : ''} onClick={() => setActiveTab('invoice')}>🧾 Invoice & Billing</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>📜 Repair History</button>
        <button className={activeTab === 'appointment' ? 'active' : ''} onClick={() => setActiveTab('appointment')}>📅 Book Appointment</button>
        <button className={activeTab === 'feedback' ? 'active' : ''} onClick={() => setActiveTab('feedback')}>⭐ Feedback & Ratings</button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>⚙️ Profile & Settings</button>
      </nav>

      <main className="portfolio-content-area">

        {activeTab === 'status' && (
          <div className="status-grid-layout">
            {!activeJob ? (
              <div className="luxury-glass-box full-width">
                <h3>🚗 Vehicle Registered & Ready</h3>
                <p>No active repair job card currently assigned. Your vehicle is monitored and ready for service booking.</p>
              </div>
            ) : (
              <>
                <div className="luxury-glass-box full-width highlight-border">
                  <div className="flex-between">
                    <h3>LIVE REPAIR TELEMETRY</h3>
                    <span className={`status-pill ${activeJob.status?.toLowerCase()}`}>
                      {activeJob.status === 'PAUSED' ? `PAUSED: ${activeJob.pauseReason || 'Pending parts'}` : activeJob.status}
                    </span>
                  </div>
                  <div className="telemetry-grid">
                    <div>Job Card ID: <b>{activeJob.jobCardId}</b></div>
                    <div>Service Advisor: <b>{activeJob.advisorName || 'Assigned'}</b></div>
                    <div>Lead Technician: <b>{activeJob.technicianName || 'Pending'}</b></div>
                    <div>Current Stage: <span className="gold-text">{activeJob.stageName || 'Stage 1'}</span></div>
                  </div>
                </div>

                <div className="luxury-glass-box">
                  <h3>📋 Advisor Inspection Report</h3>
                  <p className="report-text">{activeJob.instructionComment || 'Standard maintenance & diagnostic check in progress.'}</p>
                </div>

                <div className="luxury-glass-box">
                  <h3>🔩 Replaced & Repaired Spare Parts</h3>
                  {activeJob.replacedParts && activeJob.replacedParts.length > 0 ? (
                    <ul className="parts-ul">
                      {activeJob.replacedParts.map((pt, idx) => (
                        <li key={idx}>
                          <span>{pt.itemName} (Qty: {pt.quantityUsed})</span>
                          <b>Rs. {(pt.total || (pt.quantityUsed * pt.pricePerUnit)).toLocaleString('en-LK')}</b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No spare parts allocated to job yet.</p>
                  )}
                </div>

                <div className="luxury-glass-box full-width">
                  <h3>🛠️ Request Custom Modification</h3>
                  <p className="sub-desc">Need additional modifications or specialized work while repair is ongoing?</p>
                  <textarea
                    rows="2"
                    placeholder="Enter custom modification instructions for the Service Advisor..."
                    value={customModNote}
                    onChange={(e) => setCustomModNote(e.target.value)}
                  />
                  <button className="luxury-gold-btn mt-10" onClick={handleCustomModSubmit}>SUBMIT MODIFICATION REQUEST</button>
                </div>
              </>
            )}

            <div className="luxury-glass-box full-width">
              <h3>Custom Modification Status</h3>
              {modifications.length === 0 ? (
                <p className="text-muted">No custom modification requests yet.</p>
              ) : (
                <div className="mod-status-list">
                  {modifications.map(mod => (
                    <div className="mod-status-item" key={mod.modRequestId}>
                      <div className="flex-between">
                        <strong>{mod.registrationNo || 'Vehicle'} · {mod.modRequestId}</strong>
                        <span className={`status-pill ${mod.status?.toLowerCase()}`}>{mod.status}</span>
                      </div>
                      <p>{mod.requestNote}</p>
                      <small>Requested {mod.createdDate ? new Date(mod.createdDate).toLocaleString('en-LK') : 'earlier'}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invoice' && (
          <div className="invoice-display-wrapper">
            {!invoice ? (
              <div className="luxury-glass-box text-center">
                <h3>⏳ REPAIR IN PROGRESS</h3>
                <p>The formal repair invoice breakdown (Parts, Labor, Workshop Fees & Tax) will be generated by Office Management upon repair completion.</p>
              </div>
            ) : (
              <div className="invoice-invoice-card">
                <h2>LAKSHA AUTO MART - FINAL REPAIR INVOICE</h2>
                <p className="inv-sub">No. 123, Luxury Auto Lane, Colombo | Hotline: +94 11 234 5678</p>
                <hr />
                <div className="inv-meta-grid">
                  <div>Invoice ID: <b>{invoice.invoiceId}</b></div>
                  <div>Issue Date: <b>{new Date(invoice.issueDate).toLocaleDateString('en-LK')}</b></div>
                  <div>Payment Status: <span className={`pay-badge ${invoice.paymentStatus?.toLowerCase()}`}>{invoice.paymentStatus}</span></div>
                </div>

                <table className="luxury-table mt-20">
                  <thead>
                    <tr>
                      <th>Billing Category</th>
                      <th className="text-right">Amount (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Spare Parts Net Amount</td><td className="text-right">Rs. {Number(invoice.netAmount || 0).toLocaleString('en-LK')}</td></tr>
                    <tr><td>Technician Labor Charges</td><td className="text-right">Rs. {Number(invoice.laborCharge || 0).toLocaleString('en-LK')}</td></tr>
                    <tr><td>Workshop Utility Fees</td><td className="text-right">Rs. {Number(invoice.workshopFee || 0).toLocaleString('en-LK')}</td></tr>
                    <tr><td>Custom Modification & Other Charges</td><td className="text-right">Rs. {Number(invoice.otherCharges || 0).toLocaleString('en-LK')}</td></tr>
                    <tr><td>Government Taxes (VAT)</td><td className="text-right">Rs. {Number(invoice.taxAmount || 0).toLocaleString('en-LK')}</td></tr>
                  </tbody>
                </table>

                <div className="invoice-grand-total">
                  <h3>GRAND TOTAL PAYABLE: <span>Rs. {Number(invoice.grandTotal || 0).toLocaleString('en-LK')}</span></h3>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="luxury-glass-box full-width">
            <h3>📜 Vehicle Maintenance & Repair History</h3>
            {history.length === 0 ? (
              <p className="text-muted mt-10">No past completed repair records found.</p>
            ) : (
              <table className="luxury-table mt-15">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Job Card ID</th>
                    <th>Stage & Details</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td>{new Date(h.createdDate).toLocaleDateString('en-LK')}</td>
                      <td><b>{h.jobCardId}</b></td>
                      <td>{h.stageName}</td>
                      <td>Rs. {Number(h.totalAmount || 0).toLocaleString('en-LK')}</td>
                      <td><span className="status-pill completed">{h.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'appointment' && (
          <div className="luxury-glass-box full-width">
            <h3>📅 Schedule Service Appointment & Check Free Slots</h3>
            <div className="appointment-form-grid mt-15">
              <div>
                <label>Vehicle Registration Number</label>
                <input type="text" value={customer.registrationNo || 'N/A'} readOnly className="readonly-box" />
              </div>
              <div>
                <label>Select Preferred Date</label>
                <input type="date" onChange={(e) => handleDateSelection(e.target.value)} />
              </div>
              <div className="full-col">
                <label>Available Time Slots</label>
                {availableSlots.length === 0 ? (
                  <p className="warning-text">Select a date above to check available workshop slots.</p>
                ) : (
                  <select value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}>
                    <option value="">-- Select Available Time Slot --</option>
                    {availableSlots.map((slot, idx) => (
                      <option key={idx} value={slot}>{slot}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="full-col">
                <label>Reason / Service Notes</label>
                <textarea
                  rows="2"
                  placeholder="Describe repair requirements or service note..."
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                />
              </div>
            </div>
            <button className="luxury-gold-btn mt-20" onClick={handleBookAppointment}>CONFIRM APPOINTMENT BOOKING</button>
            <h3 className="mt-20">Your Appointments</h3>
            {appointments.length === 0 ? (
              <p>No appointments booked yet.</p>
            ) : (
              <div className="customer-appointment-table-wrap">
                <table className="luxury-table">
                  <thead><tr><th>Date</th><th>Time / Slot</th><th>Vehicle</th><th>Notes</th><th>Status</th></tr></thead>
                  <tbody>
                    {appointments.map((appointment) => (
                      <tr key={appointment.appointmentId}>
                        <td>{appointment.appointmentDay}</td>
                        <td>{appointment.timeSlot || appointment.appointmentTime}</td>
                        <td>{appointment.registrationNo || '—'}</td>
                        <td>{appointment.notes || '—'}</td>
                        <td><span className={`status-pill ${(appointment.status || 'PENDING').toLowerCase()}`}>{appointment.status || 'PENDING'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="luxury-glass-box full-width">
            <h3>⭐ Service Feedback & Ratings</h3>
            <form onSubmit={handleFeedbackSubmit} className="feedback-form mt-15">
              <label>Service Rating (1 to 5 Stars):</label>
              <div className="star-picker">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span
                    key={s}
                    className={s <= rating ? 'star active' : 'star'}
                    onClick={() => setRating(s)}
                  >
                    ★
                  </span>
                ))}
              </div>

              <label className="mt-15">Written Review / Comment:</label>
              <textarea
                rows="3"
                placeholder="Share your experience regarding the service quality..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                required
              />

              <div className="file-upload-row mt-15">
                <div>
                  <label>📷 Upload Photo:</label>
                  <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
                </div>
              </div>

              <button type="submit" className="luxury-gold-btn mt-20">SUBMIT CLIENT FEEDBACK</button>
            </form>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="luxury-glass-box full-width">
            <h3>⚙️ Client Profile & Portal Customization</h3>
            <form onSubmit={handleUpdateProfile} className="settings-form mt-15">
              <div className="settings-grid">
                <div>
                  <label>Phone Number:</label>
                  <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div>
                  <label>Email Address:</label>
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div>
                  <label>Theme Preference:</label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="dark-gold">Luxury Dark & Gold</option>
                    <option value="cyber-blue">Cyberpunk Blue</option>
                    <option value="stealth-black">Matt Stealth Black</option>
                  </select>
                </div>
                <div>
                  <label>Font Size Preference:</label>
                  <select value={fontSize} onChange={(e) => setFontSize(e.target.value)}>
                    <option value="small">Compact</option>
                    <option value="medium">Standard</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="luxury-gold-btn mt-20">SAVE PROFILE PREFERENCES</button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}
