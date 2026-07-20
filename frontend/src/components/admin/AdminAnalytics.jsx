import React, { useState } from 'react';
import MetricCard from './MetricCard';
import styles from './AdminStyles';

export default function AdminAnalytics({ metrics }) {
  const { total_users, total_documents, total_chunks, estimated_tokens } = metrics.metrics;
  const [deletingDocId, setDeletingDocId] = useState(null);

  const handleDeleteDocument = async (docId, docName) => {
    if (!window.confirm(`Are you sure you want to delete "${docName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingDocId(docId);
    const token = localStorage.getItem('intradoc_token');

    try {
      const response = await fetch(`http://localhost:8001/api/admin/documents/${docId}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert(`Document "${docName}" deleted successfully!`);
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to delete document'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeletingDocId(null);
    }
  };

  return (
    <div className="admin-scrollable">
      <div className="metrics-grid" style={styles.metricsGrid}>
        <MetricCard title="Total Users" value={total_users} />
        <MetricCard title="Indexed Documents" value={total_documents} />
        <MetricCard title="Vector Chunks" value={total_chunks} />
        <MetricCard title="Est. Processed Tokens" value={`${(estimated_tokens / 1000).toFixed(1)}k`} />
      </div>

      <div style={styles.twoColumnGrid}>
        {/* Security Alerts */}
        <div className="glass-panel" style={styles.card}>
          <h3 style={styles.cardTitle}>⚠️ Security & Compliance Flags</h3>
          {metrics.flagged_documents.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#8E8B82' }}>No compliance risks detected in current index.</p>
          ) : (
            <div style={styles.list}>
              {metrics.flagged_documents.map(d => (
                <div key={d.id} style={styles.listItem}>
                  <div style={styles.listHeader}>
                    <span style={styles.itemTitle}>{d.filename}</span>
                    <span style={styles.dangerBadge}>Risk Detected</span>
                  </div>
                  <p style={styles.itemDesc}>{d.risk_details}</p>
                  <div style={styles.itemMeta}>Owner: {d.owner} • Dept: {d.department} • Class: {d.classification}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Classification */}
        <div className="glass-panel" style={styles.card}>
          <h3 style={styles.cardTitle}>📂 Data Classification Dist.</h3>
          <div style={styles.distGrid}>
            {Object.entries(metrics.classification_distribution).map(([category, count]) => (
              <div key={category} style={styles.distRow}>
                <span style={{ fontSize: '13px', color: '#5C5A55' }}>{category}</span>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vector Database Documents */}
      <div className="glass-panel" style={{ ...styles.card, marginTop: '24px' }}>
        <h3 style={styles.cardTitle}>🗄️ Vector Database - Indexed Documents</h3>
        <p style={{ fontSize: '12px', color: '#8E8B82', marginBottom: '16px' }}>
          Complete list of documents currently available in the vector database for RAG retrieval
        </p>
        {metrics.indexed_documents && metrics.indexed_documents.length > 0 ? (
          <div style={styles.list}>
            {metrics.indexed_documents.map((doc, idx) => (
              <div key={doc.id || idx} style={styles.listItem}>
                <div style={styles.listHeader}>
                  <span style={styles.itemTitle}>📄 {doc.filename}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#648F64', background: 'rgba(100, 150, 100, 0.15)', padding: '4px 8px', borderRadius: '4px' }}>
                      {doc.status}
                    </span>
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                      disabled={deletingDocId === doc.id}
                      style={{
                        padding: '4px 8px',
                        background: deletingDocId === doc.id ? 'rgba(200, 50, 50, 0.3)' : 'rgba(200, 50, 50, 0.15)',
                        color: '#C83232',
                        border: '1px solid rgba(200, 50, 50, 0.3)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: deletingDocId === doc.id ? 'wait' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {deletingDocId === doc.id ? '⏳ Deleting...' : '🗑️ Delete'}
                    </button>
                  </div>
                </div>
                <div style={styles.itemMeta}>
                  Owner: {doc.owner} • Dept: {doc.department} • Chunks: {doc.chunk_count} • Size: {(doc.file_size / 1024).toFixed(1)} KB
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: '#8E8B82' }}>No documents indexed in vector database yet.</p>
        )}
      </div>

      {/* Audit Log */}
      <div className="glass-panel" style={{ ...styles.card, marginTop: '24px' }}>
        <h3 style={styles.cardTitle}>📜 Global Audit Stream</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {metrics.recent_activities.map((act, i) => (
              <tr key={i} style={styles.tr}>
                <td style={styles.td}>{new Date(act.timestamp).toLocaleTimeString()}</td>
                <td style={styles.td}>{act.username}</td>
                <td style={styles.td}>
                  <span style={act.type === 'upload' ? styles.uploadBadge : styles.chatBadge}>
                    {act.type === 'upload' ? 'Upload' : 'Query'}
                  </span>
                </td>
                <td style={styles.td}>
                  {act.type === 'upload' 
                    ? `Uploaded ${act.filename} to ${act.department}`
                    : `"${act.content}"`
                  }
                </td>
              </tr>
            ))}
            {metrics.recent_activities.length === 0 && (
              <tr>
                <td colSpan="4" style={{ ...styles.td, textAlign: 'center', padding: '20px' }}>No recent activity.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
