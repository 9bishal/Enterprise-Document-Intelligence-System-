import React, { useState, useEffect, useRef } from 'react';
import { FileIcon, UploadIcon, TrashIcon, FolderIcon, AlertTriangleIcon } from '../components/Icons';
import { safeLocalStorage } from '../utils/constants';
import { useDepartments } from '../utils/useDepartments';
const storage = safeLocalStorage();

export default function DocumentsPage({
  API_BASE,
  currentUser,
  userRole,
  userDepartment
}) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [adminActiveDepartment, setAdminActiveDepartment] = useState('All Departments');
  const [filter, setFilter] = useState('all'); // 'all', 'indexed', 'ingesting', 'failed'
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'size'
  const fileInputRef = useRef(null);

  const token = storage.getItem('intradoc_token');
  const departments = useDepartments(true);

  // --- Fetch documents initially and when active department changes ---
  useEffect(() => {
    if (token) {
      fetchDocuments();
    }
  }, [adminActiveDepartment]);

  // --- Poll for document processing status if any are ingesting ---
  useEffect(() => {
    const hasIngesting = documents.some(doc => doc.status === 'ingesting');
    if (!hasIngesting) return;

    const timer = setInterval(() => {
      fetchDocuments();
    }, 2000);

    return () => clearInterval(timer);
  }, [documents]);

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
        body: formData
      });

      if (res.ok) {
        alert('Document uploaded and indexing...');
        fetchDocuments();
      } else {
        alert('Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadDocument(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleDeleteDocument = async (docId) => {
    if (userRole === 'Viewer') {
      alert('Access Denied: Viewer accounts are restricted to read-only access and cannot delete documents.');
      return;
    }

    if (!confirm('Delete this document?')) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        alert('Document deleted');
        fetchDocuments();
      } else {
        alert('Failed to delete document');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error: ' + err.message);
    }
  };

  // Filter and sort documents
  let filteredDocs = documents;
  if (filter !== 'all') {
    filteredDocs = documents.filter(doc => doc.status === filter);
  }

  if (sortBy === 'name') {
    filteredDocs.sort((a, b) => a.filename.localeCompare(b.filename));
  } else if (sortBy === 'size') {
    filteredDocs.sort((a, b) => b.file_size - a.file_size);
  } else {
    filteredDocs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const stats = {
    total: documents.length,
    indexed: documents.filter(d => d.status === 'indexed').length,
    ingesting: documents.filter(d => d.status === 'ingesting').length,
    failed: documents.filter(d => d.status === 'failed').length
  };

  return (
    <div className="documents-page">
      {/* Header Section */}
      <div className="documents-header">
        <div>
          <h1>Documents Manager</h1>
          <p className="subtitle">Upload, manage, and organize your documents for the knowledge base</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Documents</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card indexed">
          <span className="stat-label">Indexed</span>
          <span className="stat-value">{stats.indexed}</span>
        </div>
        <div className="stat-card ingesting">
          <span className="stat-label">Ingesting</span>
          <span className="stat-value">{stats.ingesting}</span>
        </div>
        <div className="stat-card failed">
          <span className="stat-label">Failed</span>
          <span className="stat-value">{stats.failed}</span>
        </div>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <div className="upload-content">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".pdf,.docx,.txt,.md"
          />
          <button
            className="upload-btn"
            onClick={triggerFileInput}
            disabled={uploading || userRole === 'Viewer'}
            title={userRole === 'Viewer' ? 'Only Editors and Admins can upload' : 'Upload a document'}
          >
            <UploadIcon style={{ width: 20, height: 20 }} />
            {uploading ? 'Uploading & Indexing...' : 'Upload Document'}
          </button>

          {userRole === 'Admin' && (
            <div className="department-selector">
              <label>Upload to Department:</label>
              <select
                value={adminActiveDepartment}
                onChange={(e) => setAdminActiveDepartment(e.target.value)}
              >
                <option value="All Departments">All Departments</option>
                {departments.filter(d => d !== 'All Departments').map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <p className="upload-help">
          Supported formats: PDF, DOCX, TXT, MD • Max file size: 50MB
        </p>
      </div>

      {/* Filters and Sorting */}
      <div className="controls-bar">
        <div className="filter-group">
          <label>Filter by Status:</label>
          <div className="filter-buttons">
            {['all', 'indexed', 'ingesting', 'failed'].map(status => (
              <button
                key={status}
                className={`filter-btn ${filter === status ? 'active' : ''}`}
                onClick={() => setFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="sort-group">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Most Recent</option>
            <option value="name">Name (A-Z)</option>
            <option value="size">File Size</option>
          </select>
        </div>
      </div>

      {/* Documents List */}
      <div className="documents-container">
        {filteredDocs.length === 0 ? (
          <div className="empty-state">
            <p>No documents found</p>
            <span>Upload a document to get started</span>
          </div>
        ) : (
          <div className="documents-grid">
            {filteredDocs.map((doc) => (
              <div className="document-item" key={doc.id}>
                <div className="doc-header">
                  <div className="doc-icon-section">
                    <FileIcon className="doc-icon" />
                  </div>
                  {userRole !== 'Viewer' && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteDocument(doc.id)}
                      title="Delete document"
                    >
                      <TrashIcon style={{ width: 16, height: 16 }} />
                    </button>
                  )}
                </div>

                <div className="doc-info">
                  <h3 className="doc-name" title={doc.filename}>
                    {doc.filename}
                  </h3>
                  <p className="doc-meta">
                    {(doc.file_size / 1024).toFixed(1)} KB • {doc.status}
                  </p>

                  {doc.status === 'indexed' && (
                    <div className="doc-tags">
                      {doc.classification && (
                        <span className="tag classification">
                          {doc.classification}
                        </span>
                      )}
                      {doc.risk_status && doc.risk_status === 'Risk Detected' && (
                        <span className="tag risk">
<AlertTriangleIcon style={{ width: 11, height: 11, verticalAlign: 'middle', marginRight: 3 }} /> Risk Detected
                        </span>
                      )}
                      {doc.department && (
                        <span className="tag department">
<FolderIcon style={{ width: 11, height: 11, verticalAlign: 'middle', marginRight: 3 }} /> {doc.department}
                        </span>
                      )}
                    </div>
                  )}

                  {doc.status === 'ingesting' && (
                    <div className="progress-bar">
                      <div className="progress-fill"></div>
                    </div>
                  )}

                  {doc.status === 'failed' && (
                    <p className="error-msg">
                      {doc.error_message || 'Processing failed'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .documents-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
          height: 100%;
          overflow-y: auto;
        }

        .documents-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .documents-header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #111111;
        }

        .subtitle {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #9ca3af;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          gap: 8px;
          transition: all 0.2s;
        }

        .stat-card:hover {
          border-color: rgba(0, 0, 0, 0.15);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .stat-card.indexed {
          border-color: rgba(21, 128, 61, 0.3);
          background: rgba(21, 128, 61, 0.05);
        }

        .stat-card.ingesting {
          border-color: rgba(180, 83, 9, 0.3);
          background: rgba(180, 83, 9, 0.05);
        }

        .stat-card.failed {
          border-color: rgba(220, 38, 38, 0.3);
          background: rgba(220, 38, 38, 0.05);
        }

        .stat-label {
          font-size: 12px;
          color: #9ca3af;
          font-weight: 600;
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #111111;
        }

        .upload-section {
          background: white;
          border: 2px dashed rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          transition: all 0.2s;
        }

        .upload-section:hover {
          border-color: rgba(0, 0, 0, 0.4);
          background: rgba(0, 0, 0, 0.02);
        }

        .upload-content {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .upload-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: #111111;
          border: 1px solid #111111;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .upload-btn:hover:not(:disabled) {
          background: #333333;
          border-color: #333333;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .upload-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .department-selector {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .department-selector label {
          font-size: 13px;
          font-weight: 600;
          color: #111111;
        }

        .department-selector select {
          padding: 8px 12px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          font-size: 13px;
          color: #111111;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .department-selector select:focus {
          outline: none;
          border-color: #111111;
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
        }

        .upload-help {
          font-size: 12px;
          color: #9ca3af;
          margin: 0;
        }

        .controls-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          background: white;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          flex-wrap: wrap;
        }

        .filter-group,
        .sort-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .filter-group label,
        .sort-group label {
          font-size: 13px;
          font-weight: 600;
          color: #111111;
          white-space: nowrap;
        }

        .filter-buttons {
          display: flex;
          gap: 6px;
        }

        .filter-btn {
          padding: 6px 12px;
          background: transparent;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #525252;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          border-color: rgba(0, 0, 0, 0.3);
          color: #111111;
          background: rgba(0, 0, 0, 0.03);
        }

        .filter-btn.active {
          background: #111111;
          border-color: #111111;
          color: #ffffff;
        }

        .sort-group select {
          padding: 6px 10px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          font-size: 12px;
          color: #111111;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sort-group select:focus {
          outline: none;
          border-color: #111111;
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
        }

        .documents-container {
          flex: 1;
          overflow-y: auto;
          min-height: 300px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          gap: 12px;
        }

        .empty-state p {
          font-size: 16px;
          font-weight: 600;
          color: #111111;
          margin: 0;
        }

        .empty-state span {
          font-size: 13px;
          color: #9ca3af;
        }

        .documents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .document-item {
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .document-item:hover {
          border-color: rgba(0, 0, 0, 0.15);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .doc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .doc-icon-section {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 8px;
        }

        .doc-icon {
          width: 24px;
          height: 24px;
          color: #111111;
        }

        .delete-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          padding: 4px 8px;
          transition: all 0.2s;
          opacity: 0.6;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .delete-btn:hover {
          opacity: 1;
        }

        .doc-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .doc-name {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #111111;
          word-break: break-word;
          white-space: normal;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .doc-meta {
          margin: 0;
          font-size: 12px;
          color: #9ca3af;
        }

        .doc-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #525252;
          white-space: nowrap;
        }

        .tag.risk {
          background: rgba(220, 38, 38, 0.1);
          border-color: rgba(220, 38, 38, 0.3);
          color: #dc2626;
        }

        .tag.department {
          background: rgba(0, 0, 0, 0.06);
          border-color: rgba(0, 0, 0, 0.15);
          color: #111111;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(0, 0, 0, 0.1);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #111111;
          animation: progress-animation 1.5s ease-in-out infinite;
        }

        @keyframes progress-animation {
          0% { width: 0%; }
          50% { width: 80%; }
          100% { width: 100%; }
        }

        .error-msg {
          margin: 0;
          font-size: 11px;
          color: #dc2626;
        }

        @media (max-width: 768px) {
          .documents-grid {
            grid-template-columns: 1fr;
          }

          .controls-bar {
            flex-direction: column;
            align-items: flex-start;
          }

          .upload-content {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
