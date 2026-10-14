import React, { useState, useEffect } from 'react';

import axios from 'axios';

import '../styles/ManagerDashboard.css';

const formatLkr = value => Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ManagerDashboard = ({ user }) => {

    const [activeTab, setActiveTab] = useState('dashboard');

const [stats, setStats] = useState({ activeJobs: 0, pendingApprovals: 0 });

const [inventory, setInventory] = useState([]);

const [users, setUsers] = useState([]);

    const [showAddForm, setShowAddForm] = useState(false);

    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({

        userId: '', name: '', username: '', phone: '', role: 'TECHNICIAN', password: ''

    });

const [userIdToken, setUserIdToken] = useState('');
    const [userIdError, setUserIdError] = useState('');

const [salaryAdvances, setSalaryAdvances] = useState([]);
    const [rejectingAdvanceId, setRejectingAdvanceId] = useState(null);
    const [salaryRejectReason, setSalaryRejectReason] = useState('');
    const [salaryError, setSalaryError] = useState('');

const [transactions, setTransactions] = useState({ invoices: [], payments: [], sparePartsUsed: [] });
    const [financialDate, setFinancialDate] = useState('');
    const [financialError, setFinancialError] = useState('');

const [businessReports, setBusinessReports] = useState({ inventorySummary: {} });
const [reportDate, setReportDate] = useState('');
const [reportError, setReportError] = useState('');
const [reportBusy, setReportBusy] = useState('');

const openReport = async type => {
    const preview = window.open('', '_blank');
    if (!preview) { setReportError('Allow pop-ups to open the PDF report.'); return; }
    setReportBusy(type);
    setReportError('');
    try {
        const response = await axios.get(`http://localhost:5000/api/manager/reports/inventory/${type}.pdf`, {
            params: reportDate ? { date: reportDate } : {},
            responseType: 'blob'
        });
        const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        preview.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 600000);
    } catch (error) {
        preview.close();
        setReportError('Could not generate the report. Check that the backend is running and try again.');
    } finally { setReportBusy(''); }
};

const [suppliers, setSuppliers] = useState([]);

    const [showSupplierForm, setShowSupplierForm] = useState(false);

    const [isEditingSupplier, setIsEditingSupplier] = useState(false);

    const [supplierForm, setSupplierForm] = useState({

        supplierId: '', supplierName: '', contactPerson: '', phone: '', email: '', category: '', deliveryAddress: '', username: '', password: ''

    });
    const [supplierError, setSupplierError] = useState('');

const [auditLogs, setAuditLogs] = useState([]);
    const [logsError, setLogsError] = useState('');

const [passwordForm, setPasswordForm] = useState({

        selectedUserId: '', managerPassword: '', newPassword: '', confirmPassword: ''

    });
    const [securityError, setSecurityError] = useState('');

useEffect(() => {

        if (activeTab === 'dashboard') {

            axios.get('http://localhost:5000/api/manager/dashboard-stats').then(res => setStats(res.data)).catch(console.error);

        }

    }, [activeTab]);

useEffect(() => {

        if (activeTab === 'inventory') {

            axios.get('http://localhost:5000/api/manager/inventory').then(res => setInventory(res.data)).catch(console.error);

        }

    }, [activeTab]);

const fetchUsers = () => { axios.get('http://localhost:5000/api/manager/all-users').then(res => setUsers(res.data)).catch(console.error); };

    useEffect(() => { if (activeTab === 'users' || activeTab === 'security') fetchUsers(); }, [activeTab]);

    useEffect(() => {
        if (!showAddForm || isEditing) return undefined;
        let cancelled = false;
        setUserIdError('');
        axios.get('http://localhost:5000/api/manager/user-id-preview', { params: { role: formData.role } })
            .then(res => {
                if (cancelled) return;
                setFormData(current => current.role === formData.role ? { ...current, userId: res.data.userId } : current);
                setUserIdToken(res.data.token);
            })
            .catch(err => { if (!cancelled) setUserIdError(err.response?.data?.error || 'Could not generate a User ID.'); });
        return () => { cancelled = true; };
    }, [showAddForm, isEditing, formData.role]);

