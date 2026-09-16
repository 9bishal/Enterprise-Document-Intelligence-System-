import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsIcon, LockIcon, BarChartIcon, ZapIcon, CpuIcon } from '../components/Icons';
import { TIER_LABELS } from '../utils/constants';

export default function SettingsPage({
  userRole
}) {
  const navigate = useNavigate();
  const isAdmin = userRole === 'Admin';

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <div className="header-content">
          <SettingsIcon style={{ width: 28, height: 28, color: '#030712' }} />
          <div>
            <h1>System Configuration</h1>
            <p className="subtitle">Configuration is managed by your administrator</p>
          </div>
        </div>
        <button onClick={() => navigate('/query')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><h1>Back to Workspace</h1></button>
      </div>

      <div className="settings-container">
        {!isAdmin && (
          <section className="settings-section" style={{ border: '1px solid rgba(20, 20, 19, 0.15)', borderRadius: '8px', padding: '24px', backgroundColor: 'rgba(100, 120, 160, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <LockIcon style={{ width: 20, height: 20, color: '#8E8B82' }} />
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#141413', fontSize: '15px', fontWeight: 600 }}>Managed by Administrator</h3>
                <p style={{ margin: '0', fontSize: '13px', color: '#8E8B82' }}>LLM provider, model, API keys, and all configuration settings are managed by your administrator. Contact your admin for any changes.</p>
              </div>
            </div>
          </section>
        )}

        {/* Tier Legend */}
        <section className="settings-section">
          <h2 className="section-title">Model Tiers</h2>
          <p className="section-description">
            Models are grouped by capability and cost to help you choose the right balance.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(TIER_LABELS).map(([key, t]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: t.bg, borderRadius: 8, border: '1px solid transparent' }}>
                <CpuIcon style={{ width: 14, height: 14, color: t.color }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: t.color }}>{t.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Information Section */}
        <section className="settings-section">
          <h2 className="section-title">Information & Help</h2>

          <div className="info-grid">
            <div className="info-card">
              <h4><LockIcon style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 6 }} /> Security & Privacy</h4>
              <p>Your API keys are stored locally in your browser. They are never sent to our servers and are only used for direct API calls to the providers.</p>
            </div>

            <div className="info-card">
              <h4><SettingsIcon style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 6 }} /> Configuration Impact</h4>
              <p>Model configuration affects how the system retrieves documents and generates responses. Adjust these settings based on your use case and provider capabilities.</p>
            </div>

            <div className="info-card">
              <h4><BarChartIcon style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 6 }} /> Provider Comparison</h4>
              <p>
                <strong>Groq:</strong> Fast, free, great for RAG. 
                <strong>Gemini:</strong> Advanced reasoning. 
                <strong>OpenAI:</strong> Most capable, paid.
              </p>
            </div>

            <div className="info-card">
              <h4><ZapIcon style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 6 }} /> Tips</h4>
              <p>Start with Groq for free tier. Adjust temperature based on use case. Use higher K for comprehensive retrieval.</p>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .settings-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }

        .settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .settings-header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #141413;
        }

        .subtitle {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #8b92a0;
        }

        .info-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(100, 120, 150, 0.1);
          border: 1px solid rgba(100, 120, 150, 0.3);
          border-radius: 8px;
          color: #6478A0;
          font-size: 13px;
        }

        .info-banner p {
          margin: 0;
        }

        .settings-container {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #141413;
        }

        .section-description {
          margin: 0;
          font-size: 14px;
          color: #8b92a0;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .settings-card {
          background: white;
          border: 1px solid rgba(20, 20, 19, 0.08);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .card-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #141413;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .badge.free {
          background: rgba(100, 150, 100, 0.2);
          color: #648F64;
        }

        .badge.paid {
          background: rgba(150, 120, 50, 0.2);
          color: #9A7832;
        }

        .provider-desc {
          margin: 0;
          font-size: 13px;
          color: #8b92a0;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          font-size: 12px;
          font-weight: 600;
          color: #141413;
        }

        .input-with-action {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .input-group input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid rgba(20, 20, 19, 0.15);
          border-radius: 6px;
          font-size: 13px;
          color: #141413;
          font-family: monospace;
        }

        .input-group input:disabled {
          background: rgba(20, 20, 19, 0.04);
          color: #8b92a0;
        }

        .action-btn {
          padding: 6px 10px;
          background: rgba(3, 7, 18, 0.06);
          border: 1px solid rgba(3, 7, 18, 0.15);
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          white-space: nowrap;
          color: #141413;
        }

        .action-btn:hover {
          background: rgba(3, 7, 18, 0.12);
        }

        .link {
          font-size: 11px;
          color: #6478A0;
          text-decoration: none;
          transition: color 0.2s;
        }

        .link:hover {
          color: #030712;
          text-decoration: underline;
        }

        .config-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .config-card {
          background: white;
          border: 1px solid rgba(20, 20, 19, 0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .config-label {
          font-size: 13px;
          font-weight: 600;
          color: #141413;
        }

        .config-select,
        .config-slider {
          padding: 8px 12px;
          border: 1px solid rgba(20, 20, 19, 0.15);
          border-radius: 6px;
          font-size: 13px;
          color: #141413;
          background: white;
        }

        .config-select:disabled,
        .config-slider:disabled {
          background: rgba(20, 20, 19, 0.04);
          color: #8b92a0;
          cursor: not-allowed;
        }

        .config-slider {
          height: 6px;
          padding: 0;
          cursor: pointer;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #8b92a0;
          margin: 0 2px;
        }

        .config-help {
          margin: 0;
          font-size: 11px;
          color: #8b92a0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .info-card {
          background: rgba(3, 7, 18, 0.03);
          border: 1px solid rgba(3, 7, 18, 0.08);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-card h4 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          color: #141413;
        }

        .info-card p {
          margin: 0;
          font-size: 12px;
          color: #8b92a0;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .settings-page {
            gap: 16px;
          }

          .settings-grid,
          .config-grid,
          .info-grid {
            grid-template-columns: 1fr;
          }

          .settings-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
