import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import QueryPage from './pages/QueryPage';
import DocumentsPage from './pages/DocumentsPage';
import SettingsPage from './pages/SettingsPage';
import MainLayout from './components/MainLayout';

const API_BASE = 'http://localhost:8001/api';

export default function App() {
  // --- Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userDepartment, setUserDepartment] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- Persistent LLM Settings ---
  const [apiKeys, setApiKeys] = useState(() => {
    try {
      const saved = localStorage.getItem('intradoc_api_keys');
      return saved ? JSON.parse(saved) : { groq: '', gemini: '', openai: '' };
    } catch { return { groq: '', gemini: '', openai: '' }; }
  });

  const [modelConfig, setModelConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('intradoc_model_config');
      return saved ? JSON.parse(saved) : {
        provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.3, k: 4
      };
    } catch {
      return { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.3, k: 4 };
    }
  });

  const [isGlobalConfigEnforced, setIsGlobalConfigEnforced] = useState(false);

  useEffect(() => {
    localStorage.setItem('intradoc_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  useEffect(() => {
    localStorage.setItem('intradoc_model_config', JSON.stringify(modelConfig));
  }, [modelConfig]);

  // --- Check Auth on Mount ---
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = localStorage.getItem('intradoc_token');
        if (!token) { setAuthLoading(false); return; }

        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(true);
          setCurrentUser(data.username);
          setUserRole(data.role);
          setUserDepartment(data.department || localStorage.getItem('intradoc_department') || 'General');
        } else {
          localStorage.removeItem('intradoc_token');
          localStorage.removeItem('intradoc_role');
          localStorage.removeItem('intradoc_department');
        }
      } catch (err) {
        console.error('Failed to verify auth status on mount:', err);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  // --- Fetch Global LLM Config ---
  useEffect(() => {
    if (isAuthenticated) fetchGlobalConfig();
  }, [isAuthenticated]);

  const fetchGlobalConfig = async () => {
    try {
      const token = localStorage.getItem('intradoc_token');
      const res = await fetch(`${API_BASE}/llm-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsGlobalConfigEnforced(data.enforce_globally);
        if (data.enforce_globally) setModelConfig(data.config);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApiKeyChange = (provider, value) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('intradoc_token');
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('intradoc_token');
      localStorage.removeItem('intradoc_role');
      localStorage.removeItem('intradoc_department');
      setIsAuthenticated(false);
      setCurrentUser(null);
      setUserRole(null);
      setUserDepartment(null);
    }
  };

  // --- Loading Splash ---
  if (authLoading) {
    return (
      <div style={{
        display: 'flex', height: '100vh', width: '100vw',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FAF9F5', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#141413'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="spinner" style={{ width: 28, height: 28 }}></div>
          <p style={{ fontSize: 14, fontWeight: 500 }}>Initializing secure workspace...</p>
        </div>
      </div>
    );
  }

  // --- Route Rendering with Protected Routes ---
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onAuthSuccess={(username, role, department) => {
          setIsAuthenticated(true);
          setCurrentUser(username);
          setUserRole(role);
          setUserDepartment(department || 'General');
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
        {userRole === 'Admin' && (
          <Route
            path="/admin/*"
            element={
              <AdminDashboard
                API_BASE={API_BASE}
                currentUser={currentUser}
                userRole={userRole}
                userDepartment={userDepartment}
                onConfigSaved={fetchGlobalConfig}
                onLogout={handleLogout}
              />
            }
          />
        )}

        {/* Protected Routes */}
        <Route
          element={
            <MainLayout
              currentUser={currentUser}
              userRole={userRole}
              userDepartment={userDepartment}
              onLogout={handleLogout}
            />
          }
        >
          <Route
            path="/query"
            element={
              <QueryPage
                API_BASE={API_BASE}
                apiKeys={apiKeys}
                modelConfig={modelConfig}
                isGlobalConfigEnforced={isGlobalConfigEnforced}
                currentUser={currentUser}
                userRole={userRole}
                userDepartment={userDepartment}
              />
            }
          />
          <Route
            path="/documents"
            element={
              <DocumentsPage
                API_BASE={API_BASE}
                currentUser={currentUser}
                userRole={userRole}
                userDepartment={userDepartment}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                API_BASE={API_BASE}
                apiKeys={apiKeys}
                handleApiKeyChange={handleApiKeyChange}
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
                isGlobalConfigEnforced={isGlobalConfigEnforced}
                userRole={userRole}
              />
            }
          />
          <Route path="/" element={<Navigate to="/query" replace />} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/query" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
