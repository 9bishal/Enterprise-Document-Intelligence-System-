import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { SparklesIcon } from './Icons';
import AdminAnalytics from './admin/AdminAnalytics';
import AdminRoster from './admin/AdminRoster';
import AdminGraph from './admin/AdminGraph';
import AdminSystemConfig from './admin/AdminSystemConfig';

const NAV_ITEMS = [
  { key: 'analytics', icon: '📊', label: 'Analytics & Security' },
  { key: 'roster',    icon: '👥', label: 'Corporate Roster' },
  { key: 'graph',     icon: '🕸️', label: 'Knowledge Graph' },
  { key: 'system',    icon: '⚙️', label: 'System Config' },
];

export default function AdminDashboard({ 
  API_BASE, currentUser, userRole, userDepartment, 
  onConfigSaved, onLogout
}) {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState('analytics');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [graphData, setGraphData] = useState({ departments: [], documents: [], connections: [] });
  const [llmConfig, setLlmConfig] = useState(null);
  const [savingLlm, setSavingLlm] = useState(false);

  const token = localStorage.getItem('intradoc_token');
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, uRes, gRes, lRes] = await Promise.all([
        api.getAdminMetrics(),
        api.getAdminUsers(),
        api.getKnowledgeGraph(),
        api.getAdminLlmConfig()
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (uRes.ok) setUsers(await uRes.json());
      if (gRes.ok) setGraphData(await gRes.json());
      if (lRes.ok) setLlmConfig(await lRes.json());
    } catch (e) {
      console.error('Failed to load admin dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLlmConfig = async () => {
    setSavingLlm(true);
    try {
      const res = await api.updateAdminLlmConfig(llmConfig);
      if (res.ok) {
        alert("Global LLM Configuration saved successfully!");
        if (onConfigSaved) onConfigSaved();
      } else {
        alert("Failed to save configuration.");
      }
    } catch (e) { console.error(e); }
    finally { setSavingLlm(false); }
  };

  return (
    <div className="admin-layout">
      {/* ───── Left Navigation Sidebar ───── */}
      <aside className="admin-nav glass-panel">
        {/* Branding */}
        <div className="admin-nav-header">
          <div className="logo-icon">
            <SparklesIcon style={{ width: 16, height: 16, color: '#030712' }} />
          </div>
          <div>
            <h1 className="logo-text" style={{ fontSize: 17 }}>Intradoc AI</h1>
            <span className="admin-badge">Admin Console</span>
          </div>
        </div>

        {/* Navigation Links */}
          <nav className="admin-nav-links">
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                className={`admin-nav-btn ${activeSubTab === item.key ? 'active' : ''}`}
                onClick={() => setActiveSubTab(item.key)}
              >
                <span className="admin-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>        {/* Workspace Quick-Switch */}
        <div className="admin-nav-divider" />
        <button 
          className="admin-workspace-btn" 
          onClick={() => navigate('/query')}
          title="Go to Chat & Query Interface"
        >
          <span>✦</span> RAG Workspace
        </button>

          {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Profile Card */}
        <div className="admin-profile-card">
          <div className="admin-profile-avatar">
            {currentUser ? currentUser.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="admin-profile-info">
            <span className="admin-profile-name">{currentUser || 'Admin'}</span>
            <span className="admin-profile-role">{userRole || 'Admin'}</span>
          </div>
          <button className="admin-signout-btn" onClick={onLogout} title="Sign Out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ───── Main Content Area ───── */}
      <main className="admin-main">
        {/* Top Header Bar */}
        <header className="admin-top-header">
          <div>
            <h2 className="admin-page-title">
              {NAV_ITEMS.find(i => i.key === activeSubTab)?.icon}{' '}
              {NAV_ITEMS.find(i => i.key === activeSubTab)?.label}
            </h2>
            <p className="admin-page-subtitle">Enterprise Control & Security Dashboard</p>
          </div>
          <div className="admin-header-meta">
            <span className="admin-live-dot" /> Live
            <span className="admin-dept-tag">{userDepartment || 'All'}</span>
          </div>
        </header>

        {/* Content Area */}
        <div className="admin-content-area">
          {loading ? (
            <div className="admin-loading-state">
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <p>Loading administration data...</p>
            </div>
          ) : !metrics ? (
            <div className="admin-loading-state">
              <p>Failed to load metrics. Check backend connection.</p>
            </div>
          ) : (
            <>
              {activeSubTab === 'analytics' && <AdminAnalytics metrics={metrics} />}
              {activeSubTab === 'roster' && (
                <AdminRoster 
                  users={users} 
                  authHeaders={authHeaders} 
                  API_BASE={API_BASE} 
                  onRefreshUsers={async () => {
                    const res = await api.getAdminUsers();
                    if (res.ok) setUsers(await res.json());
                  }} 
                />
              )}
              {activeSubTab === 'graph' && <AdminGraph graphData={graphData} />}
              {activeSubTab === 'system' && (
                <AdminSystemConfig 
                  llmConfig={llmConfig} 
                  setLlmConfig={setLlmConfig} 
                  handleSaveLlmConfig={handleSaveLlmConfig} 
                  savingLlm={savingLlm} 
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
