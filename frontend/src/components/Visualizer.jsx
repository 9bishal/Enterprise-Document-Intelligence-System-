import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, GraphIcon, DatabaseIcon, FileIcon, SearchIcon, ZapIcon, DollarIcon, ClockIcon, CpuIcon, CheckCircleIcon, CacheIcon, LayersIcon, GlobeIcon, AlertTriangleIcon } from './Icons';

const STEP_LABELS = {
  'semantic_cache_hit': { icon: CacheIcon, name: 'Semantic Cache', status: 'Cached response returned' },
  'greeting': { icon: ZapIcon, name: 'Greeting Guard', status: 'Instant reply, no LLM call' },
  'meta_query': { icon: DatabaseIcon, name: 'Document Index', status: 'Index listed, no LLM call' },
  'retrieve': { icon: DatabaseIcon, name: 'Vector Retriever (Chroma)', status: 'Indexed fetched' },
  'grade_documents': { icon: ZapIcon, name: 'Document Grader', status: 'Relevance scored' },
  'web_search': { icon: GlobeIcon, name: 'Web Search Fallback', status: 'Fetched web result' },
  'generate': { icon: SparklesIcon, name: 'Response Generator', status: 'Draft complete' },
  'grade_generation': { icon: CheckCircleIcon, name: 'Groundedness Evaluator', status: 'Facts verified' },
  'grade_generation_critique': { icon: AlertTriangleIcon, name: 'Self-Correction Critique', status: 'Re-routing generation' },
};
const STEP_ORDER = ['semantic_cache_hit', 'greeting', 'meta_query', 'retrieve', 'grade_documents', 'web_search', 'generate', 'grade_generation', 'grade_generation_critique'];

