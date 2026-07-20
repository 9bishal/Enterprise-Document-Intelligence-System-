import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SparklesIcon, LogOutIcon } from './Icons';

const MAIN_NAV_ITEMS = [
  { path: '/query', icon: '💬', label: 'Query' },
  { path: '/documents', icon: '📄', label: 'Documents' },
  { path: '/settings', icon: '⚙️', label: 'Settings' },
];

export default function MainLayout({ currentUser, userRole, userDepartment, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await onLogout();
      navigate('/login');
    }
  };

  const handleAdminDashboard = () => {
    if (userRole === 'Admin') {
      navigate('/admin');
    }
  };

  return (
    <div className="main-layout">
      {/* Top Navigation Bar */}
      <header className="top-nav-bar">
        <div className="top-nav-left">
          <div className="logo-section">
            <SparklesIcon style={{ width: 20, height: 20, color: '#030712' }} />
            <h1 className="logo-text">Intradoc AI</h1>
          </div>
        </div>

        <nav className="top-nav-center">
          {MAIN_NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className={`nav-btn ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="top-nav-right">
          <div className="user-info">
            <span className="user-name">{currentUser}</span>
            <span className="user-role">{userRole}</span>
            {userDepartment && userRole !== 'Admin' && (
              <span className="user-department">{userDepartment}</span>
            )}
          </div>

          {userRole === 'Admin' && (
            <button 
              className="admin-btn"
              onClick={handleAdminDashboard}
              title="Go to Admin Dashboard"
            >
              👤 Admin Panel
            </button>
          )}

          <button 
            className="logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOutIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
        >
          ☰
        </button>
      </header>

      {/* Mobile Navigation Menu */}
      {isMobileNavOpen && (
        <div className="mobile-nav-menu">
          {MAIN_NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className={`mobile-nav-btn ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => {
                navigate(item.path);
                setIsMobileNavOpen(false);
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          {userRole === 'Admin' && (
            <button 
              className="mobile-nav-btn"
              onClick={() => {
                handleAdminDashboard();
                setIsMobileNavOpen(false);
              }}
            >
              <span>👤</span>
              <span>Admin Panel</span>
            </button>
          )}
          <button 
            className="mobile-nav-btn logout"
            onClick={() => {
              handleLogout();
              setIsMobileNavOpen(false);
            }}
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>

      <style jsx>{`
        .main-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          background: #FAF9F5;
          font-family: 'Plus Jakarta Sans', sans-serif;
          overflow: hidden;
        }

        .top-nav-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(20, 20, 19, 0.08);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          gap: 24px;
        }

        .top-nav-left {
          display: flex;
          align-items: center;
          min-width: 200px;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          padding: 8px 12px;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .logo-section:hover {
          background: rgba(20, 20, 19, 0.04);
        }

        .logo-text {
          font-size: 18px;
          font-weight: 700;
          color: #030712;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .top-nav-center {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          justify-content: center;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #8E8B82;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .nav-btn:hover {
          background: rgba(20, 20, 19, 0.06);
          color: #141413;
        }

        .nav-btn.active {
          background: rgba(3, 7, 18, 0.1);
          color: #030712;
          box-shadow: inset 0 2px 4px rgba(20, 20, 19, 0.04);
        }

        .nav-icon {
          font-size: 18px;
        }

        .nav-label {
          display: none;
        }

        @media (min-width: 768px) {
          .nav-label {
            display: inline;
          }
        }

        .top-nav-right {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 200px;
          justify-content: flex-end;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: #141413;
        }

        .user-role {
          font-size: 11px;
          color: #8E8B82;
        }

        .user-department {
          font-size: 10px;
          color: #A39F94;
        }

        .admin-btn {
          padding: 8px 12px;
          background: rgba(3, 7, 18, 0.08);
          border: 1px solid rgba(3, 7, 18, 0.15);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #030712;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .admin-btn:hover {
          background: rgba(3, 7, 18, 0.12);
          border-color: rgba(3, 7, 18, 0.25);
        }

        .logout-btn {
          padding: 8px;
          background: transparent;
          border: 1px solid rgba(200, 100, 100, 0.3);
          border-radius: 8px;
          color: #C8644A;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logout-btn:hover {
          background: rgba(200, 100, 100, 0.1);
          border-color: rgba(200, 100, 100, 0.5);
        }

        .mobile-menu-toggle {
          display: none;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #141413;
        }

        @media (max-width: 1024px) {
          .top-nav-center {
            display: none;
          }

          .mobile-menu-toggle {
            display: block;
          }

          .top-nav-bar {
            gap: 12px;
          }

          .top-nav-right {
            min-width: auto;
            gap: 8px;
          }

          .user-info {
            display: none;
          }

          .admin-btn {
            display: none;
          }
        }

        .mobile-nav-menu {
          display: none;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.9);
          border-bottom: 1px solid rgba(20, 20, 19, 0.08);
        }

        @media (max-width: 1024px) {
          .mobile-nav-menu {
            display: flex;
          }
        }

        .mobile-nav-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #8E8B82;
          transition: all 0.2s ease;
        }

        .mobile-nav-btn:hover,
        .mobile-nav-btn.active {
          background: rgba(20, 20, 19, 0.06);
          color: #141413;
        }

        .mobile-nav-btn.logout {
          color: #C8644A;
          border-top: 1px solid rgba(20, 20, 19, 0.08);
          margin-top: 8px;
        }

        .mobile-nav-btn.logout:hover {
          background: rgba(200, 100, 100, 0.1);
        }

        .main-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 24px;
          display: flex;
          flex-direction: column;
        }

        @media (max-width: 768px) {
          .main-content {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