const fetchSalaryAdvances = () => { axios.get('http://localhost:5000/api/manager/salary-advances').then(res => setSalaryAdvances(res.data)).catch(console.error); };

    useEffect(() => { if (activeTab === 'salary') fetchSalaryAdvances(); }, [activeTab]);

useEffect(() => {

        if (activeTab === 'reports') {

            axios.get('http://localhost:5000/api/manager/daily-transactions',
                { params: financialDate ? { date: financialDate } : {} })
                .then(res => { setTransactions(res.data); setFinancialError(''); })
                .catch(err => setFinancialError(err.response?.data?.error || 'Could not load financial records.'));

        }

    }, [activeTab, financialDate]);

useEffect(() => {

        if (activeTab === 'analytics') {

            axios.get('http://localhost:5000/api/manager/business-reports').then(res => setBusinessReports(res.data)).catch(console.error);

        }

    }, [activeTab]);

const fetchSuppliers = () => { axios.get('http://localhost:5000/api/manager/suppliers').then(res => setSuppliers(res.data)).catch(console.error); };

    const fetchAuditLogs = () => axios.get('http://localhost:5000/api/manager/audit-logs')
        .then(res => { setAuditLogs(res.data); setLogsError(''); })
        .catch(err => setLogsError(err.response?.data?.error || 'Could not load audit logs.'));

    useEffect(() => { if (activeTab === 'suppliers') fetchSuppliers(); }, [activeTab]);

useEffect(() => {

        if (activeTab === 'logs') {

            fetchAuditLogs();

        }

    }, [activeTab]);

const handleSalaryAction = async (advanceId, status) => {

        try {

            if (status === 'REJECTED' && !salaryRejectReason.trim()) {
                setSalaryError('Enter a reason before rejecting the advance.');
                return;
            }
            await axios.put(`http://localhost:5000/api/manager/salary-advance/${advanceId}`,
                { status, rejectionReason: status === 'REJECTED' ? salaryRejectReason.trim() : null });

            alert(`Salary advance request ${status.toLowerCase()} successfully!`);
            setSalaryError('');
            setRejectingAdvanceId(null);
            setSalaryRejectReason('');

            fetchSalaryAdvances();

        } catch (err) { setSalaryError(err.response?.data?.error || 'Could not update this request.'); }

    };

const handleChange = (e) => {
        if (e.target.name === 'role') {
            setUserIdToken('');
            setFormData(current => ({ ...current, role: e.target.value, userId: '' }));
        } else setFormData(current => ({ ...current, [e.target.name]: e.target.value }));
    };

const handleAddUser = async (e) => {

        e.preventDefault();

        try {

            if (!formData.userId || !userIdToken) return setUserIdError('Wait for the User ID to be generated.');
            const response = await axios.post('http://localhost:5000/api/manager/employees', { ...formData, userIdToken });

            alert(`User added successfully. User ID: ${response.data.userId}`);

            setShowAddForm(false);

            setFormData({ userId: '', name: '', username: '', phone: '', role: 'TECHNICIAN', password: '' });

            fetchUsers();

        } catch (err) { setUserIdError(err.response?.data?.error || 'Could not create user.'); }

    };

const handleRowClick = (user) => { setFormData({ ...user, password: '' }); setIsEditing(true); setShowAddForm(false); };

const handleUpdate = async (e) => {

        e.preventDefault();

        try {

            await axios.put(`http://localhost:5000/api/manager/update-user/${formData.userId}`, formData);

            alert("User updated successfully!");

            setIsEditing(false);

            setFormData({ userId: '', name: '', username: '', phone: '', role: 'CUSTOMER', password: '' });

            fetchUsers();

        } catch (err) { console.error(err); }

    };