export default function Visualizer({
  steps,
  sources,
  highlightedSourceId,
  onClearHighlight,
  messageCost,
  messageModel,
  messageTokens,
  messageLatency,
  messageCacheHit,
  messageEvaluation,
  isRunning = true,
}) {
  const [activeTab, setActiveTab] = useState('graph');
  const sourceRefs = useRef({});

  const safeSources = sources || [];
  const safeSteps = steps || [];
  const isCacheHit = messageCacheHit === true || safeSteps[0] === 'semantic_cache_hit';

  useEffect(() => {
    if (highlightedSourceId) {
      setActiveTab('sources');
      setTimeout(() => {
        const element = sourceRefs.current[highlightedSourceId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const timer = setTimeout(() => {
            onClearHighlight();
          }, 3000);
          return () => clearTimeout(timer);
        }
      }, 100);
    }
  }, [highlightedSourceId, onClearHighlight]);

  const getNodeState = (stepId) => {
    if (isCacheHit && stepId === 'semantic_cache_hit') return 'active';
    if (isCacheHit) return 'inactive';
    if (safeSteps.length === 0) return 'inactive';
    const stepIndex = STEP_ORDER.indexOf(stepId);
    if (stepIndex === -1) return 'inactive';
    const maxCompletedStepIdx = Math.max(...safeSteps.map(s => STEP_ORDER.indexOf(s)).filter(i => i >= 0), -1);
    if (stepIndex < maxCompletedStepIdx) return 'completed';
    // The last reached stage only shows "Running..." while the request is
    // actually in flight; once done it flips to completed.
    if (stepIndex === maxCompletedStepIdx) return isRunning ? 'active' : 'completed';
    return 'inactive';
  };

  const getConnectorState = (stepId) => {
    return getNodeState(stepId) === 'completed' ? 'flow-active' : '';
  };

  const graphNodes = isCacheHit ? (
    <div className={`graph-node active`} style={{ borderColor: 'var(--success)', background: '#FFFFFF' }}>
      <div className="graph-node-icon" style={{ background: 'var(--success)', color: '#fff', borderColor: 'var(--success)' }}>
        <CacheIcon />
      </div>
      <div className="graph-node-details">
        <span className="graph-node-name">Semantic Cache Hit</span>
        <span className="graph-node-status" style={{ color: 'var(--success)', fontWeight: 500 }}>
          Response served from cache (no LLM call)
        </span>
      </div>
    </div>
  ) : (
    <>
      {safeSteps.length === 0 ? (
        <div className="graph-node inactive">
          <div className="graph-node-icon"><SearchIcon /></div>
          <div className="graph-node-details">
            <span className="graph-node-name">Query Analyzer</span>
            <span className="graph-node-status">Pending</span>
          </div>
        </div>
      ) : (
        STEP_ORDER.filter(s => s !== 'semantic_cache_hit').map((stepId, idx) => {
          if (!safeSteps.includes(stepId)) return null;
          const info = STEP_LABELS[stepId];
          const state = getNodeState(stepId);
          return (
            <React.Fragment key={stepId}>
              {idx > 0 && <div className={`graph-connector ${getConnectorState(stepId)}`} />}
              <div className={`graph-node ${state}`}>
                <div className="graph-node-icon">{info ? React.createElement(info.icon) : <ZapIcon />}</div>
                <div className="graph-node-details">
                  <span className="graph-node-name">{info?.name || stepId}</span>
                  <span className="graph-node-status">
                    {state === 'completed' ? (info?.status || 'Done') : state === 'active' ? 'Running...' : 'Pending'}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })
      )}
    </>
  );

  const costData = messageCost !== undefined ? [
    { label: 'Model', value: messageModel || '—', icon: CpuIcon },
    { label: 'Input Tokens', value: messageTokens?.input ?? '—', icon: LayersIcon },
    { label: 'Output Tokens', value: messageTokens?.output ?? '—', icon: LayersIcon },
    { label: 'Est. Cost', value: `$${messageCost}`, icon: DollarIcon },
    { label: 'Latency', value: messageLatency ? `${messageLatency}ms` : '—', icon: ClockIcon },
    { label: 'Cache Hit', value: isCacheHit ? 'Yes' : 'No', icon: CacheIcon },
  ] : null;

  const evalData = messageEvaluation || null;

  return (
    <div className="analysis-hub glass-panel">
      <div className="hub-tabs">
        <button
          className={`hub-tab ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <GraphIcon /> RAG Flow Graph
          </span>
        </button>
        <button
          className={`hub-tab ${activeTab === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <DatabaseIcon /> Retrieved Sources
          </span>
        </button>
        <button
          className={`hub-tab ${activeTab === 'cost' ? 'active' : ''}`}
          onClick={() => setActiveTab('cost')}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <DollarIcon /> Cache & Cost
          </span>
        </button>
      </div>

      <div className="hub-content">
        {activeTab === 'graph' ? (
          <div className="graph-container">
            {graphNodes}
          </div>
        ) : activeTab === 'sources' ? (
          <div className="sources-list">
            {isCacheHit ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <CacheIcon style={{ width: 28, height: 28, marginBottom: 12, opacity: 0.4, color: '#111111' }} />
                <p style={{ fontWeight: 600, color: '#111111', marginBottom: 4 }}>Response served from semantic cache</p>
                <p style={{ fontSize: '11px' }}>No retrieval performed — identical or semantically similar question was answered before.</p>
              </div>
            ) : safeSources.length > 0 ? (
              safeSources.map((src, index) => (
                <div
                  key={src.id}
                  ref={(el) => sourceRefs.current[src.id] = el}
                  className={`source-item ${highlightedSourceId === src.id ? 'highlighted' : ''}`}
                >
                  <div className="source-item-header">
                    <span className="source-item-title" title={src.filename}>
                      <FileIcon style={{ width: 14, height: 14, marginRight: 6, flexShrink: 0, color: 'var(--primary)' }} />
                      [{index + 1}] {src.filename || 'Unknown'}
                    </span>
                    {src.similarity !== undefined && (
                      <span className="source-item-badge">
                        {src.similarity}%
                      </span>
                    )}
                  </div>
                  {(src.page !== undefined || src.chunk_index !== undefined) && (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: '11px', color: 'var(--text-muted)' }}>
                      {src.page !== undefined && <span>Page {src.page}</span>}
                      {src.page !== undefined && src.chunk_index !== undefined && <span>•</span>}
                      {src.chunk_index !== undefined && <span>Chunk {(src.chunk_index || 0) + 1}</span>}
                    </div>
                  )}
                  {src.text && <p className="source-item-text">{src.text}</p>}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No active RAG query sources to inspect.
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '16px' }}>
            {costData ? (
              <>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarIcon /> Request Cost Breakdown
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {costData.map((item, i) => {
                    const Icon = item.icon;
                    const isCacheRow = item.label === 'Cache Hit';
                    const isCostRow = item.label === 'Est. Cost';
                    return (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: isCacheRow && isCacheHit ? 'rgba(17, 17, 17, 0.08)' : isCacheRow && !isCacheHit ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.04)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}>
                        <Icon style={{ width: 14, height: 14, color: isCacheRow && isCacheHit ? '#111111' : 'var(--primary)', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 500 }}>{item.label}</span>
                          <span style={{ fontWeight: 600, color: isCacheRow && isCacheHit ? '#111111' : isCostRow && Number(messageCost) === 0 ? '#111111' : 'var(--text-primary)' }}>{item.value}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isCacheHit && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(17, 17, 17, 0.06)', border: '1px solid rgba(0, 0, 0, 0.15)', borderRadius: 10, fontSize: '12px', color: '#111111' }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>Cache Savings</strong>
                    This response was served from the semantic cache — no LLM inference cost, no retrieval latency. Estimated savings: <strong>${messageCost > 0 ? messageCost.toFixed(6) : '0.000254'}</strong> per query.
                  </div>
                )}

                {messageModel === 'error' && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.15)', borderRadius: 10, fontSize: '12px', color: '#dc2626' }}>
                    <strong>Pipeline Error</strong><br />
                    The RAG pipeline encountered an error. Check that your API key is valid and the backend server is running.
                  </div>
                )}

                {evalData && (
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Evaluation Metrics</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {evalData.relevance_score !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(0, 0, 0, 0.03)', borderRadius: '6px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Relevance</span>
                          <span style={{ fontWeight: 600 }}>{evalData.relevance_score.toFixed(1)}/10</span>
                        </div>
                      )}
                      {evalData.groundedness_score !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(0, 0, 0, 0.03)', borderRadius: '6px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Groundedness</span>
                          <span style={{ fontWeight: 600 }}>{evalData.groundedness_score.toFixed(1)}/10</span>
                        </div>
                      )}
                      {evalData.overall_score !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(0, 0, 0, 0.03)', borderRadius: '6px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Overall</span>
                          <span style={{ fontWeight: 600, color: evalData.overall_score >= 7 ? '#15803d' : '#dc2626' }}>{evalData.overall_score.toFixed(1)}/10</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <CacheIcon style={{ width: 24, height: 24, marginBottom: 12, opacity: 0.4 }} />
                <p>No request metrics available yet.</p>
                <p style={{ fontSize: '11px' }}>Run a RAG query to see cost and cache details.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
