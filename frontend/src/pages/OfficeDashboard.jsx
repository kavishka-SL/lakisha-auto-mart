import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/OfficeDashboard.css';

const API_BASE = 'http://localhost:5000/api/om';

function slotStartTime(slot) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(slot || '');
  if (!match) return null;
  const hour = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const chargeTypes = [
  { value: 'LABOR', label: 'Repair labor' },
  { value: 'WORKSHOP', label: 'Workshop fee' },
  { value: 'CUSTOM_MODIFICATION', label: 'Custom modification' },
  { value: 'OTHER', label: 'Other charge' }
];

export default function OfficeDashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('register-cust');

  const [custForm, setCustForm] = useState({ name: '', nic: '', email: '', phone: '', registrationNo: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustHistory, setSelectedCustHistory] = useState([]);
  const [selectedHistoryCustomerId, setSelectedHistoryCustomerId] = useState(null);

  const [invoiceData, setInvoiceData] = useState({ jobCardId: '', taxPercentage: 0 });
  const [invoiceWork, setInvoiceWork] = useState({ pending: [], completed: [] });
  const [invoiceSummary, setInvoiceSummary] = useState(null);
  const [additionalCharges, setAdditionalCharges] = useState([]);
  const [chargesDirty, setChargesDirty] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceNotice, setInvoiceNotice] = useState('');
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [paymentData, setPaymentData] = useState({ paymentMethod: 'CASH' });

  const [partForm, setPartForm] = useState({ itemName: '', unitPrice: '', quantityInStock: '', reorderLevel: 10 });
  const [spareParts, setSpareParts] = useState([]);
  const lowStockParts = spareParts.filter(part => Number(part.isActive) === 1 && Number(part.quantityInStock) <= Number(part.reorderLevel));
  const [editingPartId, setEditingPartId] = useState(null);
  const [partError, setPartError] = useState('');
  const [partNotice, setPartNotice] = useState('');

  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [showAllAppointments, setShowAllAppointments] = useState(true);
  const [appForm, setAppForm] = useState({ id: null, customerId: '', time: '09:00', notes: '', status: 'PENDING' });
  const [isEditing, setIsEditing] = useState(false);

  const [vehPassIdInput, setVehPassIdInput] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState(false);
  const [passDetails, setPassDetails] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common.Authorization;
    sessionStorage.clear();
    if (setUser) setUser(null);
    window.location.href = '/';
  };

  const handleRegisterCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/register-customer`, custForm);
      alert(`${res.data.message}\nVehicle ID (customer login): ${res.data.vehiclePassId}`);
      setCustForm({ name: '', nic: '', email: '', phone: '', registrationNo: '' });
    } catch (err) { alert(err.response?.data?.error || 'Failed to register customer.'); }
  };

  const refreshInvoiceLists = useCallback(async () => {
    try {
      const [workResponse, historyResponse] = await Promise.all([
        axios.get(`${API_BASE}/invoice-work`),
        axios.get(`${API_BASE}/payment-history`)
      ]);
      setInvoiceWork({ pending: workResponse.data.pending || [], completed: workResponse.data.completed || [] });
      setPaymentHistory(historyResponse.data.payments || []);
      setInvoiceError('');
    } catch (error) {
      setInvoiceError(error.response?.data?.error || 'Could not load invoices and payments.');
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'invoice') return undefined;
    refreshInvoiceLists();
    const interval = setInterval(refreshInvoiceLists, 15000);
    return () => clearInterval(interval);
  }, [activeTab, refreshInvoiceLists]);

  const loadInvoiceSummary = async (jobCardId) => {
    setInvoiceData(current => ({ ...current, jobCardId }));
    setInvoiceSummary(null);
    setAdditionalCharges([]);
    setChargesDirty(false);
    setInvoiceError('');
    setInvoiceNotice('');
    if (!jobCardId) return;
    try {
      const response = await axios.get(`${API_BASE}/invoice-summary/${jobCardId}`);
      setInvoiceSummary(response.data);
      setAdditionalCharges(response.data.charges || []);
    } catch (error) {
      setInvoiceError(error.response?.data?.error || 'Could not load this invoice.');
    }
  };

  const updateCharge = (index, field, value) => {
    setAdditionalCharges(current => current.map((charge, position) =>
      position === index ? { ...charge, [field]: value } : charge
    ));
    setChargesDirty(true);
  };

  const saveCharges = async () => {
    if (!invoiceData.jobCardId) return;
    setInvoiceBusy(true);
    setInvoiceError('');
    try {
      await axios.put(`${API_BASE}/invoice-charges/${invoiceData.jobCardId}`, { charges: additionalCharges });
      const response = await axios.get(`${API_BASE}/invoice-summary/${invoiceData.jobCardId}`);
      setInvoiceSummary(response.data);
      setAdditionalCharges(response.data.charges || []);
      setChargesDirty(false);
      setInvoiceNotice('Additional charges saved. The invoice total is updated.');
    } catch (error) {
      setInvoiceError(error.response?.data?.error || 'Could not save additional charges.');
    } finally {
      setInvoiceBusy(false);
    }
  };

  const partsSubtotal = Number(invoiceSummary?.totals?.partsSubtotal || 0);
  const additionalTotal = additionalCharges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const invoiceSubtotal = Math.round((partsSubtotal + additionalTotal) * 100) / 100;
  const taxRate = Number(invoiceData.taxPercentage) || 0;
  const taxAmount = Math.round(invoiceSubtotal * taxRate) / 100;
  const grandTotal = Math.round((invoiceSubtotal + taxAmount) * 100) / 100;

  const executePayment = async () => {
    if (!invoiceData.jobCardId || !invoiceSummary || chargesDirty || invoiceBusy) return;
    if (paymentData.paymentMethod === 'CARD' &&
        !window.confirm('Record this as an already completed card payment? This screen does not charge a bank card.')) return;
    setInvoiceBusy(true);
    setInvoiceError('');
    try {
      const response = await axios.post(`${API_BASE}/process-payment`, {
        jobCardId: invoiceData.jobCardId,
        taxPercentage: invoiceData.taxPercentage,
        paymentMethod: paymentData.paymentMethod,
        officeUserId: user?.userId
      });
      setInvoiceNotice(response.data.message);
      setInvoiceData({ jobCardId: '', taxPercentage: 0 });
      setInvoiceSummary(null);
      setAdditionalCharges([]);
      setChargesDirty(false);
      await refreshInvoiceLists();
    } catch (error) {
      setInvoiceError(error.response?.data?.error || 'Payment could not be recorded.');
    } finally {
      setInvoiceBusy(false);
    }
  };

  const downloadInvoice = async (jobCardId, taxPercentage = 0) => {
    if (!jobCardId || (chargesDirty && jobCardId === invoiceData.jobCardId)) return;
    setInvoiceError('');
    try {
      const response = await axios.get(`${API_BASE}/download-carbone-invoice/${jobCardId}`, {
        params: { tax: taxPercentage }, responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${jobCardId}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setInvoiceError('Could not download the invoice document.');
    }
  };

  const fetchCustomers = useCallback(async (query = '') => {
    try {
      const res = await axios.get(`${API_BASE}/search-customer`, { params: { query } });
      if (res.data.success) setSearchResults(res.data.customers);
    } catch (err) {
      console.error('Customer search failed:', err);
    }
  }, []);
  useEffect(() => {
    if (activeTab === 'search') fetchCustomers();
  }, [activeTab, fetchCustomers]);
  const handleSearch = (e) => { e.preventDefault(); setSelectedHistoryCustomerId(null); fetchCustomers(searchQuery); };
  const fetchHistory = async (customerId) => {
    setSelectedHistoryCustomerId(null);
    setSelectedCustHistory([]);
    try {
      const res = await axios.get(`${API_BASE}/customer-history/${customerId}`);
      if (res.data.success) {
        setSelectedCustHistory(res.data.history);
        setSelectedHistoryCustomerId(customerId);
      }
    } catch (err) {
      console.error('Customer history failed:', err);
      alert('Could not load customer history.');
    }
  };
  const fetchSpareParts = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/spare-parts`);
      setSpareParts(response.data.parts || []);
      setPartError('');
    } catch (error) {
      setSpareParts([]);
      setPartError(error.response?.data?.error || 'Could not load spare parts.');
    }
  }, []);
  useEffect(() => {
    fetchSpareParts();
    const interval = setInterval(fetchSpareParts, 30000);
    return () => clearInterval(interval);
  }, [fetchSpareParts]);
  const resetPartForm = () => {
    setEditingPartId(null);
    setPartForm({ itemName: '', unitPrice: '', quantityInStock: '', reorderLevel: 10 });
  };
  const handleSavePart = async (event) => {
    event.preventDefault();
    setPartError('');
    try {
      const response = editingPartId
        ? await axios.put(`${API_BASE}/spare-parts/${editingPartId}`, partForm)
        : await axios.post(`${API_BASE}/add-spare-part`, partForm);
      setPartNotice(response.data.message);
      resetPartForm();
      await fetchSpareParts();
    } catch (error) { setPartError(error.response?.data?.error || 'Could not save spare part.'); }
  };
  const changePartStatus = async (part) => {
    if (part.isActive && !window.confirm(`Archive ${part.itemName}? Past job and invoice records will be kept.`)) return;
    try {
      const response = part.isActive
        ? await axios.delete(`${API_BASE}/spare-parts/${part.itemId}`)
        : await axios.patch(`${API_BASE}/spare-parts/${part.itemId}/restore`);
      setPartNotice(response.data.message);
      if (editingPartId === part.itemId) resetPartForm();
      await fetchSpareParts();
    } catch (error) { setPartError(error.response?.data?.error || 'Could not change spare part status.'); }
  };

  const fetchAppointments = useCallback(async () => { try {
    const res = await axios.get(`${API_BASE}/appointments`, { params: showAllAppointments ? {} : { date: selectedDate } });
    if (res.data.success) setAppointments(res.data.appointments || []);
  } catch (err) { console.error(err); } }, [selectedDate, showAllAppointments]);
  useEffect(() => {
    if (activeTab !== 'appointments') return undefined;
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 15000);
    return () => clearInterval(interval);
  }, [activeTab, fetchAppointments]);
  const resetAppForm = useCallback(() => { setAppForm({ id: null, customerId: '', time: '09:00', notes: '', status: 'PENDING' }); setIsEditing(false); }, []);
  const handleSaveAppointment = async (e) => { e.preventDefault(); const dateTime = `${selectedDate} ${appForm.time}:00`; try { if (isEditing) {
    const unchangedSlot = selectedDate === appForm.originalDay && appForm.time === appForm.originalTime;
    await axios.put(`${API_BASE}/appointments/${appForm.id}`, { ...appForm, appointmentDate: dateTime, timeSlot: unchangedSlot ? appForm.originalTimeSlot : null });
    alert('Updated!');
  } else { await axios.post(`${API_BASE}/appointments`, { ...appForm, appointmentDate: dateTime }); alert('Scheduled!'); } resetAppForm(); fetchAppointments(); } catch (err) { alert('Error'); } };
  const handleDeleteAppointment = async (id) => { if (window.confirm('Delete?')) { try { await axios.delete(`${API_BASE}/appointments/${id}`); fetchAppointments(); } catch (err) { alert('Error'); } } };
  const handleAppointmentStatus = async (id, status) => {
    try {
      await axios.patch(`${API_BASE}/appointments/${id}/status`, { status });
      await fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not update appointment status.');
      fetchAppointments();
    }
  };
  const handleEditClick = (item) => { const time = slotStartTime(item.timeSlot) || item.appointmentTime || '09:00'; setIsEditing(true); setSelectedDate(item.appointmentDay || selectedDate); setAppForm({ id: item.appointmentId, customerId: item.customerId, time, notes: item.notes || '', status: item.status || 'PENDING', originalDay: item.appointmentDay, originalTime: time, originalTimeSlot: item.timeSlot }); };
  const handleViewVehiclePass = async () => {
    setPassMsg('');
    setPassDetails(null);
    try {
      const res = await axios.get(`${API_BASE}/vehicle-pass`, { params: { vehicleId: vehPassIdInput.trim() } });
      setPassDetails(res.data.pass);
    } catch (err) {
      setPassError(true);
      setPassMsg(err.response?.data?.error || 'Could not find the vehicle pass.');
    }
  };

  const handleIssueVehiclePass = async (e) => {
    e.preventDefault();
    setPassMsg('');
    try {
      const lookup = await axios.get(`${API_BASE}/vehicle-pass`, { params: { vehicleId: vehPassIdInput.trim() } });
      const existingPass = lookup.data.pass;
      if (existingPass.vehiclePassId && !window.confirm('This vehicle already has a Vehicle ID. Replace it? The old ID will stop working.')) return;
      const res = await axios.post(`${API_BASE}/issue-vehicle-id`, {
        vehicleId: vehPassIdInput.trim(),
        replaceExisting: Boolean(existingPass.vehiclePassId)
      });
      setPassDetails({ ...existingPass, vehiclePassId: res.data.vehiclePassId });
      setPassError(false);
      setPassMsg(`Vehicle ID issued: ${res.data.vehiclePassId}${res.data.whatsappSent ? ' · WhatsApp sent.' : ' · WhatsApp not sent.'}`);
    } catch (err) {
      setPassError(true);
      setPassMsg(err.response?.data?.error || 'Could not issue the vehicle pass.');
    }
  };

  return (
    <div className="om-dashboard-container">
      <div className="om-header">
        <h2>Office Management Dashboard</h2>
        <div className="om-user-info">
          <span>User: <b>{user?.name || 'Staff'}</b></span>
          <button className="om-logout-btn" onClick={handleLogout}>LOGOUT</button>
        </div>
      </div>

      {lowStockParts.length > 0 && (
        <div className="om-stock-alert om-no-print" role="alert">
          <div>
            <strong>Restock alert: {lowStockParts.length} spare {lowStockParts.length === 1 ? 'part is' : 'parts are'} at or below the reorder level.</strong>
            <p>{lowStockParts.map(part => `${part.itemName} (${part.quantityInStock} in stock; reorder at ${part.reorderLevel})`).join(' · ')}</p>
          </div>
          <button className="om-stock-alert-button" type="button" onClick={() => setActiveTab('inventory')}>View Spare Parts</button>
        </div>
      )}

      <div className="om-nav-tabs om-no-print">
        <button className={`om-tab-btn ${activeTab === 'register-cust' ? 'active' : ''}`} onClick={() => setActiveTab('register-cust')}>Customer Registration</button>
        <button className={`om-tab-btn ${activeTab === 'invoice' ? 'active' : ''}`} onClick={() => setActiveTab('invoice')}>Invoices & Payments</button>
        <button className={`om-tab-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>Search & History</button>
        <button className={`om-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>Spare Parts</button>
        <button className={`om-tab-btn ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => setActiveTab('appointments')}>Appointments</button>
        <button className={`om-tab-btn ${activeTab === 'vehicle-pass' ? 'active' : ''}`} onClick={() => setActiveTab('vehicle-pass')}>Vehicle ID</button>
      </div>

      {activeTab === 'register-cust' && (
        <div className="om-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3>Register New Customer</h3>
          <form onSubmit={handleRegisterCustomer}>
            <div className="om-form-group">
              <label>Vehicle Number Plate *</label>
              <input className="om-input" type="text" placeholder="e.g. CAB-1234" value={custForm.registrationNo} onChange={e => setCustForm({...custForm, registrationNo: e.target.value})} required />
            </div>
            <div className="om-form-group"><label>Full Name *</label><input className="om-input" type="text" value={custForm.name} onChange={e => setCustForm({...custForm, name: e.target.value})} required /></div>
            <div className="om-form-group"><label>NIC Number *</label><input className="om-input" type="text" value={custForm.nic} onChange={e => setCustForm({...custForm, nic: e.target.value})} required /></div>
            <div className="om-form-group"><label>Email Address</label><input className="om-input" type="email" value={custForm.email} onChange={e => setCustForm({...custForm, email: e.target.value})} /></div>
            <div className="om-form-group"><label>Phone Number *</label><input className="om-input" type="text" value={custForm.phone} onChange={e => setCustForm({...custForm, phone: e.target.value})} required /></div>
            <button className="om-btn" type="submit">Register Customer</button>
          </form>
        </div>
      )}

      {activeTab === 'invoice' && (
        <div className="om-invoice-sections">
          <div className="om-card">
            <h3>Pending Payments</h3>
            <p className="om-muted">Select a vehicle after all repair and modification work has passed the release check. The visit is billed together.</p>
            {invoiceError && <p className="om-invoice-error" role="alert">{invoiceError}</p>}
            {invoiceNotice && <p className="om-invoice-notice" role="status">{invoiceNotice}</p>}
            <div className="om-form-group">
              <label htmlFor="pending-invoice-visit">Vehicle ready for payment</label>
              <select id="pending-invoice-visit" className="om-input" value={invoiceData.jobCardId}
                onChange={event => loadInvoiceSummary(event.target.value)}>
                <option value="">-- Select a vehicle and customer --</option>
                {invoiceWork.pending.map(visit => (
                  <option key={visit.jobCardId} value={visit.jobCardId}>
                    {visit.registrationNo} — {visit.customerName || 'Unknown customer'} — {visit.jobCount} {visit.jobCount === 1 ? 'job' : 'jobs'}
                  </option>
                ))}
              </select>
            </div>
            {invoiceWork.pending.length === 0 && <p className="om-muted">No completed jobs are awaiting payment.</p>}

            {invoiceSummary && (
              <>
                <h4>Invoice for {invoiceSummary.job.registrationNo} — {invoiceSummary.job.customerName || 'Customer'}</h4>
                <p className="om-muted">Service visit: {invoiceSummary.job.requestId || invoiceSummary.job.jobCardId}</p>
                {invoiceSummary.previouslyPaid > 0 && (
                  <p className="om-invoice-notice" role="status">
                    Rs. {formatMoney(invoiceSummary.previouslyPaid)} was already paid for earlier work in this visit.
                    This invoice covers only the remaining unpaid work.
                  </p>
                )}
                <h4>Work included in this invoice</h4>
                <ul>{invoiceSummary.jobs.map(job => <li key={job.jobCardId}>{job.stageName || 'Service'} — {job.jobCardId}</li>)}</ul>
                <h4>Spare parts</h4>
                <div className="om-table-scroll">
                  <table className="om-table">
                    <thead><tr><th>Job</th><th>Part</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead>
                    <tbody>
                      {invoiceSummary.parts.map((part, index) => (
                        <tr key={`${part.itemName}-${index}`}>
                          <td>{part.stageName || 'Service'}</td><td>{part.itemName}</td><td>{part.quantityUsed}</td>
                          <td>Rs. {formatMoney(part.pricePerUnit)}</td>
                          <td>Rs. {formatMoney(Number(part.quantityUsed) * Number(part.pricePerUnit))}</td>
                        </tr>
                      ))}
                      {invoiceSummary.parts.length === 0 && <tr><td colSpan="5">No spare parts charged for this visit.</td></tr>}
                    </tbody>
                  </table>
                </div>

                <h4>Additional service charges</h4>
                <p className="om-muted">Add labor, workshop, custom modification, or other charges before taking payment.</p>
                {additionalCharges.map((charge, index) => (
                  <div className="om-charge-row" key={charge.chargeId || `new-${index}`}>
                    <select className="om-input" aria-label={`Charge type ${index + 1}`} value={charge.chargeType}
                      onChange={event => updateCharge(index, 'chargeType', event.target.value)}>
                      {chargeTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                    <input className="om-input" aria-label={`Charge description ${index + 1}`} placeholder="Work or modification details"
                      value={charge.description} onChange={event => updateCharge(index, 'description', event.target.value)} />
                    <input className="om-input" aria-label={`Charge amount ${index + 1}`} type="number" min="0.01" step="0.01"
                      placeholder="Amount (Rs.)" value={charge.amount} onChange={event => updateCharge(index, 'amount', event.target.value)} />
                    <button className="om-btn om-btn-warning" type="button" onClick={() => {
                      setAdditionalCharges(current => current.filter((_, position) => position !== index));
                      setChargesDirty(true);
                    }}>Remove</button>
                  </div>
                ))}
                <div className="om-invoice-actions">
                  <button className="om-btn" type="button" onClick={() => {
                    setAdditionalCharges(current => [...current, { chargeType: 'LABOR', description: '', amount: '' }]);
                    setChargesDirty(true);
                  }}>Add Charge</button>
                  <button className="om-btn om-btn-success" type="button" disabled={!chargesDirty || invoiceBusy} onClick={saveCharges}>Save Charges</button>
                </div>
                {chargesDirty && <p className="om-invoice-error">Save the changed charges before recording payment or downloading the invoice.</p>}

                <div className="om-invoice-total">
                  <div><span>Spare parts</span><strong>Rs. {formatMoney(partsSubtotal)}</strong></div>
                  <div><span>Additional charges</span><strong>Rs. {formatMoney(additionalTotal)}</strong></div>
                  <div><span>Subtotal</span><strong>Rs. {formatMoney(invoiceSubtotal)}</strong></div>
                  <div className="om-invoice-tax"><label htmlFor="invoice-tax">Tax (%)</label>
                    <input id="invoice-tax" className="om-input" type="number" min="0" max="100" step="0.01"
                      value={invoiceData.taxPercentage} onChange={event => setInvoiceData(current => ({ ...current, taxPercentage: event.target.value }))} />
                    <strong>Rs. {formatMoney(taxAmount)}</strong>
                  </div>
                  <div className="om-grand-total"><span>Grand total to pay</span><strong>Rs. {formatMoney(grandTotal)}</strong></div>
                </div>

                <div className="om-invoice-actions">
                  <select className="om-input om-payment-method" aria-label="Payment method" value={paymentData.paymentMethod}
                    onChange={event => setPaymentData({ paymentMethod: event.target.value })}>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card payment already received</option>
                  </select>
                  <button className="om-btn om-btn-success" type="button" disabled={chargesDirty || invoiceBusy || grandTotal <= 0}
                    onClick={executePayment}>Record Payment</button>
                  <button className="om-btn" type="button" disabled={chargesDirty || invoiceBusy}
                    onClick={() => downloadInvoice(invoiceData.jobCardId, invoiceData.taxPercentage)}>Download Invoice</button>
                </div>
              </>
            )}
          </div>

          <div className="om-card">
            <h3>Completed & Paid Work</h3>
            <div className="om-table-scroll">
              <table className="om-table">
                <thead><tr><th>Vehicle</th><th>Customer</th><th>Job card</th><th>Invoice</th><th>Paid total</th><th></th></tr></thead>
                <tbody>
                  {invoiceWork.completed.map(job => (
                    <tr key={job.jobCardId}>
                      <td>{job.registrationNo}</td><td>{job.customerName || 'Unknown'}</td>
                      <td>{job.jobCardId}</td><td>{job.invoiceId}</td><td>Rs. {formatMoney(job.grandTotal)}</td>
                      <td><button className="om-btn" type="button" onClick={() => downloadInvoice(job.jobCardId)}>Download Invoice</button></td>
                    </tr>
                  ))}
                  {invoiceWork.completed.length === 0 && <tr><td colSpan="6">No paid jobs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="om-card">
            <h3>Payment History</h3>
            <div className="om-table-scroll">
              <table className="om-table">
                <thead><tr><th>Date</th><th>Vehicle</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Amount</th></tr></thead>
                <tbody>
                  {paymentHistory.map(payment => (
                    <tr key={payment.paymentId}>
                      <td>{new Date(payment.paymentDate).toLocaleString('en-LK')}</td>
                      <td>{payment.registrationNo || '—'}</td><td>{payment.customerName || '—'}</td>
                      <td>{payment.invoiceId}</td><td>{payment.paymentMethod}</td>
                      <td>Rs. {formatMoney(payment.amount)}</td>
                    </tr>
                  ))}
                  {paymentHistory.length === 0 && <tr><td colSpan="6">No payments recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'search' && (
        <div className="om-card">
          <h3>Search Customer & View History</h3>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input className="om-input" type="text" placeholder="Search by Name, NIC, Phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button className="om-btn" type="submit">Search</button>
          </form>
          {searchResults.length > 0 && (
            <table className="om-table">
              <thead><tr><th>Name</th><th>NIC</th><th>Phone</th><th>Vehicle Reg</th><th>Action</th></tr></thead>
              <tbody>
                {searchResults.map(c => (
                  <tr key={`${c.userId}-${c.vehicleId || 'none'}`}><td>{c.name}</td><td>{c.nic}</td><td>{c.phone}</td><td>{c.registrationNo || 'N/A'}</td><td><button className="om-btn om-btn-success" onClick={() => fetchHistory(c.userId)}>View History</button></td></tr>
                ))}
              </tbody>
            </table>
          )}
          {selectedCustHistory.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              <h4>Service History Details</h4>
              <table className="om-table" style={{ marginTop: '10px' }}>
                <thead><tr><th>Request ID</th><th>Vehicle</th><th>Status</th><th>Invoice Total</th><th>Payment</th></tr></thead>
                <tbody>
                  {selectedCustHistory.map(h => (
                    <tr key={h.requestId}><td>{h.requestId}</td><td>{h.registrationNo}</td><td>{h.status}</td><td>Rs.{h.grandTotal || '0.00'}</td><td>{h.paymentStatus || 'Unpaid'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedHistoryCustomerId && selectedCustHistory.length === 0 && (
            <p>No service history found for this customer.</p>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="om-inventory-layout">
          <div className="om-card">
            <h3>{editingPartId ? 'Edit Spare Part' : 'Add Spare Part'}</h3>
            {partError && <p className="om-invoice-error" role="alert">{partError}</p>}
            {partNotice && <p className="om-invoice-notice" role="status">{partNotice}</p>}
            <form onSubmit={handleSavePart}>
              <div className="om-form-group"><label>Item Name *</label><input className="om-input" type="text" maxLength="100" value={partForm.itemName} onChange={e => setPartForm({...partForm, itemName: e.target.value})} required /></div>
              <div className="om-form-group"><label>Unit Price (Rs.) *</label><input className="om-input" type="number" min="0" step="0.01" value={partForm.unitPrice} onChange={e => setPartForm({...partForm, unitPrice: e.target.value})} required /></div>
              <div className="om-form-group"><label>Stock Quantity *</label><input className="om-input" type="number" min="0" step="1" value={partForm.quantityInStock} onChange={e => setPartForm({...partForm, quantityInStock: e.target.value})} required /></div>
              <div className="om-form-group"><label>Reorder Level *</label><input className="om-input" type="number" min="0" step="1" value={partForm.reorderLevel} onChange={e => setPartForm({...partForm, reorderLevel: e.target.value})} required /></div>
              <div className="om-invoice-actions">
                <button className="om-btn" type="submit">{editingPartId ? 'Save Changes' : 'Add Spare Part'}</button>
                {editingPartId && <button className="om-btn om-btn-warning" type="button" onClick={resetPartForm}>Cancel Edit</button>}
              </div>
            </form>
          </div>
          <div className="om-card">
            <h3>Spare Parts</h3>
            <div className="om-table-scroll">
              <table className="om-table">
                <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Reorder At</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {spareParts.map(part => <tr key={part.itemId} className={Number(part.isActive) === 1 && Number(part.quantityInStock) <= Number(part.reorderLevel) ? 'om-low-stock-row' : ''}>
                    <td>{part.itemName}</td><td>Rs. {formatMoney(part.unitPrice)}</td><td>{part.quantityInStock}{Number(part.isActive) === 1 && Number(part.quantityInStock) <= Number(part.reorderLevel) && <span className="om-low-stock-label">Low stock</span>}</td><td>{part.reorderLevel}</td>
                    <td>{part.isActive ? 'Active' : 'Archived'}</td>
                    <td className="om-inventory-actions">
                      {part.isActive && <button className="om-btn" type="button" onClick={() => {
                        setEditingPartId(part.itemId);
                        setPartForm({ itemName: part.itemName, unitPrice: part.unitPrice, quantityInStock: part.quantityInStock, reorderLevel: part.reorderLevel });
                        setPartNotice('');
                      }}>Edit</button>}
                      <button className="om-btn om-btn-warning" type="button" onClick={() => changePartStatus(part)}>{part.isActive ? 'Archive' : 'Restore'}</button>
                    </td>
                  </tr>)}
                  {spareParts.length === 0 && <tr><td colSpan="6">No spare parts registered.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="appointment-section">
          <div className="appointment-grid">
            <div className="om-card app-form-card">
              <h3>{isEditing ? '✏️ Edit Appointment' : '➕ Schedule Appointment'}</h3>
              <form onSubmit={handleSaveAppointment}>
                <div className="om-form-group"><label>Select Date:</label><input className="om-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} required /></div>
                <div className="om-form-group"><label>Customer ID:</label><input className="om-input" type="text" value={appForm.customerId} onChange={(e) => setAppForm({ ...appForm, customerId: e.target.value })} required /></div>
                <div className="om-form-group"><label>Time Slot:</label><input className="om-input" type="time" value={appForm.time} onChange={(e) => setAppForm({ ...appForm, time: e.target.value })} required /></div>
                <div className="om-form-group"><label>Notes:</label><textarea className="om-textarea" rows="3" value={appForm.notes} onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })} /></div>
                <button className="om-btn btn-primary" type="submit">{isEditing ? 'Update Appointment' : 'Schedule Date'}</button>
                {isEditing && <button className="om-btn btn-secondary" type="button" onClick={resetAppForm} style={{marginLeft:'10px'}}>Cancel Edit</button>}
              </form>
            </div>
            <div className="om-card app-table-card">
              <h3>📋 {showAllAppointments ? 'All Appointments' : `Appointments for ${selectedDate}`}</h3>
              <div className="om-appointment-filters">
                <button type="button" className="om-btn" onClick={() => setShowAllAppointments(true)} disabled={showAllAppointments}>All appointments</button>
                <button type="button" className="om-btn" onClick={() => setShowAllAppointments(false)} disabled={!showAllAppointments}>Selected date</button>
              </div>
              {appointments.length === 0 ? (<p className="no-data-msg">No appointments scheduled.</p>) : (
                <table className="om-table">
                  <thead><tr><th>Date</th><th>Time / Slot</th><th>Customer</th><th>Vehicle</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {appointments.map((item) => (
                      <tr key={item.appointmentId}>
                        <td>{item.appointmentDay}</td>
                        <td>{item.timeSlot || item.appointmentTime}</td>
                        <td>{item.customerName || item.customerId}<br /><small>{item.customerId}</small></td>
                        <td>{item.registrationNo || '—'}</td>
                        <td>{item.notes || '—'}</td>
                        <td><span className={`om-appointment-status ${(item.status || 'PENDING').toLowerCase()}`}>{item.status || 'PENDING'}</span></td>
                        <td>
                          <div className="om-appointment-actions">
                            {(!item.status || item.status === 'PENDING') && <button className="btn-approve" onClick={() => handleAppointmentStatus(item.appointmentId, 'APPROVED')}>Approve</button>}
                            {item.status === 'APPROVED' && <button className="btn-complete" onClick={() => handleAppointmentStatus(item.appointmentId, 'COMPLETED')}>Mark Completed</button>}
                            <button className="btn-edit" onClick={() => handleEditClick(item)}>Edit</button>
                            <button className="btn-delete" onClick={() => handleDeleteAppointment(item.appointmentId)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vehicle-pass' && (
        <div className="om-card pass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3>🏷️ View or Issue Vehicle ID</h3>
          <form onSubmit={handleIssueVehiclePass}>
            <div className="om-form-group">
              <label>Vehicle Number Plate:</label>
              <input className="om-input" type="text" placeholder="e.g. CAB-1234" value={vehPassIdInput} onChange={(e) => { setVehPassIdInput(e.target.value); setPassDetails(null); setPassMsg(''); }} required />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="om-btn" type="button" onClick={handleViewVehiclePass} disabled={!vehPassIdInput.trim()}>View Vehicle ID</button>
              <button className="om-btn btn-info" type="submit">Issue / Replace Vehicle ID</button>
            </div>
          </form>
          {passMsg && <div className={passError ? 'om-pass-error' : 'alert-success'} style={{ marginTop: '15px' }}>{passMsg}</div>}
          {passDetails && (
            <div className="om-pass-details">
              <p><strong>Customer:</strong> {passDetails.customerName || 'Not assigned'}</p>
              <p><strong>Vehicle:</strong> {passDetails.registrationNo}</p>
              <p><strong>Vehicle ID:</strong> {passDetails.vehiclePassId || 'Not issued yet'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
