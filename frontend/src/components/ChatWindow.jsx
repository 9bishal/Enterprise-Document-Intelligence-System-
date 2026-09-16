import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, PlusIcon, ChatIcon, FileIcon, AlertTriangleIcon, ZapIcon, DollarIcon, ClockIcon, CpuIcon, CacheIcon, LayersIcon } from './Icons';

function parseMarkdown(text, onCitationClick) {
  if (!text) return '';
  
  let formatted = text;
  
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  formatted = formatted.replace(/```(.*?)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang.trim() || 'txt'}">${code.trim()}</code></pre>`;
  });
  
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  formatted = formatted.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>');
  
  formatted = formatted.replace(/^[-*] (.*?)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  formatted = formatted.replace(/<\/ul>\s*<ul>/g, '');
  
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  if (!formatted.startsWith('<h') && !formatted.startsWith('<pre') && !formatted.startsWith('<ul')) {
    formatted = '<p>' + formatted + '</p>';
  }
  
  formatted = formatted.replace(/\[([1-9])\]/g, (match, num) => {
    const idx = parseInt(num) - 1;
    return `<button class="citation-chip" data-index="${idx}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;vertical-align:middle"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>[${num}]</button>`;
  });
  
  return formatted;
}

function costBadgeHTML(msg) {
  if (msg.role !== 'assistant' || !msg.estimated_cost_usd) return '';
  const cost = parseFloat(msg.estimated_cost_usd).toFixed(6);
  const model = msg.model_used || '—';
  const latency = msg.latency_ms || '—';
  const cacheHit = msg.cache_hit ? 'Yes' : 'No';
  return `<div class="msg-cost-badge"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> $${cost} &nbsp;|&nbsp; <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${latency}ms &nbsp;|&nbsp; <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg> Cache: ${cacheHit} &nbsp;|&nbsp; <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg> ${model}</div>`;
}

export default function ChatWindow({
  messages,
  activeSessionId,
  sessions,
  onSendMessage,
  onCreateSession,
  activeStep,
  loading,
  modelConfig,
  onHighlightSource,
  onCostData
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight - 8, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMessageBubbleClick = (e, msg) => {
    const citationBtn = e.target.closest('.citation-chip');
    if (citationBtn && msg.sources) {
      const idx = parseInt(citationBtn.getAttribute('data-index'), 10);
      if (msg.sources[idx]) {
        onHighlightSource(msg.sources[idx].id);
      }
    }
  };

  const currentSession = sessions.find(s => s.id === activeSessionId);
  const sessionName = currentSession ? currentSession.name : 'New Assistant Chat';

  const getStepDescription = (step) => {
    switch (step) {
      case 'retrieve':
        return 'Querying local vector store for relevant chunks...';
      case 'grade_documents':
        return 'Analyzing and filtering document chunks for relevance...';
      case 'web_search':
        return 'Fallback initiated. Querying web search...';
      case 'generate':
        return 'Synthesizing grounded facts and generating answer...';
      case 'grade_generation_critique':
        return 'Self-correction loop triggered. Revising response for 100% groundedness...';
      default:
        return 'Agent state engine active...';
    }
  };

  const lastAssistantMsg = messages.filter(m => m.role === 'assistant' && m.estimated_cost_usd).slice(-1)[0];

  return (
    <main className="chat-area glass-panel">
      <div className="chat-header">
        <div className="session-info">
          <span className="session-title">{sessionName}</span>
          <div className="session-subtitle">
            <span /> Active model: <strong style={{ color: 'var(--primary)', marginLeft: 4 }}>{(modelConfig?.provider || 'groq').toUpperCase()} ({modelConfig?.model || 'default'})</strong>
          </div>
        </div>
        
        <div className="chat-actions">
          <button className="action-btn" onClick={onCreateSession}>
            <PlusIcon /> New Thread
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((msg) => (
          <div className={`message-wrapper ${msg.role}`} key={msg.id}>
            <div className="msg-avatar">
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            
            <div className="msg-bubble-container" style={{ display: 'flex', flexDirection: 'column' }}>
              <div 
                className="msg-bubble"
                onClick={(e) => handleMessageBubbleClick(e, msg)}
                dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
              />
              
              {msg.role === 'assistant' && msg.estimated_cost_usd && (
                <div
                  className="msg-cost-badge"
                  dangerouslySetInnerHTML={{ __html: costBadgeHTML(msg) }}
                />
              )}
              
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="msg-sources">
                  {(() => {
                    const realSources = msg.sources.filter(src => src.filename !== 'Repository Status Audit');
                    const auditSources = msg.sources.filter(src => src.filename === 'Repository Status Audit');
                    
                    return (
                      <>
                        {realSources.length > 0 && (
                          <>
                            <div className="msg-source-title">Document Sources ({realSources.length})</div>
                            {realSources.map((src, index) => (
                              <button 
                                key={src.id}
                                className="citation-chip" 
                                onClick={() => onHighlightSource(src.id)}
                                title={`Similarity: ${src.similarity || 0}%`}
                              >
                                <FileIcon style={{ width: 12, height: 12, marginRight: 4, verticalAlign: 'middle' }} />
                                [{index + 1}] {src.filename} {src.page ? `(Page ${src.page})` : ''} - {Math.round(src.similarity || 0)}%
                              </button>
                            ))}
                          </>
                        )}
                        {auditSources.length > 0 && (
                          <>
                            <div className="msg-source-title" style={{ marginTop: '12px', opacity: 0.7 }}>
                              <AlertTriangleIcon style={{ width: 12, height: 12, marginRight: 4, verticalAlign: 'middle', color: 'var(--accent)' }} />
                              Repository Status
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px', backgroundColor: 'rgba(255, 165, 0, 0.1)', borderRadius: '4px' }}>
                              Limited matches found in indexed documents. Consider uploading additional documents for better results.
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        ))}

        {messages.length === 0 && !loading && (
          <div className="empty-chat">
            <div className="empty-logo">
              <ChatIcon style={{ width: 32, height: 32 }} />
            </div>
            <h2 className="empty-title">Intradoc AI</h2>
            <p className="empty-desc">
              Upload documents in the sidebar on the left, then ask questions. 
              The stateful LangGraph agent will query the database, filter for factual relevance, check for hallucinations, and deliver a grounded answer with citations.
            </p>
          </div>
        )}

        {loading && (
          <div className="message-wrapper assistant">
            <div className="msg-avatar">AI</div>
            <div className="msg-bubble-container" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="msg-bubble" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="spinner" />
                <span style={{ color: 'var(--text-secondary)' }}>Analyzing request...</span>
              </div>
              
              {activeStep && (
                <div className="thinking-banner">
                  <div className="spinner" />
                  <span>{getStepDescription(activeStep)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Ask a question about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button 
            className="input-action-btn send" 
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </main>
  );
}
