import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, PlusIcon, ChatIcon } from './Icons';

// A simple and robust Markdown & Citation Parser
function parseMarkdown(text, onCitationClick) {
  if (!text) return '';
  
  let formatted = text;
  
  // 1. Escaping basic HTML to prevent injection
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  // 2. Syntax code blocks ```code```
  formatted = formatted.replace(/```(.*?)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang.trim() || 'txt'}">${code.trim()}</code></pre>`;
  });
  
  // 3. Inline code `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 4. Bold text **text**
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 5. Headings: ### H3, ## H2, # H1
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // 6. Blockquotes > text
  formatted = formatted.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>');
  
  // 7. Bullet lists - text or * text
  formatted = formatted.replace(/^[-*] (.*?)$/gm, '<li>$1</li>');
  // Wrap li blocks in ul (simple approximation)
  formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  // De-duplicate nested uls if any
  formatted = formatted.replace(/<\/ul>\s*<ul>/g, '');
  
  // 8. Paragraphs (lines split by double newlines)
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  // Wrap whole thing in paragraphs if not starting with block tags
  if (!formatted.startsWith('<h') && !formatted.startsWith('<pre') && !formatted.startsWith('<ul')) {
    formatted = '<p>' + formatted + '</p>';
  }
  
  // 9. Citation tags [1], [2], [3]
  // We match [number] and replace with interactive citation chips
  formatted = formatted.replace(/\[([1-9])\]/g, (match, num) => {
    const idx = parseInt(num) - 1;
    return `<button class="citation-chip" data-index="${idx}">📄 [${num}]</button>`;
  });
  
  return formatted;
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
  onHighlightSource
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle auto-growing textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight - 8, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.strip && input.trim() === '') return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Intercept click events inside message bubbles to handle citation clicks
  const handleMessageBubbleClick = (e, msg) => {
    const citationBtn = e.target.closest('.citation-chip');
    if (citationBtn && msg.sources) {
      const idx = parseInt(citationBtn.getAttribute('data-index'), 10);
      if (msg.sources[idx]) {
        onHighlightSource(msg.sources[idx].id);
      }
    }
  };

  // Determine active session name
  const currentSession = sessions.find(s => s.id === activeSessionId);
  const sessionName = currentSession ? currentSession.name : 'New Assistant Chat';

  // Translate LangGraph step to friendly display message
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

  return (
    <main className="chat-area glass-panel">
      {/* Chat Header */}
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

      {/* Messages Stream */}
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
              
              {/* Citations block */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="msg-sources">
                  {/* Filter out audit documents for display */}
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
                                📄 [{index + 1}] {src.filename} {src.page ? `(Page ${src.page})` : ''} - {Math.round(src.similarity || 0)}%
                              </button>
                            ))}
                          </>
                        )}
                        {auditSources.length > 0 && (
                          <>
                            <div className="msg-source-title" style={{ marginTop: '12px', opacity: 0.7 }}>⚠️ Repository Status</div>
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

        {/* Loading / Thinking indicator */}
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

      {/* Input Area */}
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
