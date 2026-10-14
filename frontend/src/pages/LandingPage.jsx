import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [typedText, setTypedText] = useState('');

  const fullText = "WELCOME TO LAKSHA AUTO MART";

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(fullText.substring(0, i + 1));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 100);

    return () => clearInterval(typingInterval);
  }, []);

  return (
    <div className="landing-container">

      <div
        className="top-right-menu"
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        <div className="dots-icon">⋮</div>
        {showMenu && (
          <div className="dropdown-menu">
            <button onClick={() => navigate('/staff-login')} className="staff-login-btn">
              🔒 Staff Login
            </button>
          </div>
        )}
      </div>

      <div className="landing-content">
        <h1 className="animated-title">
          {typedText}
          <span className="cursor-blink">|</span>
        </h1>
        <p className="subtitle">Premium Auto Care & Performance Tuning</p>

        <button
          className="glowing-btn"
          onClick={() => navigate('/customer-dashboard')}
        >
          ENTER CUSTOMER PORTAL
        </button>
      </div>

    </div>
  );
}
