import React, { useState, useEffect } from 'react';
import ChatWindow from './ChatWindow';
import Visualizer from './Visualizer';
import Sidebar from './Sidebar';

export default function WorkspacePage({ 
  API_BASE, 
  apiKeys, 
  handleApiKeyChange,
  modelConfig, 
  setModelConfig,
  isGlobalConfigEnforced,
  currentUser,
  userRole,
  userDepartment,
  onLogout,
  navigate
}) {
  // --- UI Layout State ---
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [highlightedSourceId, setHighlightedSourceId] = useState(null);

  // --- Workspace Documents State ---
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [adminActiveDepartment, setAdminActiveDepartment] = useState('All Departments');

  // --- Data State ---
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);

  // --- Loading / Processing State ---
  const [chatLoading, setChatLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(null); // Active step executing in LangGraph
  const [executionSteps, setExecutionSteps] = useState([]); // Visualizer steps

  const token = localStorage.getItem('intradoc_token');

  // --- Fetch sessions once mounted ---
  useEffect(() => {
    fetchSessions();
  }, [adminActiveDepartment]);

  // --- Fetch documents initially and when active department changes ---
  useEffect(() => {
    if (token) {
      fetchDocuments();
    }
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

  // --- Poll for document processing status if any are ingesting ---
  useEffect(() => {
    const hasIngesting = documents.some(doc => doc.status === 'ingesting');
    if (!hasIngesting) return;

    const timer = setInterval(() => {
      fetchDocuments();
    }, 2000);

    return () => clearInterval(timer);
  }, [documents]);

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

  const fetchDocuments = async () => {
    try {
      let fetchUrl = `${API_BASE}/documents`;
      if (adminActiveDepartment && adminActiveDepartment !== 'All Departments') {
        fetchUrl += `?department=${encodeURIComponent(adminActiveDepartment)}`;
      }
      const res = await fetch(fetchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const handleUploadDocument = async (file) => {
    if (userRole === 'Viewer') {
      alert('Access Denied: Viewer accounts are restricted to read-only access and cannot upload documents.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (userRole === 'Admin') {
      formData.append('department', adminActiveDepartment);
    }

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      
      if (res.ok) {
        fetchDocuments();
      } else {
        const errData = await res.json();
        alert(`Upload failed: ${errData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Network error during file upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (userRole === 'Viewer') {
      alert('Access Denied: Viewer accounts are restricted to read-only access and cannot delete documents.');
      return;
    }

    if (!confirm('Are you sure you want to delete this document? It will be removed from context.')) return;
    
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchDocuments();
      } else {
        const errData = await res.json();
        alert(`Deletion failed: ${errData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
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
    const localUserMsg = {
      id: Math.random().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, localUserMsg]);

    const plannedSteps = ['retrieve', 'grade_documents', 'generate', 'groundedness'];
    setExecutionSteps([]);
    
    let stepIdx = 0;
    setActiveStep(plannedSteps[stepIdx]);
    const stepInterval = setInterval(() => {
      if (stepIdx < plannedSteps.length - 2) {
        stepIdx++;
        setActiveStep(plannedSteps[stepIdx]);
      }
    }, 1500);

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

      clearInterval(stepInterval);

      if (res.ok) {
         const reply = await res.json();
         const actualSteps = reply.steps || [];
         
         let simIdx = 0;
         setExecutionSteps([]);
         
         const simTimer = setInterval(() => {
           if (simIdx < actualSteps.length) {
             setExecutionSteps(prev => [...prev, actualSteps[simIdx]]);
             setActiveStep(actualSteps[simIdx]);
             simIdx++;
           } else {
             clearInterval(simTimer);
             setActiveStep(null);
             setMessages(prev => {
               const filtered = prev.filter(m => m.id !== localUserMsg.id);
               return [...filtered, localUserMsg, reply];
             });
             setChatLoading(false);
           }
         }, 300);
      } else {
        const errData = await res.json();
        clearInterval(stepInterval);
        setActiveStep(null);
        setChatLoading(false);
        setMessages(prev => [
          ...prev, 
          { 
            id: Math.random().toString(), 
            role: 'assistant', 
            content: `Failed to fetch response: ${errData.detail || 'Check API keys or Backend connection.'}` 
          }
        ]);
      }
    } catch (err) {
      console.error('Query error:', err);
      clearInterval(stepInterval);
      setActiveStep(null);
      setChatLoading(false);
      setMessages(prev => [
        ...prev, 
        { 
          id: Math.random().toString(), 
          role: 'assistant', 
          content: 'Network connection error. Ensure backend Python server is running on port 8001.' 
        }
      ]);
    }
  };

  const handleHighlightSource = (srcId) => {
    setHighlightedSourceId(srcId);
    setShowVisualizer(true);
  };

  // Find sources of the latest assistant message
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  const currentSources = assistantMessages.length > 0 
    ? (assistantMessages[assistantMessages.length - 1].sources || []) 
    : [];

  return (
    <div className={`app-container ${showVisualizer ? '' : 'collapsed-right'}`}>
      <Sidebar 
        documents={documents}
        onUpload={handleUploadDocument}
        onDeleteDocument={handleDeleteDocument}
        apiKeys={apiKeys}
        onApiKeyChange={handleApiKeyChange}
        modelConfig={modelConfig}
        onModelConfigChange={setModelConfig}
        isGlobalConfigEnforced={isGlobalConfigEnforced}
        uploading={uploading}
        currentUser={currentUser}
        currentUserRole={userRole}
        currentUserDepartment={userDepartment}
        adminActiveDepartment={adminActiveDepartment}
        setAdminActiveDepartment={setAdminActiveDepartment}
        activeTab="workspace"
        setActiveTab={(tab) => {
          if (tab === 'admin') navigate('/admin');
        }}
        onLogout={onLogout}
      />

      <div className="workspace-wrapper" style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <ChatWindow 
          messages={messages}
          activeSessionId={activeSessionId}
          sessions={sessions}
          onSendMessage={handleSendMessage}
          onCreateSession={handleCreateSession}
          activeStep={activeStep}
          loading={chatLoading}
          modelConfig={modelConfig}
          onHighlightSource={handleHighlightSource}
        />

        {/* Visualizer Collapsible Pane */}
        <div className="collapsible-wrapper">
          <Visualizer 
            steps={executionSteps}
            sources={currentSources}
            highlightedSourceId={highlightedSourceId}
            onClearHighlight={() => setHighlightedSourceId(null)}
          />
        </div>

        {/* Collapsible toggle switch button */}
        <button 
          className="toggle-hub-btn" 
          onClick={() => setShowVisualizer(!showVisualizer)}
          title={showVisualizer ? "Collapse Analysis Panel" : "Expand Analysis Panel"}
        >
          {showVisualizer ? '→' : '←'}
        </button>
      </div>
    </div>
  );
}
