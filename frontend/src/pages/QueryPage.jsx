import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import Visualizer from '../components/Visualizer';
import { GlobeIcon, UsersIcon, DollarIcon, WrenchIcon, FileIcon, UserIcon, EditIcon, TrashIcon, PlusIcon, ChatIcon, FolderIcon, CheckIcon, XIcon, MoreVerticalIcon } from '../components/Icons';
import { safeLocalStorage } from '../utils/constants';
import { useDepartments } from '../utils/useDepartments';
const storage = safeLocalStorage();

export default function QueryPage({
  API_BASE,
  apiKeys,
  modelConfig,
  isGlobalConfigEnforced,
  currentUser,
  userRole,
  userDepartment
}) {
  // --- UI Layout State ---
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [highlightedSourceId, setHighlightedSourceId] = useState(null);

  // --- Data State ---
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);

  // Every chat thread has its own URL (/query/:sessionId) so threads are
  // deep-linkable and browser back/forward moves between threads.
  const { sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();

  // Keep the active session in sync with the URL.
  useEffect(() => {
    if (routeSessionId && routeSessionId !== activeSessionId) {
      setActiveSessionId(routeSessionId);
    } else if (!routeSessionId && activeSessionId) {
      setActiveSessionId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSessionId]);

  // --- Loading / Processing State ---
  const [chatLoading, setChatLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [executionSteps, setExecutionSteps] = useState([]);
  const [adminActiveDepartment, setAdminActiveDepartment] = useState('All Departments');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  const lastAssistantMsg = useMemo(() => messages.filter(m => m.role === 'assistant').slice(-1)[0], [messages]);
  const token = storage.getItem('intradoc_token');
  const departments = useDepartments(true);

  // --- Fetch sessions once mounted ---
  useEffect(() => {
    fetchSessions();
  }, [adminActiveDepartment]);

  // --- Fetch messages whenever active session changes ---
  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId);
    } else {
      setMessages([]);
      setExecutionSteps([]);
    }
  }, [activeSessionId]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (routeSessionId) {
          // Deep link: honour the URL session (validated below by fetchMessages).
          setActiveSessionId(routeSessionId);
        } else if (data.length > 0 && !activeSessionId) {
          navigate(`/query/${data[0].id}`, { replace: true });
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const fetchMessages = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        // Populate visualizer with steps from latest assistant message
        const assistantMsgs = data.filter(m => m.role === 'assistant');
        if (assistantMsgs.length > 0) {
          const lastMsg = assistantMsgs[assistantMsgs.length - 1];
          setExecutionSteps(lastMsg.steps || []);
        } else {
          setExecutionSteps([]);
        }
      } else {
        // Unknown/deleted thread id in the URL — fall back to thread list.
        navigate('/query', { replace: true });
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleCreateSession = async () => {
    const defaultName = `Thread ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const name = prompt('Enter a name for this chat thread:', defaultName);
    if (name === null) return;

    try {
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessions(prev => [data, ...prev]);
        navigate(`/query/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSendMessage = async (text) => {
    let currentSessionId = activeSessionId;

    // Automatically create a new session if none exists
    if (!currentSessionId) {
      try {
        const defaultName = `Thread ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const res = await fetch(`${API_BASE}/chat/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: defaultName }),
        });
        if (res.ok) {
          const data = await res.json();
          setSessions([data]);
          currentSessionId = data.id;
          navigate(`/query/${data.id}`, { replace: true });
        } else {
          alert('Failed to start chat session.');
          return;
        }
      } catch (err) {
        console.error('Session create failed:', err);
        return;
      }
    }

    setChatLoading(true);
    setExecutionSteps([]);
    setActiveStep(null);

    const localUserMsg = {
      id: Math.random().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, localUserMsg]);

    const payload = {
      session_id: currentSessionId,
      question: text,
      api_keys: apiKeys,
      config: modelConfig,
      department: userRole === 'Admin' ? adminActiveDepartment : userDepartment
    };

    // 1. Try streaming first: points render as they arrive (fast perceived
    // latency). Any stream failure falls through to the classic request.
    let pacerTimer = null;
    try {
      const streamId = Math.random().toString();
      let streamedAny = false;
      setMessages(prev => [...prev, {
        id: streamId, role: 'assistant', content: '',
        created_at: new Date().toISOString(), steps: ['retrieve'],
        sources: [], streaming: true,
      }]);
      setExecutionSteps(['retrieve']);
      // Paced renderer: Groq often bursts a whole short answer in ~100ms,
      // which would paint all at once. Buffer deltas and reveal ~1000
      // chars/sec so streaming is actually visible. Content is real —
      // only the pacing is cosmetic.
      let pending = '';
      const PACER_MS = 24;
      const PACER_CHARS = 24;
      pacerTimer = setInterval(() => {        if (pending) {
          const slice = pending.slice(0, PACER_CHARS);
          pending = pending.slice(PACER_CHARS);
          streamedAny = true;
          setMessages(prev => prev.map(m => m.id === streamId ? { ...m, content: (m.content || '') + slice } : m));
        }
      }, PACER_MS);
      const done = await (async () => {
        const res = await fetch(`${API_BASE}/chat/query/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload),
        });
        const ctype = res.headers.get('content-type') || '';
        if (!res.ok || !ctype.includes('text/event-stream')) throw new Error('stream-unavailable');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = ''; let curEvent = '';
        const out = { sources: [], steps: ['retrieve', 'generate'], model_used: '', latency_ms: 0, success: true, id: null, cache_hit: false, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 };
        const dispatch = (raw) => {
          let data = '';
          for (const ln of raw.split('\n')) {
            if (ln.startsWith('event:')) curEvent = ln.slice(6).trim();
            else if (ln.startsWith('data:')) data += ln.slice(5).trim();
          }
          if (!data) return;
          let p = {}; try { p = JSON.parse(data); } catch { return; }
          if (curEvent === 'token' && p.delta) {
            pending += p.delta;
          } else if (curEvent === 'citations') {
            out.sources = p.citations || [];
            setMessages(prev => prev.map(m => m.id === streamId ? { ...m, sources: out.sources, steps: ['retrieve', 'grade_documents', 'generate'] } : m));
            setExecutionSteps(['retrieve', 'grade_documents', 'generate']);
          } else if (curEvent === 'done') Object.assign(out, p);
        };
        for (;;) {
          const { done: rd, value } = await reader.read();
          if (rd) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) { dispatch(buf.slice(0, idx)); buf = buf.slice(idx + 2); }
        }
        if (buf.trim()) dispatch(buf);
        return out;
      })();
      // Let the pacer finish revealing buffered tokens before finalizing,
      // so nothing is cut off and the stream-out reads naturally.
      const drainStart = Date.now();
      while (pending && Date.now() - drainStart < 15000) {
        await new Promise(r => setTimeout(r, PACER_MS));
      }
      clearInterval(pacerTimer);
      setMessages(prev => prev.map(m => m.id === streamId ? {
        ...m, streaming: false, id: done.id || streamId,
        sources: done.sources || m.sources, steps: done.steps || m.steps,
        model_used: done.model_used, latency_ms: done.latency_ms,
        cache_hit: done.cache_hit || false,
        input_tokens: done.input_tokens || 0, output_tokens: done.output_tokens || 0,
        estimated_cost_usd: done.estimated_cost_usd || 0,
      } : m));
      setExecutionSteps(done.steps || ['retrieve', 'generate']);
      if (streamedAny) { setChatLoading(false); setActiveStep(null); return; }
      // Stream connected but yielded nothing: fall through to classic request.
      setMessages(prev => prev.filter(m => m.id !== streamId));
    } catch (streamErr) {
      if (pacerTimer) clearInterval(pacerTimer);
      // Remove any placeholder, then use the classic non-streaming request.
      setMessages(prev => prev.filter(m => !m.streaming));
    }

    try {
      const res = await fetch(`${API_BASE}/chat/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const reply = await res.json();
        const actualSteps = reply.steps || [];

        // Display actual steps progressively as they are received
        // Show each step with a staggered animation
        setExecutionSteps([]);
        actualSteps.forEach((step, index) => {
          setTimeout(() => {
            setExecutionSteps(prev => [...prev, step]);
          }, index * 250);
        });

        const assistantMsg = {
          id: reply.id || Math.random().toString(),
          role: 'assistant',
          content: reply.content || 'Response received',
          created_at: new Date().toISOString(),
          steps: actualSteps,
          sources: reply.sources || [],
          model_used: reply.model_used,
          input_tokens: reply.input_tokens,
          output_tokens: reply.output_tokens,
          estimated_cost_usd: reply.estimated_cost_usd,
          latency_ms: reply.latency_ms,
          cache_hit: reply.cache_hit,
          evaluation: reply.evaluation
        };

        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errorData = await res.json();
        const errorMsg = {
          id: Math.random().toString(),
          role: 'assistant',
          content: `Error: ${errorData.detail || 'Failed to process query'}`,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err) {
      console.error('Query failed:', err);
      const errorMsg = {
        id: Math.random().toString(),
        role: 'assistant',
        content: `Connection Error: ${err.message}`,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
      setActiveStep(null);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Delete this chat thread?')) return;

    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          const remaining = sessions.filter(s => s.id !== sessionId);
          navigate(remaining.length > 0 ? `/query/${remaining[0].id}` : '/query', { replace: true });
        }
        setOpenMenuId(null);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleEditSessionStart = (sessionId, currentName) => {
    setEditingSessionId(sessionId);
    setEditingSessionName(currentName);
    setOpenMenuId(null);
  };

  const handleEditSessionSave = async (sessionId) => {
    if (!editingSessionName.trim()) {
      alert('Session name cannot be empty');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editingSessionName })
      });

      if (res.ok) {
        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, name: editingSessionName } : s
        ));
      }
      setEditingSessionId(null);
      setEditingSessionName('');
    } catch (err) {
      console.error('Failed to update session:', err);
    }
  };

  const handleEditSessionCancel = () => {
    setEditingSessionId(null);
    setEditingSessionName('');
  };



  return (
    <div className="query-page">
      {/* Left Sidebar */}
      <aside className="chat-sidebar">
        {/* Header with Logo */}
        <div className="sidebar-header">
          <h2><ChatIcon style={{ width: 18, height: 18, verticalAlign: 'middle', marginRight: 6 }} /> Intradoc Chat</h2>
        </div>

        {/* New Chat Button */}
        <button 
          className="new-chat-btn"
          onClick={handleCreateSession}
        >
<PlusIcon style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6 }} /> New Chat
        </button>

        {/* Department Filter - Only visible to Admins */}
        {userRole === 'Admin' && (
          <div className="department-section">
            <label className="dept-label">Query Department</label>
            <select
              value={adminActiveDepartment}
              onChange={(e) => setAdminActiveDepartment(e.target.value)}
              className="dept-select"
            >
              <option value="All Departments"><GlobeIcon style={{ width: 12, height: 12, verticalAlign: 'middle', marginRight: 4 }} /> All Departments</option>
              {departments.filter(d => d !== 'All Departments').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <p className="dept-help">
              Select which department's documents to query from
            </p>
          </div>
        )}
        {userRole !== 'Admin' && (
          <div className="department-section">
            <label className="dept-label">Your Department</label>
            <div className="dept-display">
              <span>{userDepartment}</span>
            </div>
            <p className="dept-help">
              You can only query documents from your assigned department
            </p>
          </div>
        )}

        {/* Chat History */}
        <div className="chat-history-section">
          <h3 className="history-title">Chat History</h3>
          <div className="chat-history-list">
            {sessions.length === 0 ? (
              <p className="empty-history">No chat sessions yet</p>
            ) : (
              sessions.map(session => (
                <div
                  key={session.id}
                  className={`chat-history-item ${activeSessionId === session.id ? 'active' : ''}`}
                  onClick={() => navigate(`/query/${session.id}`)}
                >
                  {editingSessionId === session.id ? (
                    <div className="edit-session-form">
                      <input
                        type="text"
                        value={editingSessionName}
                        onChange={(e) => setEditingSessionName(e.target.value)}
                        placeholder="Enter chat name"
                        className="edit-session-input"
                        autoFocus
                      />
                      <button
                        className="edit-btn-save"
                        onClick={() => handleEditSessionSave(session.id)}
                        title="Save"
                      >
                        <CheckIcon style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        className="edit-btn-cancel"
                        onClick={handleEditSessionCancel}
                        title="Cancel"
                      >
                        <XIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="history-item-content"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/query/${session.id}`);
                        }}
                      >
                        <span className="history-item-name" title={session.name}>
                          {session.name}
                        </span>
                        <span className="history-item-time">
                          {new Date(session.created_at).toLocaleDateString([], { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="history-item-menu-container">
                        <button
                          className="history-item-menu-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === session.id ? null : session.id);
                          }}
                          title="More options"
                        >
                          <MoreVerticalIcon style={{ width: 16, height: 16 }} />
                        </button>
                        {openMenuId === session.id && (
                          <div className="history-item-dropdown">
                            <button
                              className="dropdown-item edit-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditSessionStart(session.id, session.name);
                              }}
                            >
<EditIcon style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6 }} /> Rename
                            </button>
                            <button
                              className="dropdown-item delete-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                              }}
                            >
<TrashIcon style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6 }} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <p className="sidebar-user"><UserIcon style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6 }} /> {currentUser}</p>
          <p className="sidebar-dept">Dept: {userDepartment}</p>
        </div>
      </aside>

      <div className="query-container">
        {/* Chat Window */}
        <div className="chat-section">
          <ChatWindow
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={(id) => navigate(`/query/${id}`)}
            onCreateSession={handleCreateSession}
            messages={messages}
            onSendMessage={handleSendMessage}
            loading={chatLoading}
            activeStep={activeStep}
            currentUser={currentUser}
            modelConfig={modelConfig}
            onHighlightSource={setHighlightedSourceId}
          />
        </div>

        {/* Visualizer */}
        {showVisualizer && (
          <div className="visualizer-section">
            <div className="visualizer-header">
              <h3>Execution Pipeline</h3>
              <button
                className="close-btn"
                onClick={() => setShowVisualizer(false)}
                title="Close Visualizer"
              >
                <XIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <Visualizer
              steps={executionSteps}
              activeStep={activeStep}
              isRunning={chatLoading}
              highlightedSourceId={highlightedSourceId}
              sources={messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1]?.sources : []}
              onClearHighlight={() => setHighlightedSourceId(null)}
              messageCost={lastAssistantMsg?.estimated_cost_usd}
              messageModel={lastAssistantMsg?.model_used}
              messageTokens={{input: lastAssistantMsg?.input_tokens, output: lastAssistantMsg?.output_tokens}}
              messageLatency={lastAssistantMsg?.latency_ms}
              messageCacheHit={lastAssistantMsg?.cache_hit}
              messageEvaluation={lastAssistantMsg?.evaluation}
            />
          </div>
        )}

        {!showVisualizer && (
          <button
            className="show-visualizer-btn"
            onClick={() => setShowVisualizer(true)}
            title="Show Visualizer"
          >
            Show Pipeline
          </button>
        )}
      </div>

      <style jsx>{`
        .query-page {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: row;
        }

        .chat-sidebar {
          width: 280px;
          background: #ffffff;
          border-right: 1px solid rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.03);
          overflow-y: auto;
          overflow-x: hidden;
        }

        .sidebar-header {
          padding: 20px 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .sidebar-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #111111;
        }

        .new-chat-btn {
          margin: 16px;
          padding: 12px 16px;
          background: #111111;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .new-chat-btn:hover {
          background: #333333;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .new-chat-btn:active {
          transform: translateY(0);
        }

        .department-section {
          padding: 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .dept-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #111111;
          margin-bottom: 8px;
        }

        .dept-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          font-size: 13px;
          color: #111111;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dept-select:hover {
          border-color: rgba(0, 0, 0, 0.25);
        }

        .dept-select:focus {
          outline: none;
          border-color: #111111;
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
        }

        .dept-help {
          font-size: 11px;
          color: #9ca3af;
          margin: 8px 0 0 0;
        }

        .dept-display {
          padding: 10px 12px;
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #111111;
        }

        .chat-history-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
        }

        .history-title {
          margin: 12px 16px 8px 16px;
          font-size: 12px;
          font-weight: 700;
          color: #111111;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .chat-history-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px;
          margin: 0 8px;
        }

        .chat-history-list::-webkit-scrollbar {
          width: 6px;
        }

        .chat-history-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-history-list::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
        }

        .chat-history-list::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }

        .empty-history {
          padding: 24px 12px;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }

        .chat-history-item {
          padding: 10px 12px;
          margin-bottom: 6px;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .chat-history-item:hover {
          background: rgba(0, 0, 0, 0.06);
          border-color: rgba(0, 0, 0, 0.15);
        }

        .chat-history-item.active {
          background: #111111;
          border-color: #111111;
        }

        .chat-history-item.active .history-item-name {
          color: #ffffff;
        }

        .chat-history-item.active .history-item-time {
          color: rgba(255, 255, 255, 0.6);
        }

        .history-item-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .history-item-name {
          font-size: 12px;
          font-weight: 600;
          color: #111111;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .history-item-time {
          font-size: 10px;
          color: #9ca3af;
        }

        .history-item-menu-container {
          position: relative;
        }

        .history-item-menu-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 6px;
          color: #9ca3af;
          transition: all 0.2s;
          opacity: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chat-history-item:hover .history-item-menu-btn {
          opacity: 1;
        }

        .history-item-menu-btn:hover {
          color: #111111;
          transform: scale(1.2);
        }

        .history-item-dropdown {
          position: absolute;
          right: 0;
          top: 100%;
          margin-top: 4px;
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          z-index: 1000;
          min-width: 140px;
          overflow: hidden;
        }

        .dropdown-item {
          display: block;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          color: #111111;
        }

        .dropdown-item:first-child {
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .dropdown-item:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        .dropdown-item.delete-item:hover {
          background: rgba(220, 38, 38, 0.08);
          color: #dc2626;
        }

        .edit-session-form {
          display: flex;
          gap: 6px;
          align-items: center;
          width: 100%;
        }

        .edit-session-input {
          flex: 1;
          padding: 6px 8px;
          border: 1px solid rgba(0, 0, 0, 0.2);
          border-radius: 4px;
          font-size: 12px;
          color: #111111;
          font-weight: 600;
        }

        .edit-session-input:focus {
          outline: none;
          border-color: #111111;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.08);
        }

        .edit-btn-save,
        .edit-btn-cancel {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 6px;
          transition: all 0.2s;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .edit-btn-save {
          color: #111111;
        }

        .edit-btn-save:hover {
          transform: scale(1.15);
        }

        .edit-btn-cancel {
          color: #dc2626;
        }

        .edit-btn-cancel:hover {
          transform: scale(1.15);
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(0, 0, 0, 0.02);
        }

        .documents-section {
          padding: 12px 8px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .documents-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          cursor: pointer;
        }

        .documents-title {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #111111;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .documents-toggle-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 10px;
          color: #9ca3af;
          padding: 2px 4px;
          transition: all 0.2s;
        }

        .documents-toggle-btn:hover {
          color: #111111;
        }

        .documents-list {
          max-height: 300px;
          overflow-y: auto;
          padding: 0 4px;
        }

        .documents-list::-webkit-scrollbar {
          width: 4px;
        }

        .documents-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .documents-list::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 2px;
        }

        .documents-list::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }

        .empty-docs {
          padding: 12px;
          text-align: center;
          color: #9ca3af;
          font-size: 11px;
          margin: 0;
        }

        .document-item {
          padding: 8px 10px;
          margin-bottom: 4px;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all 0.2s;
        }

        .document-item:hover {
          background: rgba(0, 0, 0, 0.06);
          border-color: rgba(0, 0, 0, 0.15);
        }

        .doc-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .doc-name {
          font-size: 11px;
          font-weight: 600;
          color: #111111;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .doc-size {
          font-size: 10px;
          color: #9ca3af;
        }

        .doc-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .doc-badge {
          font-size: 9px;
          font-weight: 600;
          color: #15803d;
          background: rgba(21, 128, 61, 0.12);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .doc-delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 11px;
          opacity: 0.6;
          transition: all 0.2s;
          padding: 0 2px;
        }

        .doc-delete-btn:hover {
          opacity: 1;
          transform: scale(1.15);
        }

        .refresh-docs-btn {
          width: 100%;
          padding: 6px;
          margin-top: 6px;
          background: rgba(0, 0, 0, 0.06);
          color: #111111;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-docs-btn:hover {
          background: rgba(0, 0, 0, 0.12);
          border-color: rgba(0, 0, 0, 0.3);
        }

        .sidebar-user,
        .sidebar-dept {
          margin: 4px 0;
          font-size: 11px;
          color: #9ca3af;
          font-weight: 500;
        }

        .query-container {
          display: flex;
          gap: 20px;
          flex: 1;
          min-height: 0;
        }

        .chat-section {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .visualizer-section {
          width: 350px;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .visualizer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .visualizer-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #111111;
        }

        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          transition: all 0.2s;
          padding: 4px 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: #111111;
        }

        .show-visualizer-btn {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(0, 0, 0, 0.15);
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          color: #111111;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          text-orientation: mixed;
          writing-mode: vertical-rl;
          text-orientation: mixed;
          white-space: nowrap;
          align-self: center;
          margin-top: auto;
          margin-bottom: auto;
        }

        .show-visualizer-btn:hover {
          background: rgba(0, 0, 0, 0.12);
        }

        @media (max-width: 1200px) {
          .visualizer-section {
            display: none;
          }

          .show-visualizer-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            writing-mode: initial;
            text-orientation: initial;
            z-index: 100;
          }
        }

        @media (max-width: 768px) {
          .query-container {
            gap: 12px;
          }

          .chat-section {
            border-radius: 8px;
          }
        }
      `}</style>
    </div>
  );
}