const handleDelete = async (userId) => {

        if (window.confirm("Are you sure you want to deactivate this user?")) {

            await axios.delete(`http://localhost:5000/api/manager/delete-user/${userId}`);

            fetchUsers();

        }

    };

const handleSupplierChange = (e) => setSupplierForm({ ...supplierForm, [e.target.name]: e.target.value });

const handleAddSupplier = async (e) => {

        e.preventDefault();
        setSupplierError('');

        try {

            if (isEditingSupplier) {

                await axios.put(`http://localhost:5000/api/manager/suppliers/${supplierForm.supplierId}`, supplierForm);

                alert("Supplier updated successfully!");

            } else {

                const response = await axios.post('http://localhost:5000/api/manager/suppliers', supplierForm);

                alert(`Supplier added. Login User ID: ${response.data.supplierUserId}`);

            }

            setShowSupplierForm(false);

            setIsEditingSupplier(false);

            setSupplierForm({ supplierId: '', supplierName: '', contactPerson: '', phone: '', email: '', category: '', deliveryAddress: '', username: '', password: '' });

            fetchSuppliers();

        } catch (err) { setSupplierError(err.response?.data?.error || 'Could not save supplier.'); }

    };

const handleEditSupplierClick = (sup) => { setSupplierForm({ ...sup, username: '', password: '' }); setIsEditingSupplier(true); setShowSupplierForm(true); setSupplierError(''); };

const handleDeleteSupplier = async (supplierId) => {

        if (window.confirm("Archive this supplier? Existing orders and quotations will remain saved.")) {

            await axios.delete(`http://localhost:5000/api/manager/suppliers/${supplierId}`);

            fetchSuppliers();

        }

    };

    const handleRestoreSupplier = async (supplierId) => {
        try {
            await axios.patch(`http://localhost:5000/api/manager/suppliers/${supplierId}/restore`);
            fetchSuppliers();
        } catch (err) { setSupplierError(err.response?.data?.error || 'Could not restore supplier.'); }
    };

const handlePasswordChange = (e) => setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });

const handlePasswordSubmit = async (e) => {

        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {

            setSecurityError('Passwords do not match.'); return;

        }
        setSecurityError('');

        try {

            await axios.put(`http://localhost:5000/api/manager/change-password/${passwordForm.selectedUserId}`, {

                managerUserId: user?.userId,
                managerPassword: passwordForm.managerPassword,
                newPassword: passwordForm.newPassword

            });

            alert("Password changed successfully!");

            setPasswordForm({ selectedUserId: '', managerPassword: '', newPassword: '', confirmPassword: '' });

        } catch (err) {

            setSecurityError(err.response?.data?.error || 'Could not change password.');

        }

    };

