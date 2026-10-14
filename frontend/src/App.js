import React, { useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage.jsx';
import Login from './pages/Login.jsx';

import ManagerDashboard from './pages/ManagerDashboard.jsx';
import AdvisorDashboard from './pages/ServiceAdvisorDashboard.jsx';
import OfficeDashboard from './pages/OfficeDashboard.jsx';
import TechDashboard from './pages/TechnicianDashboard.jsx';
import CustomerDashboard from './pages/CustomerPortal.jsx';
import SupplierDashboard from './pages/SupplierDashboard.jsx';

function dashboardPath(role) {
  const normalized = String(role || '').replace(/_/g, ' ').toUpperCase().trim();
  if (['MANAGER', 'ADMIN'].includes(normalized)) return '/manager-dashboard';
  if (['SERVICE ADVISOR', 'ADVISOR'].includes(normalized)) return '/advisor-dashboard';
  if (['OFFICE MANAGEMENT', 'OFFICE', 'OFFICE STAFF'].includes(normalized)) return '/office-dashboard';
  if (['TECHNICIAN', 'TECH'].includes(normalized)) return '/tech-dashboard';
  if (normalized === 'SUPPLIER') return '/supplier-portal';
  if (normalized === 'CUSTOMER') return '/customer-dashboard';
  return null;
}

function HomeRoute({ user }) {
  const destination = dashboardPath(user?.role) ||
    (sessionStorage.getItem('vehicleLoginId') ? '/customer-dashboard' : null);
  return destination ? <Navigate to={destination} replace /> : <LandingPage />;
}

function ProtectedRoute({ user, allowedRoles, children }) {
  if (!user) {
    return <Navigate to="/staff-login" replace />;
  }

  const formatRole = (role) => (role ? role.replace(/_/g, ' ').toUpperCase().trim() : '');
  const userRole = formatRole(user.role);

  const isAllowed = allowedRoles.some(role => formatRole(role) === userRole);

  if (!isAllowed) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
        <h2 style={{ padding: '20px', color: 'red' }}>403 - Access Denied</h2>
        <p>Your Current Role: <b>{user.role}</b></p>
        <button
          style={{ padding: '10px 20px', cursor: 'pointer', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }}
          onClick={() => {
            localStorage.clear();
            window.location.href = '/staff-login';
          }}
        >
          Back to Login
        </button>
      </div>
    );
  }

  return children;
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('authToken');
      if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      if (storedUser && !token) {
        localStorage.removeItem('user');
        return null;
      }
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  });

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeRoute user={user} />} />

        <Route path="/staff-login" element={dashboardPath(user?.role) ? <Navigate to={dashboardPath(user.role)} replace /> : <Login setUser={setUser} />} />

        <Route
          path="/manager-dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={["MANAGER", "ADMIN"]}>
              <ManagerDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/advisor-dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={["SERVICE_ADVISOR", "SERVICE ADVISOR", "ADVISOR"]}>
              <AdvisorDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/office-dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={["OFFICE_MANAGEMENT", "OFFICE MANAGEMENT", "OFFICE", "OFFICE_STAFF"]}>
              <OfficeDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tech-dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={["TECHNICIAN", "TECH"]}>
              <TechDashboard user={user} setUser={setUser} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/supplier-portal"
          element={
            <ProtectedRoute user={user} allowedRoles={["SUPPLIER"]}>
              <SupplierDashboard loggedUser={user} onLogout={() => {
                localStorage.clear();
                setUser(null);
                window.location.href = '/staff-login';
              }} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer-dashboard"
          element={<CustomerDashboard />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
