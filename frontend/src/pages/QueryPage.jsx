import React, { useState, useEffect } from 'react';
import ChatWindow from '../components/ChatWindow';
import Visualizer from '../components/Visualizer';

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

  // --- Loading / Processing State ---
  const [chatLoading, setChatLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [executionSteps, setExecutionSteps] = useState([]);
  const [adminActiveDepartment, setAdminActiveDepartment] = useState('All Departments');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  const token = localStorage.getItem('intradoc_token');

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
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id);
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
        setActiveSessionId(data.id);
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
          setActiveSessionId(data.id);
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

    try {
      const res = await fetch(`${API_BASE}/chat/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: currentSessionId,
          question: text,
          api_keys: apiKeys,
          config: modelConfig,
          department: adminActiveDepartment
        }),
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
          sources: reply.sources || []
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
          setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
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
          <h2>💬 Intradoc Chat</h2>
        </div>

        {/* New Chat Button */}
        <button 
          className="new-chat-btn"
          onClick={handleCreateSession}
        >
          ➕ New Chat
        </button>

        {/* Department Filter */}
        <div className="department-section">
          <label className="dept-label">Query Department</label>
          <select
            value={adminActiveDepartment}
            onChange={(e) => setAdminActiveDepartment(e.target.value)}
            className="dept-select"
          >
            <option value="All Departments">🌐 All Departments</option>
            <option value="HR">👥 HR</option>
            <option value="Legal">⚖️ Legal</option>
            <option value="Finance">💰 Finance</option>
            <option value="Technical">🔧 Technical</option>
            <option value="General">📋 General</option>
          </select>
          <p className="dept-help">
            Select which department's documents to query from
          </p>
        </div>

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
                  onClick={() => setActiveSessionId(session.id)}
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
                        ✓
                      </button>
                      <button
                        className="edit-btn-cancel"
                        onClick={handleEditSessionCancel}
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="history-item-content"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSessionId(session.id);
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
                          ⋮
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
                              ✏️ Rename
                            </button>
                            <button
                              className="dropdown-item delete-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                              }}
                            >
                              🗑️ Delete
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
          <p className="sidebar-user">👤 {currentUser}</p>
          <p className="sidebar-dept">Dept: {userDepartment}</p>
        </div>
      </aside>

      <div className="query-container">
        {/* Chat Window */}
        <div className="chat-section">
          <ChatWindow
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
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
                ✕
              </button>
            </div>
            <Visualizer
              steps={executionSteps}
              activeStep={activeStep}
              highlightedSourceId={highlightedSourceId}
              sources={messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1]?.sources : []}
              onClearHighlight={() => setHighlightedSourceId(null)}
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
          background: linear-gradient(135deg, #FFFFFF 0%, #F5F3ED 100%);
          border-right: 1px solid rgba(20, 20, 19, 0.08);
          display: flex;
          flex-direction: column;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.02);
          overflow-y: auto;
          overflow-x: hidden;
        }

        .sidebar-header {
          padding: 20px 16px;
          border-bottom: 1px solid rgba(20, 20, 19, 0.08);
        }

        .sidebar-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #030712;
        }

        .new-chat-btn {
          margin: 16px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #30A46C 0%, #298E5F 100%);
          color: white;
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
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(48, 164, 108, 0.3);
        }

        .new-chat-btn:active {
          transform: translateY(0);
        }

        .department-section {
          padding: 16px;
          border-bottom: 1px solid rgba(20, 20, 19, 0.08);
        }

        .dept-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #141413;
          margin-bottom: 8px;
        }

        .dept-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid rgba(20, 20, 19, 0.15);
          border-radius: 6px;
          font-size: 13px;
          color: #141413;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dept-select:hover {
          border-color: rgba(20, 20, 19, 0.25);
        }

        .dept-select:focus {
          outline: none;
          border-color: #30A46C;
          box-shadow: 0 0 0 3px rgba(48, 164, 108, 0.1);
        }

        .dept-help {
          font-size: 11px;
          color: #8E8B82;
          margin: 8px 0 0 0;
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
          color: #141413;
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
          background: rgba(20, 20, 19, 0.15);
          border-radius: 3px;
        }

        .chat-history-list::-webkit-scrollbar-thumb:hover {
          background: rgba(20, 20, 19, 0.25);
        }

        .empty-history {
          padding: 24px 12px;
          text-align: center;
          color: #8E8B82;
          font-size: 12px;
        }

        .chat-history-item {
          padding: 10px 12px;
          margin-bottom: 6px;
          background: rgba(20, 20, 19, 0.04);
          border: 1px solid rgba(20, 20, 19, 0.08);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .chat-history-item:hover {
          background: rgba(20, 20, 19, 0.08);
          border-color: rgba(20, 20, 19, 0.15);
        }

        .chat-history-item.active {
          background: linear-gradient(135deg, rgba(48, 164, 108, 0.15) 0%, rgba(48, 164, 108, 0.08) 100%);
          border-color: #30A46C;
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
          color: #141413;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .history-item-time {
          font-size: 10px;
          color: #8E8B82;
        }

        .history-item-menu-container {
          position: relative;
        }

        .history-item-menu-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 2px 6px;
          color: #8E8B82;
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
          color: #141413;
          transform: scale(1.2);
        }

        .history-item-dropdown {
          position: absolute;
          right: 0;
          top: 100%;
          margin-top: 4px;
          background: white;
          border: 1px solid rgba(20, 20, 19, 0.15);
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
          color: #141413;
        }

        .dropdown-item:first-child {
          border-bottom: 1px solid rgba(20, 20, 19, 0.08);
        }

        .dropdown-item:hover {
          background: rgba(20, 20, 19, 0.04);
        }

        .dropdown-item.delete-item:hover {
          background: rgba(200, 50, 50, 0.1);
          color: #C83232;
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
          border: 1px solid #30A46C;
          border-radius: 4px;
          font-size: 12px;
          color: #141413;
          font-weight: 600;
        }

        .edit-session-input:focus {
          outline: none;
          border-color: #30A46C;
          box-shadow: 0 0 0 2px rgba(48, 164, 108, 0.1);
        }

        .edit-btn-save,
        .edit-btn-cancel {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          padding: 2px 6px;
          transition: all 0.2s;
          font-weight: 600;
        }

        .edit-btn-save {
          color: #30A46C;
        }

        .edit-btn-save:hover {
          transform: scale(1.15);
        }

        .edit-btn-cancel {
          color: #C83232;
        }

        .edit-btn-cancel:hover {
          transform: scale(1.15);
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid rgba(20, 20, 19, 0.08);
          background: rgba(20, 20, 19, 0.02);
        }

        .documents-section {
          padding: 12px 8px;
          border-top: 1px solid rgba(20, 20, 19, 0.08);
          border-bottom: 1px solid rgba(20, 20, 19, 0.08);
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
          color: #141413;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .documents-toggle-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 10px;
          color: #8E8B82;
          padding: 2px 4px;
          transition: all 0.2s;
        }

        .documents-toggle-btn:hover {
          color: #141413;
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
          background: rgba(20, 20, 19, 0.15);
          border-radius: 2px;
        }

        .documents-list::-webkit-scrollbar-thumb:hover {
          background: rgba(20, 20, 19, 0.25);
        }

        .empty-docs {
          padding: 12px;
          text-align: center;
          color: #8E8B82;
          font-size: 11px;
          margin: 0;
        }

        .document-item {
          padding: 8px 10px;
          margin-bottom: 4px;
          background: rgba(20, 20, 19, 0.04);
          border: 1px solid rgba(20, 20, 19, 0.08);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all 0.2s;
        }

        .document-item:hover {
          background: rgba(20, 20, 19, 0.08);
          border-color: rgba(20, 20, 19, 0.15);
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
          color: #141413;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .doc-size {
          font-size: 10px;
          color: #8E8B82;
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
          color: #648F64;
          background: rgba(100, 150, 100, 0.15);
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
          background: rgba(48, 164, 108, 0.1);
          color: #30A46C;
          border: 1px solid rgba(48, 164, 108, 0.2);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-docs-btn:hover {
          background: rgba(48, 164, 108, 0.2);
          border-color: rgba(48, 164, 108, 0.4);
        }

        .sidebar-user,
        .sidebar-dept {
          margin: 4px 0;
          font-size: 11px;
          color: #8E8B82;
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
          border: 1px solid rgba(20, 20, 19, 0.08);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .visualizer-section {
          width: 350px;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 12px;
          border: 1px solid rgba(20, 20, 19, 0.08);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }

        .visualizer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(20, 20, 19, 0.08);
        }

        .visualizer-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #141413;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #8E8B82;
          transition: all 0.2s;
          padding: 4px 8px;
        }

        .close-btn:hover {
          color: #141413;
        }

        .show-visualizer-btn {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: rgba(3, 7, 18, 0.08);
          border: 1px solid rgba(3, 7, 18, 0.15);
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          color: #030712;
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
          background: rgba(3, 7, 18, 0.12);
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
