const API_BASE = 'http://localhost:8001/api';

const getHeaders = () => {
  const token = localStorage.getItem('intradoc_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth
  me: async () => {
    return await fetch(`${API_BASE}/auth/me`, { headers: getHeaders() });
  },
  login: async (username, password) => {
    return await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  },
  signup: async (username, password, email, otp) => {
    return await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, otp })
    });
  },
  logout: async () => {
    return await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getHeaders()
    });
  },
  forgotPassword: async (email) => {
    return await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  },
  resetPassword: async (email, otp, newPassword) => {
    return await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password: newPassword })
    });
  },
  
  // LLM Config
  getPublicLlmConfig: async () => {
    return await fetch(`${API_BASE}/llm-config`, { headers: getHeaders() });
  },
  getAdminLlmConfig: async () => {
    return await fetch(`${API_BASE}/admin/llm-config`, { headers: getHeaders() });
  },
  updateAdminLlmConfig: async (payload) => {
    return await fetch(`${API_BASE}/admin/llm-config/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getHeaders() },
      body: JSON.stringify(payload)
    });
  },

  // Documents
  getDocuments: async (department) => {
    let url = `${API_BASE}/documents`;
    if (department && department !== 'All Departments') {
      url += `?department=${encodeURIComponent(department)}`;
    }
    return await fetch(url, { headers: getHeaders() });
  },
  uploadDocument: async (file, department) => {
    const formData = new FormData();
    formData.append('file', file);
    if (department) {
      formData.append('department', department);
    }
    return await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: getHeaders(),
      body: formData
    });
  },
  deleteDocument: async (docId) => {
    return await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
  },

  // Sessions
  getSessions: async () => {
    return await fetch(`${API_BASE}/chat/sessions`, { headers: getHeaders() });
  },
  createSession: async (name) => {
    return await fetch(`${API_BASE}/chat/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getHeaders() },
      body: JSON.stringify({ name })
    });
  },
  deleteSession: async (sessionId) => {
    return await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
  },
  getMessages: async (sessionId) => {
    return await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, { headers: getHeaders() });
  },
  queryRag: async (payload) => {
    return await fetch(`${API_BASE}/chat/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getHeaders() },
      body: JSON.stringify(payload)
    });
  },

  // Admin users & metrics
  getAdminMetrics: async () => {
    return await fetch(`${API_BASE}/admin/metrics`, { headers: getHeaders() });
  },
  adminInvite: async (payload) => {
    return await fetch(`${API_BASE}/admin/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getHeaders() },
      body: JSON.stringify(payload)
    });
  },
  getAdminUsers: async () => {
    return await fetch(`${API_BASE}/admin/users`, { headers: getHeaders() });
  },
  updateAdminUser: async (userId, payload) => {
    return await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getHeaders() },
      body: JSON.stringify(payload)
    });
  },
  getKnowledgeGraph: async () => {
    return await fetch(`${API_BASE}/admin/knowledge-graph`, { headers: getHeaders() });
  }
};
