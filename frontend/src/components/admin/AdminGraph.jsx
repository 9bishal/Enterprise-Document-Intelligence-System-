import React from 'react';
import KnowledgeGraphVisualizer from '../KnowledgeGraphVisualizer';
import styles from './AdminStyles';

export default function AdminGraph({ graphData }) {
  return (
    <div className="admin-scrollable" style={{ paddingBottom: 0 }}>
      <div className="glass-panel" style={{ ...styles.card, height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
        <h3 style={styles.cardTitle}>🕸️ Enterprise Knowledge Graph</h3>
        <p style={{ fontSize: '12px', color: '#8E8B82', marginBottom: '16px' }}>
          Visual mapping of isolated multi-tenant vector stores across departments.
        </p>
        
        <div style={{ flex: 1, backgroundColor: '#FAF9F5', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
          <KnowledgeGraphVisualizer data={graphData} />
        </div>
      </div>
    </div>
  );
}