return (

        <div className="manager-dashboard-container">

<div className="manager-top-nav">

                <div className="nav-tabs">

                    <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>

                    <button className={activeTab === 'inventory' ? 'active' : ''} onClick={() => setActiveTab('inventory')}>Inventory</button>

                    <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Users</button>

                    <button className={activeTab === 'salary' ? 'active' : ''} onClick={() => setActiveTab('salary')}>Advances</button>

                    <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>Financials</button>

                    <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>Business Reports</button>

                    <button className={activeTab === 'suppliers' ? 'active' : ''} onClick={() => setActiveTab('suppliers')}>Suppliers</button>

                    <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Audit Logs</button>

                    <button className={activeTab === 'security' ? 'active' : ''} onClick={() => setActiveTab('security')}>Security</button>

                </div>

<div className="nav-logout">

                    <button

                        onClick={() => {

                            if(window.confirm("Are you sure you want to logout?")) {

                                localStorage.removeItem('user');
                                localStorage.removeItem('authToken');
                                delete axios.defaults.headers.common.Authorization;

                                window.location.href = '/login';

                            }

                        }}

                        className="btn-logout"

                    >

                        Logout

                    </button>

                </div>

            </div>

<div className="dashboard-content">

{activeTab === 'dashboard' && (

                    <div>

                        <h2>Manager Business Dashboard</h2>

                        <div className="stats-card-container">

                            <div className="stat-card">

                                <h4>Active Repair Jobs</h4>

                                <h1>{stats.activeJobs}</h1>

                            </div>

                            <div className="stat-card">

                                <h4>Pending Approvals</h4>

                                <h1>{stats.pendingApprovals}</h1>

                            </div>

                        </div>

                    </div>

                )}

{activeTab === 'inventory' && (

                    <div>

                        <div className="section-header">

                            <h2>Live Inventory & Spare Parts Monitoring</h2>

                            <div style={{ display: 'flex', gap: '10px' }}>

                                <button className="btn-add-new" onClick={() => setActiveTab('analytics')}>Inventory Reports</button>

                                <button className="btn-add-new" onClick={() => axios.get('http://localhost:5000/api/manager/inventory').then(res => setInventory(res.data))}>Refresh Stock</button>

                            </div>

                        </div>

                        <div className="inventory-table-container">

                            <table className="inventory-table">

                                <thead>

                                    <tr>

                                        <th>Item ID</th>

                                        <th>Item Name</th>

                                        <th>Unit Price (LKR)</th>

                                        <th>Quantity In Stock</th>
                                        <th>Reorder Level</th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {inventory.length > 0 ? inventory.map(item => (

                                        <tr key={item.itemId}>

                                            <td><b>{item.itemId}</b></td>

                                            <td>{item.itemName}</td>

                                            <td>Rs. {Number(item.unitPrice).toLocaleString('en-LK')}</td>

                                            <td>

                                                {item.quantityInStock}

                                            </td>
                                            <td>{item.reorderLevel}</td>

                                        </tr>

                                    )) : <tr><td colSpan="5" style={{textAlign: 'center', color: '#888'}}>No items found in inventory.</td></tr>}

                                </tbody>

                            </table>

                        </div>

                    </div>

                )}

{activeTab === 'users' && (

                    <div>

                        <div className="section-header">

                            <h2>User Management</h2>

                            <button className="btn-add-new" onClick={() => { setShowAddForm(!showAddForm); setIsEditing(false); setUserIdToken(''); setUserIdError(''); setFormData({ userId: '', name: '', username: '', phone: '', role: 'TECHNICIAN', password: '' }); }}>

                                {showAddForm ? 'Close Form' : '+ Add New User'}

                            </button>

                        </div>

{(showAddForm || isEditing) && (

                            <div className="user-form-card">

                                <h3>{isEditing ? `Edit User: ${formData.userId}` : 'Add New User System Account'}</h3>
                                {userIdError && <p role="alert" className="manager-form-error">{userIdError}</p>}

                                <form onSubmit={isEditing ? handleUpdate : handleAddUser} className="user-form-grid">

                                    <div className="form-group">

                                        <label>User ID</label>

                                        <input type="text" name="userId" value={formData.userId} placeholder="Generating from role…" readOnly aria-label="Generated User ID" />

                                    </div>

                                    <div className="form-group">

                                        <label>Full Name</label>

                                        <input type="text" name="name" value={formData.name} onChange={handleChange} required />

                                    </div>

                                    <div className="form-group">

                                        <label>Username / Email</label>

                                        <input type="text" name="username" value={formData.username} onChange={handleChange} required />

                                    </div>

                                    <div className="form-group">

                                        <label>Phone</label>

                                        <input type="text" name="phone" value={formData.phone} onChange={handleChange} />

                                    </div>

                                    <div className="form-group">

                                        <label>Role</label>

                                        <select name="role" value={formData.role} onChange={handleChange} disabled={isEditing}>

                                            <option value="TECHNICIAN">Technician</option>

                                            <option value="SERVICE_ADVISOR">Service Advisor</option>

                                            <option value="OFFICE_MANAGEMENT">Office Management</option>

                                            <option value="MANAGER">Manager</option>

                                            {isEditing && !['TECHNICIAN', 'SERVICE_ADVISOR', 'OFFICE_MANAGEMENT', 'MANAGER'].includes(formData.role) &&
                                                <option value={formData.role}>{formData.role}</option>}

                                        </select>

                                    </div>

                                    {!isEditing && (

                                        <div className="form-group">

                                            <label>Password</label>

                                            <input type="password" name="password" minLength="8" value={formData.password} onChange={handleChange} required />

                                        </div>

                                    )}

                                    <div className="form-actions">

                                        <button type="submit" className="btn-update" disabled={!isEditing && !userIdToken}>{isEditing ? 'Save Changes' : 'Create User'}</button>

                                        <button type="button" onClick={() => { setShowAddForm(false); setIsEditing(false); }} className="btn-cancel">Cancel</button>

                                    </div>

                                </form>

                            </div>

                        )}

<div className="user-table-container">

                            <table className="user-table">

                                <thead>

                                    <tr>

                                        <th>User ID</th>

                                        <th>Name</th>

                                        <th>Username</th>

                                        <th>Phone</th>

                                        <th>Role</th>

                                        <th>Actions</th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {users.length > 0 ? users.map(u => (

                                        <tr key={u.userId}>

                                            <td><b>{u.userId}</b></td>

                                            <td>{u.name}</td>

                                            <td>{u.username}</td>

                                            <td>{u.phone}</td>

                                            <td><span className={`role-badge ${u.role.toLowerCase()}`}>{u.role}</span></td>

                                            <td>

                                                <button onClick={() => handleRowClick(u)} className="btn-edit-user">Edit</button>

                                                <button onClick={() => handleDelete(u.userId)} className="btn-deactivate">Deactivate</button>

                                            </td>

                                        </tr>

                                    )) : <tr><td colSpan="6" style={{textAlign: 'center', color: '#888'}}>No users found.</td></tr>}

                                </tbody>

                            </table>

                        </div>

                    </div>

                )}

{activeTab === 'salary' && (

                    <div>

                        <h2>Technician Salary Advance Requests</h2>
                        {salaryError && <p role="alert" className="manager-form-error">{salaryError}</p>}

                        <div className="salary-table-container">

                            <table className="salary-table">

                                <thead>

                                    <tr>

                                        <th>Advance ID</th>

                                        <th>Technician Name</th>

                                        <th>Amount (LKR)</th>

                                        <th>Reason</th>

                                        <th>Requested Date</th>

                                        <th>Status</th>

                                        <th>Decision Reason</th>

                                        <th>Actions</th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {salaryAdvances.length > 0 ? salaryAdvances.map(adv => (

                                        <tr key={adv.advanceId}>

                                            <td><b>#{adv.advanceId}</b></td>

                                            <td>{adv.technicianName}</td>

                                            <td>Rs. {Number(adv.amount).toLocaleString('en-LK')}</td>

                                            <td>{adv.reason}</td>

                                            <td>{new Date(adv.requestedDate).toLocaleString('en-LK')}</td>

                                            <td><span className={`status-badge status-${adv.status.toLowerCase()}`}>{adv.status}</span></td>

                                            <td>{adv.rejectionReason || '—'}</td>

                                            <td>

                                                {adv.status === 'PENDING' ? (

                                                    <>

                                                        <button onClick={() => handleSalaryAction(adv.advanceId, 'APPROVED')} className="btn-approve">Approve</button>

                                                        {rejectingAdvanceId === adv.advanceId ? <div className="manager-reject-box">
                                                            <textarea aria-label="Salary advance rejection reason" maxLength="500" value={salaryRejectReason}
                                                                onChange={event => setSalaryRejectReason(event.target.value)} placeholder="Reason for rejection" />
                                                            <button onClick={() => handleSalaryAction(adv.advanceId, 'REJECTED')} className="btn-reject">Confirm Reject</button>
                                                            <button onClick={() => { setRejectingAdvanceId(null); setSalaryRejectReason(''); setSalaryError(''); }} className="btn-edit-user">Cancel</button>
                                                        </div> : <button onClick={() => { setRejectingAdvanceId(adv.advanceId); setSalaryRejectReason(''); setSalaryError(''); }} className="btn-reject">Reject</button>}

                                                    </>

                                                ) : <span style={{ color: '#888', fontStyle: 'italic' }}>Completed</span>}

                                            </td>

                                        </tr>

                                    )) : <tr><td colSpan="8" style={{textAlign: 'center', color: '#888'}}>No salary advance requests found.</td></tr>}

                                </tbody>

                            </table>

                        </div>

                    </div>

                )}

{activeTab === 'reports' && <div className="manager-records-panel">
                    <div className="section-header"><h2>Financial Records</h2>
                        <label>Filter by date <input type="date" value={financialDate} onChange={event => setFinancialDate(event.target.value)} /></label>
                        <button className="btn-edit-user" type="button" onClick={() => setFinancialDate('')}>All dates</button>
                    </div>
                    {financialError && <p role="alert" className="manager-form-error">{financialError}</p>}
                    <div className="manager-summary-strip">
                        <strong>Payments received: Rs. {formatLkr((transactions.payments || []).reduce((sum, payment) => sum + Number(payment.amount), 0))}</strong>
                        <span>{(transactions.payments || []).length} payment records</span>
                        <span>{transactions.invoices.length} invoices</span>
                    </div>
                    <h3>Payments Received</h3>
                    <div className="manager-table-scroll"><table className="salary-table"><thead><tr><th>Date</th><th>Invoice</th><th>Vehicle</th><th>Customer</th><th>Method</th><th>Amount</th></tr></thead>
                        <tbody>{(transactions.payments || []).map(payment => <tr key={payment.paymentId}>
                            <td>{new Date(payment.paymentDate).toLocaleString('en-LK')}</td><td>{payment.invoiceId}</td><td>{payment.registrationNo || '—'}</td>
                            <td>{payment.customerName || '—'}</td><td>{payment.paymentMethod}</td><td>Rs. {formatLkr(payment.amount)}</td>
                        </tr>)}{!(transactions.payments || []).length && <tr><td colSpan="6">No payments for this period.</td></tr>}</tbody></table></div>
                    <h3>Invoices</h3>
                    <div className="manager-table-scroll"><table className="salary-table"><thead><tr><th>Date</th><th>Invoice</th><th>Vehicle</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
                        <tbody>{transactions.invoices.map(invoice => <tr key={invoice.invoiceId}>
                            <td>{new Date(invoice.issueDate).toLocaleString('en-LK')}</td><td>{invoice.invoiceId}</td><td>{invoice.registrationNo || '—'}</td>
                            <td>{invoice.customerName || '—'}</td><td>{invoice.paymentStatus}</td><td>Rs. {formatLkr(invoice.grandTotal)}</td>
                        </tr>)}{!transactions.invoices.length && <tr><td colSpan="6">No invoices for this period.</td></tr>}</tbody></table></div>
                    <h3>Spare Parts Used</h3>
                    <div className="manager-table-scroll"><table className="salary-table"><thead><tr><th>Job</th><th>Part</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead>
                        <tbody>{transactions.sparePartsUsed.map(part => <tr key={`${part.jobCardId}-${part.itemName}`}>
                            <td>{part.jobCardId}</td><td>{part.itemName}</td><td>{part.quantityUsed}</td>
                            <td>Rs. {formatLkr(part.pricePerUnit)}</td><td>Rs. {formatLkr(part.totalCost)}</td>
                        </tr>)}{!transactions.sparePartsUsed.length && <tr><td colSpan="5">No spare parts used for this period.</td></tr>}</tbody></table></div>
                </div>}

{activeTab === 'analytics' && (

                    <div>

                        <div className="section-header">

                            <h2>Business Reports</h2>

                        </div>

<div className="report-grid">

<div className="report-card">

                                <h3>📦 Inventory Valuation</h3>

                                <div className="report-stat-row">

                                    <span>Total Parts Categories</span>

                                    <span className="report-stat-value">{businessReports.inventorySummary.totalCategories || 0}</span>

                                </div>

                                <div className="report-stat-row">

                                    <span>Total Items in Stock</span>

                                    <span className="report-stat-value">{businessReports.inventorySummary.totalItems || 0} Units</span>

                                </div>

                                <div className="report-stat-row" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #e2e8f0' }}>

                                    <span style={{fontWeight: 'bold', color: '#1e293b'}}>Total Stock Value</span>

                                    <span className="report-stat-value" style={{color: '#16a34a', fontSize: '16px'}}>

                                        Rs. {Number(businessReports.inventorySummary.totalStockValue || 0).toLocaleString('en-LK')}

                                    </span>

                                </div>

                                <div className="manager-report-actions">
                                    {['daily', 'weekly', 'monthly', 'yearly'].map(period => (
                                        <button key={period} type="button" onClick={() => openReport(period)} className="btn-edit-user" disabled={Boolean(reportBusy)}>
                                            {period[0].toUpperCase() + period.slice(1)} Summary PDF
                                        </button>
                                    ))}
                                </div>

                            </div>

                        </div>

                        <div className="manager-report-filters">
                            <span>Choose a date for the daily, weekly, monthly, or yearly stock summary. Leave blank for today. Historical stock is available from when tracking began.</span>
                            <label>Report date <input type="date" value={reportDate} max={new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Colombo' }).format(new Date())} onChange={event => setReportDate(event.target.value)} /></label>
                            <button type="button" className="btn-edit-user" onClick={() => setReportDate('')}>Today</button>
                        </div>
                        {reportError && <p role="alert" className="manager-form-error">{reportError}</p>}

                    </div>

                )}

{activeTab === 'suppliers' && (

                    <div>

                        <div className="section-header">

                            <h2>Supplier Management</h2>

                            <div style={{ display: 'flex', gap: '10px' }}>

                                <button className="btn-add-new" onClick={() => { setShowSupplierForm(!showSupplierForm); setIsEditingSupplier(false); setSupplierError(''); setSupplierForm({ supplierId: '', supplierName: '', contactPerson: '', phone: '', email: '', category: '', deliveryAddress: '', username: '', password: '' }); }}>

                                    {showSupplierForm ? 'Close Form' : '+ Register New Supplier'}

                                </button>

                            </div>

                        </div>

{supplierError && <p role="alert" className="manager-form-error">{supplierError}</p>}
                        {showSupplierForm && <form className="user-form-card manager-supplier-form" onSubmit={handleAddSupplier}>
                            <h3>{isEditingSupplier ? 'Edit Supplier' : 'Register Supplier and Login'}</h3>
                            <div className="manager-form-grid">
                                <label>Supplier Name *<input name="supplierName" value={supplierForm.supplierName} onChange={handleSupplierChange} required maxLength="100" /></label>
                                <label>Contact Person<input name="contactPerson" value={supplierForm.contactPerson || ''} onChange={handleSupplierChange} /></label>
                                <label>Phone<input name="phone" value={supplierForm.phone || ''} onChange={handleSupplierChange} /></label>
                                <label>Email<input type="email" name="email" value={supplierForm.email || ''} onChange={handleSupplierChange} /></label>
                                <label>Category<input name="category" value={supplierForm.category || ''} onChange={handleSupplierChange} /></label>
                                <label>Delivery Address<input name="deliveryAddress" value={supplierForm.deliveryAddress || ''} onChange={handleSupplierChange} /></label>
                                {!isEditingSupplier && <>
                                    <label>Login Username *<input name="username" value={supplierForm.username} onChange={handleSupplierChange} required /></label>
                                    <label>Login Password *<input type="password" name="password" value={supplierForm.password} onChange={handleSupplierChange} minLength="8" required /></label>
                                </>}
                            </div>
                            <div className="manager-form-actions">
                                <button className="btn-update" type="submit">{isEditingSupplier ? 'Save Supplier' : 'Create Supplier Account'}</button>
                                <button className="btn-edit-user" type="button" onClick={() => { setShowSupplierForm(false); setIsEditingSupplier(false); }}>Cancel</button>
                            </div>
                        </form>}

                        <div className="supplier-table-container">

                            <table className="supplier-table">

                                <thead>

                                    <tr>

                                        <th>ID</th>

                                        <th>Supplier Name</th>

                                        <th>Contact Person</th>

                                        <th>Phone</th>

                                        <th>Email</th>

                                        <th>Category</th>

                                        <th>Status</th>

                                        <th>Actions</th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {suppliers.length > 0 ? suppliers.map(sup => (

                                        <tr key={sup.supplierId}>

                                            <td><b>#{sup.supplierId}</b></td>

                                            <td>{sup.supplierName}</td>

                                            <td>{sup.contactPerson}</td>

                                            <td>{sup.phone}</td>

                                            <td>{sup.email}</td>

                                            <td>{sup.category}</td>

                                            <td>{sup.isActive ? 'Active' : 'Archived'}</td>

                                            <td>

                                                {sup.isActive ? <>
                                                    <button onClick={() => handleEditSupplierClick(sup)} className="btn-edit-user">Edit</button>
                                                    <button onClick={() => handleDeleteSupplier(sup.supplierId)} className="btn-remove">Archive</button>
                                                </> : <button onClick={() => handleRestoreSupplier(sup.supplierId)} className="btn-edit-user">Restore</button>}

                                            </td>

                                        </tr>

                                    )) : <tr><td colSpan="8" style={{textAlign: 'center', color: '#888'}}>No suppliers registered.</td></tr>}

                                </tbody>

                            </table>

                        </div>

                    </div>

                )}

                {activeTab === 'logs' && <div className="manager-records-panel">
                    <div className="section-header"><h2>Audit Logs</h2>
                        <button className="btn-edit-user" type="button" onClick={fetchAuditLogs}>Refresh</button>
                    </div>
                    {logsError && <p role="alert" className="manager-form-error">{logsError}</p>}
                    <div className="manager-table-scroll"><table className="salary-table">
                        <thead><tr><th>Time</th><th>Action</th><th>Verified User</th><th>Details</th></tr></thead>
                        <tbody>{auditLogs.map(log => <tr key={log.logId}>
                            <td>{new Date(log.timestamp).toLocaleString('en-LK')}</td><td>{log.action}</td>
                            <td>{log.performedBy || 'Unknown'}</td><td>{log.details || '—'}</td>
                        </tr>)}{!auditLogs.length && <tr><td colSpan="4">No audit events recorded yet.</td></tr>}</tbody>
                    </table></div>
                </div>}

                {activeTab === 'security' && <div className="manager-records-panel">
                    <h2>Security: Reset a User Password</h2>
                    <p>Confirm with your own manager password before changing another account.</p>
                    {securityError && <p role="alert" className="manager-form-error">{securityError}</p>}
                    <form className="manager-form-grid manager-security-form" onSubmit={handlePasswordSubmit}>
                        <label>User Account *<select name="selectedUserId" value={passwordForm.selectedUserId} onChange={handlePasswordChange} required>
                            <option value="">Select user</option>
                            {users.map(account => <option key={account.userId} value={account.userId}>{account.name} — {account.username} ({account.role})</option>)}
                        </select></label>
                        <label>Your Manager Password *<input name="managerPassword" type="password" value={passwordForm.managerPassword} onChange={handlePasswordChange} required /></label>
                        <label>New Password *<input name="newPassword" type="password" minLength="8" maxLength="128" value={passwordForm.newPassword} onChange={handlePasswordChange} required /></label>
                        <label>Confirm New Password *<input name="confirmPassword" type="password" minLength="8" value={passwordForm.confirmPassword} onChange={handlePasswordChange} required /></label>
                        <button className="btn-update" type="submit">Change Password</button>
                    </form>
                </div>}

</div>

        </div>

    );

};

export default ManagerDashboard;
