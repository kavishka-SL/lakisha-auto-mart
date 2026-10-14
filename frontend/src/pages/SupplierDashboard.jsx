import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/SupplierDashboard.css';

const SupplierDashboard = ({ loggedUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState('order-details');
  const [supplierInfo, setSupplierInfo] = useState({
    supplierName: '', contactPerson: '', phone: '', email: '', category: '', deliveryAddress: ''
  });

  const [orders, setOrders] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [newOrderAlert, setNewOrderAlert] = useState(true);

  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedOrderForQuote, setSelectedOrderForQuote] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    partName: '',
    quantity: 1,
    unitPrice: 0,
    validUntil: '',
    notes: ''
  });

  const supplierId = loggedUser?.supplierId;

  const fetchSupplierProfile = useCallback(async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/supplier/profile/${supplierId}`);
      if (res.data.success && res.data.profile.supplierName) {
        setSupplierInfo(res.data.profile);
      }
    } catch (err) {
      console.error("Error fetching profile", err);
    }
  }, [supplierId]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/supplier/office-orders/${supplierId}`);
      if (res.data.success) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error("Error fetching orders", err);
    }
  }, [supplierId]);

  const fetchQuotations = useCallback(async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/supplier/quotations/${supplierId}`);
      if (res.data.success) {
        setQuotations(res.data.quotations);
      }
    } catch (err) {
      console.error("Error fetching quotations", err);
    }
  }, [supplierId]);

  useEffect(() => {
    if (!supplierId) return;
    fetchSupplierProfile();
    fetchOrders();
    fetchQuotations();
  }, [supplierId, fetchSupplierProfile, fetchOrders, fetchQuotations]);

  const handleAcceptOrder = async (orderId) => {
    try {
      const res = await axios.put(`http://localhost:5000/api/supplier/order/accept/${orderId}`);
      if (res.data.success) {
        alert("Order Accepted Successfully!");
        fetchOrders();
      }
    } catch (err) {
      alert("Error accepting order");
    }
  };

  const handleRejectOrder = async (orderId) => {
    const reason = prompt("Please enter the reason for rejection:");
    if (!reason) return;

    try {
      const res = await axios.put(`http://localhost:5000/api/supplier/order/reject/${orderId}`, { rejectionReason: reason });
      if (res.data.success) {
        alert("Order Rejected!");
        fetchOrders();
      }
    } catch (err) {
      alert("Error rejecting order");
    }
  };

  const handleOpenQuoteModal = (order) => {
    setSelectedOrderForQuote(order);
    setQuoteForm({
      partName: order ? order.itemDetails : '',
      quantity: order ? order.quantity : 1,
      unitPrice: 0,
      validUntil: '',
      notes: ''
    });
    setShowQuoteModal(true);
  };

  const handleCreateQuotationSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...quoteForm,
        orderId: selectedOrderForQuote ? selectedOrderForQuote.orderId : null,
        supplierId: supplierId
      };
      const res = await axios.post('http://localhost:5000/api/supplier/quotation/create', payload);
      if (res.data.success) {
        alert("Quotation Created Successfully!");
        setShowQuoteModal(false);
        fetchQuotations();
      }
    } catch (err) {
      alert("Error creating quotation");
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus, estDate) => {
    try {
      const res = await axios.put(`http://localhost:5000/api/supplier/order/update-status/${orderId}`, {
        status: newStatus,
        estimatedDeliveryDate: estDate
      });
      if (res.data.success) {
        alert("Status Updated!");
        fetchOrders();
      }
    } catch (err) {
      alert("Error updating status");
    }
  };

  const handleCompleteOrder = async (orderId) => {
    try {
      const res = await axios.put(`http://localhost:5000/api/supplier/order/complete/${orderId}`);
      if (res.data.success) {
        alert("Order moved to Completed list!");
        fetchOrders();
      }
    } catch (err) {
      alert("Error completing order");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(`http://localhost:5000/api/supplier/profile/update/${supplierId}`, supplierInfo);
      if (res.data.success) {
        alert("Profile Updated Successfully!");
      }
    } catch (err) {
      alert("Profile Update Failed");
    }
  };

  const pendingOfficeOrders = orders.filter(o => o.status === 'PENDING');
  const acceptedMyOrders = orders.filter(o => ['ACCEPTED', 'PROCESSING', 'DISPATCHED', 'DELIVERED'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');

  return (
    <div className="supplier-dashboard-container">
      {newOrderAlert && pendingOfficeOrders.length > 0 && (
        <div className="top-alert-banner">
          <span>🔔 You have new orders from Office Management ({pendingOfficeOrders.length})!</span>
          <button className="close-banner-btn" onClick={() => setNewOrderAlert(false)}>✕</button>
        </div>
      )}

      <header className="supplier-header">
        <div className="header-brand">
          <h2>Lakisha Auto Mart</h2>
          <span className="portal-tag">Supplier Portal</span>
        </div>
        <div className="header-right">
          <div className="supplier-welcome">
            <span className="welcome-label">Welcome,</span>
            <strong className="supplier-name-display">{supplierInfo.supplierName}</strong>
          </div>
          <button className="logout-btn" onClick={onLogout}>Logout 🚪</button>
        </div>
      </header>

      <nav className="supplier-nav-bar">
        <button
          className={activeTab === 'order-details' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('order-details')}
        >
          📦 Order Details {pendingOfficeOrders.length > 0 && <span className="badge">{pendingOfficeOrders.length}</span>}
        </button>
        <button
          className={activeTab === 'quotations' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('quotations')}
        >
          📄 Quotations
        </button>
        <button
          className={activeTab === 'my-orders' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('my-orders')}
        >
          🚚 My Orders
        </button>
        <button
          className={activeTab === 'my-profile' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('my-profile')}
        >
          👤 My Profile
        </button>
      </nav>

      <main className="dashboard-content">

        {activeTab === 'order-details' && (
          <div className="tab-pane">
            <h3>Office Management Orders</h3>
            <p className="section-desc">Check the new orders from Office Management and Accept or Reject them.</p>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Order Item / Description</th>
                  <th>Quantity</th>
                  <th>Required Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingOfficeOrders.length > 0 ? (
                  pendingOfficeOrders.map(ord => (
                    <tr key={ord.orderId}>
                      <td>#ORD-{ord.orderId}</td>
                      <td>{ord.orderItem}</td>
                      <td>{ord.quantity}</td>
                      <td>{ord.requiredDate ? new Date(ord.requiredDate).toLocaleDateString('en-LK') : '—'}</td>
                      <td><span className="status-badge pending">{ord.status}</span></td>
                      <td>
                        <button className="btn-accept" onClick={() => handleAcceptOrder(ord.orderId)}>Accept</button>
                        <button className="btn-reject" onClick={() => handleRejectOrder(ord.orderId)}>Reject</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="no-data">No new orders available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'quotations' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h3>Quotations List</h3>
              <button className="btn-primary" onClick={() => handleOpenQuoteModal(null)}>+ Create New Quotation</button>
            </div>
           <table className="custom-table">
                <thead>
                    <tr>
                    <th>Quote ID</th>
                    <th>Order Ref</th>
                    <th>Part Name / Details</th>
                    <th>Total Amount (LKR)</th>
                    <th>Status</th>
                    <th>Submitted Date</th>
                    </tr>
                </thead>
                <tbody>
                    {quotations.length > 0 ? (
                    quotations.map(q => (
                        <tr key={q.quotationId}>
                        <td>#QT-{q.quotationId}</td>
                        <td>{q.orderId ? `#ORD-${q.orderId}` : 'Direct'}</td>
                        <td>{q.requestDetails || q.partName || 'N/A'}</td>
                        <td><strong>{Number(q.quotedAmount || q.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
                        <td><span className={`status-badge ${q.status?.toLowerCase()}`}>{q.status}</span></td>
                        <td>{q.submittedDate ? new Date(q.submittedDate).toISOString().split('T')[0] : 'N/A'}</td>
                        </tr>
                    ))
                    ) : (
                    <tr><td colSpan="6" className="no-data">No quotations available.</td></tr>
                    )}
                </tbody>
                </table>
          </div>
        )}

        {activeTab === 'my-orders' && (
          <div className="tab-pane">
            <h3>Accepted Active Orders</h3>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Item Details</th>
                  <th>Required Date</th>
                  <th>Payment Status</th>
                  <th>Order Status</th>
                  <th>Estimated Delivery Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {acceptedMyOrders.length > 0 ? (
                  acceptedMyOrders.map(ord => (
                    <tr key={ord.orderId}>
                      <td>#ORD-{ord.orderId}</td>
                      <td>{ord.itemDetails} (Qty: {ord.quantity})</td>
                      <td>{ord.requestedDate}</td>
                      <td>
                        <span className={`status-badge ${ord.paymentStatus === 'PAID' ? 'paid' : 'unpaid'}`}>
                          {ord.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <select
                          className="status-select"
                          value={ord.status}
                          onChange={(e) => handleUpdateOrderStatus(ord.orderId, e.target.value, ord.estimatedDeliveryDate)}
                        >
                          <option value="ACCEPTED">ACCEPTED</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="DISPATCHED">DISPATCHED</option>
                          <option value="DELIVERED">DELIVERED</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          className="date-picker"
                          value={ord.estimatedDeliveryDate ? ord.estimatedDeliveryDate.split('T')[0] : ''}
                          onChange={(e) => handleUpdateOrderStatus(ord.orderId, ord.status, e.target.value)}
                        />
                      </td>
                      <td>
                        <button className="btn-complete" onClick={() => handleCompleteOrder(ord.orderId)}>Complete ✓</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" className="no-data">Active Orders are not available.</td></tr>
                )}
              </tbody>
            </table>

            <h4 className="sub-title">Completed Orders History</h4>
            <table className="custom-table completed-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Item Details</th>
                  <th>Required Date</th>
                  <th>Payment Status</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.length > 0 ? (
                  completedOrders.map(ord => (
                    <tr key={ord.orderId}>
                      <td>#ORD-{ord.orderId}</td>
                      <td>{ord.itemDetails}</td>
                      <td>{ord.requestedDate}</td>
                      <td><span className="status-badge paid">{ord.paymentStatus}</span></td>
                      <td><span className="status-badge completed">COMPLETED</span></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" className="no-data">Completed Orders are not available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'my-profile' && (
          <div className="tab-pane">
            <h3>Supplier Profile Details</h3>
            <form className="profile-form" onSubmit={handleUpdateProfile}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Company / Supplier Name</label>
                  <input
                    type="text"
                    value={supplierInfo.supplierName || ''}
                    onChange={e => setSupplierInfo({...supplierInfo, supplierName: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input
                    type="text"
                    value={supplierInfo.contactPerson || ''}
                    onChange={e => setSupplierInfo({...supplierInfo, contactPerson: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    value={supplierInfo.phone || ''}
                    onChange={e => setSupplierInfo({...supplierInfo, phone: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={supplierInfo.email || ''}
                    onChange={e => setSupplierInfo({...supplierInfo, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    value={supplierInfo.category || ''}
                    onChange={e => setSupplierInfo({...supplierInfo, category: e.target.value})}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Delivery Address</label>
                  <textarea
                    rows="3"
                    value={supplierInfo.deliveryAddress || ''}
                    onChange={e => setSupplierInfo({...supplierInfo, deliveryAddress: e.target.value})}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary">Save Profile Changes</button>
            </form>
          </div>
        )}
      </main>

      {showQuoteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Create Quotation</h4>
              <button className="close-btn" onClick={() => setShowQuoteModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateQuotationSubmit}>
              <div className="form-group">
                <label>Spare Part Name</label>
                <input
                  type="text"
                  required
                  value={quoteForm.partName}
                  onChange={e => setQuoteForm({...quoteForm, partName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quoteForm.quantity}
                  onChange={e => setQuoteForm({...quoteForm, quantity: Number(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>Unit Price (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={quoteForm.unitPrice}
                  onChange={e => setQuoteForm({...quoteForm, unitPrice: Number(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>Valid Until</label>
                <input
                  type="date"
                  value={quoteForm.validUntil}
                  onChange={e => setQuoteForm({...quoteForm, validUntil: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Notes / Remarks</label>
                <textarea
                  rows="2"
                  value={quoteForm.notes}
                  onChange={e => setQuoteForm({...quoteForm, notes: e.target.value})}
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Submit Quotation</button>
                <button type="button" className="btn-secondary" onClick={() => setShowQuoteModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierDashboard;
