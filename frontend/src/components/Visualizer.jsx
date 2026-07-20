import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, GraphIcon, DatabaseIcon, FileIcon } from './Icons';

export default function Visualizer({
  steps,
  sources,
  highlightedSourceId,
  onClearHighlight
}) {
  const [activeTab, setActiveTab] = useState('graph');
  const sourceRefs = useRef({});
  
  // Provide defaults for props
  const safeSources = sources || [];
  const safeSteps = steps || [];

  // Auto-scroll to highlighted source and focus on it
  useEffect(() => {
    if (highlightedSourceId) {
      setActiveTab('sources');
      // Delay slightly to ensure tab has mounted
      setTimeout(() => {
        const element = sourceRefs.current[highlightedSourceId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Clear highlight after 3 seconds
          const timer = setTimeout(() => {
            onClearHighlight();
          }, 3000);
          return () => clearTimeout(timer);
        }
      }, 100);
    }
  }, [highlightedSourceId, onClearHighlight]);

  // Determine node states based on the executed steps array
  // Node states can be: 'inactive', 'active', 'completed'
  const getNodeState = (nodeId) => {
    if (safeSteps.length === 0) return 'inactive';

    const lastStep = safeSteps[safeSteps.length - 1];
    const hasStep = (stepName) => safeSteps.includes(stepName);

    if (nodeId === 'analyze') {
      // Query Analyzer runs first
      if (hasStep('retrieve')) return 'completed';
      return 'inactive';
    }

    if (nodeId === 'retrieve') {
      // Retrieval node
      if (hasStep('grade_documents') || hasStep('web_search') || hasStep('generate')) {
        return 'completed';
      }
      if (hasStep('retrieve')) return 'active';
      return 'inactive';
    }

    if (nodeId === 'grade_docs') {
      // Document Grading node
      if (hasStep('generate') || hasStep('web_search')) return 'completed';
      if (hasStep('grade_documents')) return 'active';
      return 'inactive';
    }

    if (nodeId === 'web_search') {
      // Web Search node (only shown if it was executed)
      if (!hasStep('web_search')) return 'inactive';
      if (hasStep('generate')) return 'completed';
      if (lastStep === 'web_search') return 'active';
      return 'inactive';
    }

    if (nodeId === 'generate') {
      // Generation node
      if (hasStep('generate')) {
        // If currently generating or if grading is next, it's completed
        if (hasStep('grade_generation')) return 'completed';
        if (lastStep === 'generate') return 'active';
        return 'completed';
      }
      return 'inactive';
    }

    if (nodeId === 'groundedness') {
      // Groundedness check node
      if (hasStep('grade_generation')) {
        if (lastStep === 'grade_generation') return 'active';
        return 'completed';
      }
      return 'inactive';
    }

    if (nodeId === 'corrective_feedback') {
      // Self-correction node (shown if critique loop occurred)
      if (hasStep('grade_generation_critique')) return 'completed';
      return 'inactive';
    }

    return 'inactive';
  };

  const getConnectorState = (fromNodeId) => {
    const state = getNodeState(fromNodeId);
    return state === 'completed' ? 'flow-active' : '';
  };

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
      </div>

      <div className="hub-content">
        {activeTab === 'graph' ? (
          <div className="graph-container">
            {/* 1. Query Analyzer */}
            <div className={`graph-node ${getNodeState('analyze')}`}>
              <div className="graph-node-icon">🔍</div>
              <div className="graph-node-details">
                <span className="graph-node-name">Query Analyzer</span>
                <span className="graph-node-status">
                  {getNodeState('analyze') === 'completed' ? 'Evaluated' : getNodeState('analyze') === 'active' ? 'Analyzing query...' : 'Pending'}
                </span>
              </div>
            </div>

            <div className={`graph-connector ${getConnectorState('analyze')}`} />

            {/* 2. Chroma Retriever */}
            <div className={`graph-node ${getNodeState('retrieve')}`}>
              <div className="graph-node-icon">📦</div>
              <div className="graph-node-details">
                <span className="graph-node-name">Vector Retriever (Chroma)</span>
                <span className="graph-node-status">
                  {getNodeState('retrieve') === 'completed' ? 'Indexed fetched' : getNodeState('retrieve') === 'active' ? 'Fetching vectors...' : 'Pending'}
                </span>
              </div>
            </div>

            <div className={`graph-connector ${getConnectorState('retrieve')}`} />

            {/* 3. Document Grader */}
            <div className={`graph-node ${getNodeState('grade_docs')}`}>
              <div className="graph-node-icon">⚖️</div>
              <div className="graph-node-details">
                <span className="graph-node-name">Document Grader</span>
                <span className="graph-node-status">
                  {getNodeState('grade_docs') === 'completed' ? 'Relevance scored' : getNodeState('grade_docs') === 'active' ? 'Scoring relevance...' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Web Search Node - Conditionally shown in flow or highlighted */}
            {steps.includes('web_search') && (
              <>
                <div className={`graph-connector ${getConnectorState('grade_docs')}`} />
                <div className={`graph-node ${getNodeState('web_search')}`}>
                  <div className="graph-node-icon">🌐</div>
                  <div className="graph-node-details">
                    <span className="graph-node-name">Web Search Fallback</span>
                    <span className="graph-node-status">
                      {getNodeState('web_search') === 'completed' ? 'Fetched web result' : getNodeState('web_search') === 'active' ? 'Searching web...' : 'Pending'}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className={`graph-connector ${steps.includes('web_search') ? getConnectorState('web_search') : getConnectorState('grade_docs')}`} />

            {/* 4. Response Generation */}
            <div className={`graph-node ${getNodeState('generate')}`}>
              <div className="graph-node-icon">✍️</div>
              <div className="graph-node-details">
                <span className="graph-node-name">Response Generator</span>
                <span className="graph-node-status">
                  {getNodeState('generate') === 'completed' ? 'Draft complete' : getNodeState('generate') === 'active' ? 'Synthesizing...' : 'Pending'}
                </span>
              </div>
            </div>

            <div className={`graph-connector ${getConnectorState('generate')}`} />

            {/* 5. Groundedness check */}
            <div className={`graph-node ${getNodeState('groundedness')}`}>
              <div className="graph-node-icon">✅</div>
              <div className="graph-node-details">
                <span className="graph-node-name">Groundedness Evaluator</span>
                <span className="graph-node-status">
                  {getNodeState('groundedness') === 'completed' ? 'Passed (100% Grounded)' : getNodeState('groundedness') === 'active' ? 'Auditing facts...' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Corrective feedback node - Shown if looped back */}
            {steps.includes('grade_generation_critique') && (
              <>
                <div className={`graph-connector flow-active`} />
                <div className={`graph-node corrective ${getNodeState('corrective_feedback')}`}>
                  <div className="graph-node-icon">♻️</div>
                  <div className="graph-node-details">
                    <span className="graph-node-name">Self-Correction Critique</span>
                    <span className="graph-node-status" style={{ color: 'var(--accent)' }}>
                      Re-routing generation
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="sources-list">
            {safeSources.map((src, index) => (
              <div 
                key={src.id}
                ref={(el) => sourceRefs.current[src.id] = el}
                className={`source-item ${highlightedSourceId === src.id ? 'highlighted' : ''}`}
              >
                <div className="source-item-header">
                  <span className="source-item-title" title={src.filename}>
                    📄 [{index + 1}] {src.filename}
                  </span>
                  <span className="source-item-badge">
                    {src.similarity}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Page {src.page}</span>
                  <span>•</span>
                  <span>Chunk {src.chunk_index + 1}</span>
                </div>
                <p className="source-item-text">{src.text}</p>
              </div>
            ))}
            {safeSources.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No active RAG query sources to inspect.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
