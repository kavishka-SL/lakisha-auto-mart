import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';

function Login({ setUser }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('http://localhost:5000/api/auth/login', { username, password });

            if (response.data.success) {
                const userData = response.data.user;
                setUser(userData);

                localStorage.setItem('user', JSON.stringify(userData));
                localStorage.setItem('userRole', userData.role);
                localStorage.setItem('authToken', response.data.token);
                axios.defaults.headers.common.Authorization = `Bearer ${response.data.token}`;
                if (userData.supplierId) {
                    localStorage.setItem('supplierId', userData.supplierId);
                }

                console.log("=== LOGIN USER DATA ===", userData);
                console.log("=== USER ROLE ===", userData.role);

                const role = userData.role ? userData.role.toString().replace(/_/g, ' ').toUpperCase().trim() : '';

                if (role === 'MANAGER' || role === 'ADMIN') {
                    navigate('/manager-dashboard');
                } else if (role === 'SERVICE ADVISOR' || role === 'ADVISOR') {
                    navigate('/advisor-dashboard');
                } else if (role === 'OFFICE MANAGEMENT' || role === 'OFFICE' || role === 'OFFICE STAFF') {
                    navigate('/office-dashboard');
                } else if (role === 'TECHNICIAN' || role === 'TECH') {
                    navigate('/tech-dashboard');
                } else if (role === 'CUSTOMER') {
                    navigate('/customer-dashboard');
                } else if (role === 'SUPPLIER') {

                    navigate('/supplier-portal');
                } else {
                    setError(`Unknown Role: ${userData.role}`);
                    navigate('/');
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Server connection error!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        <button type="button" className="staff-back-button" onClick={() => navigate('/')}>
            ← Back to Dashboard
        </button>
        <div className="login-container">
            <h2>Lakisha Auto Mart</h2>
            <h3>System Login</h3>

            {error && <div className="alert-danger">{error}</div>}

            <form onSubmit={handleLogin}>
                <div className="form-group">
                    <label>Username:</label>
                    <input
                        type="text"
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Password:</label>
                    <input
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
        </>
    );
}

export default Login;
