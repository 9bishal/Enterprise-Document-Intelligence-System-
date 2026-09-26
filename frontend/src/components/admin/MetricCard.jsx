import React from 'react';
import styles from './AdminStyles';

export default function MetricCard({ title, value }) {
  return (
    <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '500', marginBottom: '8px' }}>{title}</span>
      <span style={{ fontSize: '28px', fontWeight: '700', color: '#111111' }}>{value}</span>
    </div>
  );
}
