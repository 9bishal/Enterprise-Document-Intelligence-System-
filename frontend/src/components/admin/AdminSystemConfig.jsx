import React from 'react';
import styles from './AdminStyles';
import { SettingsIcon, CpuIcon } from '../Icons';
import { PROVIDER_MODELS, TIER_LABELS } from '../../utils/constants';

export default function AdminSystemConfig({ 
  llmConfig, 
  setLlmConfig, 
  handleSaveLlmConfig, 
  savingLlm 
}) {
  const providerModels = PROVIDER_MODELS;

  if (!llmConfig) return <div style={styles.loading}>Loading system configuration...</div>;

  return (
    <div className="admin-scrollable">
      <div className="glass-panel" style={styles.card}>
        <h3 style={styles.cardTitle}><SettingsIcon style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 6 }} /> Global LLM Configuration</h3>
        <p style={{ fontSize: '13px', color: '#8E8B82', marginBottom: '20px' }}>
          Manage model providers, API keys, and model choices globally.
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', backgroundColor: 'rgba(224, 94, 63, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(224, 94, 63, 0.2)' }}>
          <input 
            type="checkbox" 
            id="enforceGlobal"
            checked={llmConfig.enforce_globally}
            onChange={(e) => setLlmConfig({...llmConfig, enforce_globally: e.target.checked})}
            style={{ marginRight: '12px', width: '20px', height: '20px', accentColor: '#E05E3F', cursor: 'pointer' }}
          />
          <label htmlFor="enforceGlobal" style={{ fontSize: '14px', fontWeight: '600', color: '#141413', cursor: 'pointer', margin: 0 }}>
            Enforce settings globally (Overrides user preferences)
          </label>
        </div>
        
        <div style={styles.twoColumnGrid}>
          {/* Model Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#5C5A55', margin: '0 0 8px 0' }}>Model Preferences</h4>
            
            <div>
              <label style={styles.label}>Provider</label>
              <select 
                value={llmConfig.config.provider}
                onChange={e => {
                  const nextProvider = e.target.value;
                  const defaultModel = providerModels[nextProvider]?.[0]?.id || '';
                  setLlmConfig({
                    ...llmConfig, 
                    config: {
                      ...llmConfig.config, 
                      provider: nextProvider,
                      model: defaultModel
                    }
                  });
                }}
                style={styles.input}
              >
                <option value="groq">Groq (Recommended)</option>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            
            <div>
              <label style={styles.label}>Model Choice</label>
              <select 
                value={llmConfig.config.model}
                onChange={e => setLlmConfig({...llmConfig, config: {...llmConfig.config, model: e.target.value}})}
                style={styles.input}
              >
                {providerModels[llmConfig.config.provider]?.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({TIER_LABELS[m.tier]?.label || 'Standard'})</option>
                ))}
              </select>
            </div>

            {/* Tier legend */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {Object.entries(TIER_LABELS).map(([key, t]) => (
                <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: t.bg, borderRadius: 4, fontSize: 11, fontWeight: 600, color: t.color }}>
                  <CpuIcon style={{ width: 10, height: 10 }} /> {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* API Keys */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#5C5A55', margin: '0 0 8px 0' }}>API Keys</h4>
            
            {llmConfig.config.provider === 'groq' && (
              <div>
                <label style={styles.label}>Groq API Key</label>
                <input 
                  type="password" 
                  value={llmConfig.api_keys.groq || ''}
                  onChange={e => setLlmConfig({...llmConfig, api_keys: {...llmConfig.api_keys, groq: e.target.value}})}
                  style={styles.input}
                  placeholder="gsk_..."
                />
              </div>
            )}

            {llmConfig.config.provider === 'gemini' && (
              <div>
                <label style={styles.label}>Gemini API Key</label>
                <input 
                  type="password" 
                  value={llmConfig.api_keys.gemini || ''}
                  onChange={e => setLlmConfig({...llmConfig, api_keys: {...llmConfig.api_keys, gemini: e.target.value}})}
                  style={styles.input}
                  placeholder="AIza..."
                />
              </div>
            )}

            {llmConfig.config.provider === 'openai' && (
              <div>
                <label style={styles.label}>OpenAI API Key</label>
                <input 
                  type="password" 
                  value={llmConfig.api_keys.openai || ''}
                  onChange={e => setLlmConfig({...llmConfig, api_keys: {...llmConfig.api_keys, openai: e.target.value}})}
                  style={styles.input}
                  placeholder="sk-..."
                />
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="action-btn primary" 
            onClick={handleSaveLlmConfig} 
            disabled={savingLlm}
            style={{ padding: '12px 24px', fontSize: '14px', color: '#FFFFFF', background: '#243252', border: '1px solid #243252', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            {savingLlm ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
