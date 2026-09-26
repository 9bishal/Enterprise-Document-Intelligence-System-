import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{
        position: 'fixed', top: 20, right: 20, zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: 8
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 10,
            background: t.type === 'error' ? '#FEF2F2' : t.type === 'success' ? '#F0FDF4' : '#ffffff',
            border: `1px solid ${t.type === 'error' ? '#FECACA' : t.type === 'success' ? '#BBF7D0' : 'rgba(0,0,0,0.12)'}`,
            color: t.type === 'error' ? '#991B1B' : t.type === 'success' ? '#166534' : '#111111',
            fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxWidth: 360, cursor: 'pointer'
          }} onClick={() => removeToast(t.id)}>
            <span style={{ flex: 1 }}>{t.message}</span>
            <span style={{ opacity: 0.5, fontSize: 11 }}>✕</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
