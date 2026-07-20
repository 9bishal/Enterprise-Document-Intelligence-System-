import React from 'react';

// Interactive Knowledge Graph Visualizer using SVG
export default function KnowledgeGraphVisualizer({ data }) {
  if (!data || !data.departments || data.departments.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8E8B82',
        fontSize: '14px'
      }}>
        No data to map
      </div>
    );
  }

  const width = 800;
  const height = 500;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 180; // Distance of departments from center

  const colors = {
    'HR': '#E05E3F',
    'Legal': '#6366F1',
    'Finance': '#059669',
    'Technical': '#D97706',
    'General': '#8E8B82'
  };

  // Position departments in a circle
  const deptNodes = data.departments.map((dept, index) => {
    const angle = (index / data.departments.length) * 2 * Math.PI - Math.PI / 2;
    return {
      ...dept,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      color: colors[dept.name] || '#8E8B82'
    };
  });

  // Map documents around their respective departments
  const docNodes = data.documents.map((doc) => {
    const dept = deptNodes.find(d => d.name === doc.department);
    if (!dept) return null;
    
    // Spread docs in a smaller circle around the department
    const siblings = data.documents.filter(d => d.department === doc.department);
    const sibIndex = siblings.findIndex(s => s.id === doc.id);
    const sibAngle = (sibIndex / (siblings.length || 1)) * 2 * Math.PI;
    const docRadius = 50 + (sibIndex % 2) * 15; // stagger

    return {
      ...doc,
      deptX: dept.x,
      deptY: dept.y,
      x: dept.x + docRadius * Math.cos(sibAngle),
      y: dept.y + docRadius * Math.sin(sibAngle),
      color: colors[doc.department] || '#8E8B82'
    };
  }).filter(Boolean);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {/* Background Grid */}
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(20, 20, 19, 0.03)" strokeWidth="1"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Links from Center to Departments */}
      {deptNodes.map(dept => (
        <line 
          key={`link-org-${dept.name}`}
          x1={centerX} y1={centerY} 
          x2={dept.x} y2={dept.y} 
          stroke="rgba(20, 20, 19, 0.15)" 
          strokeWidth="2" 
          strokeDasharray="4 4"
        />
      ))}

      {/* Links from Departments to Documents */}
      {docNodes.map(doc => (
        <line 
          key={`link-${doc.id}`}
          x1={doc.deptX} y1={doc.deptY} 
          x2={doc.x} y2={doc.y} 
          stroke={doc.color} 
          strokeOpacity="0.3"
          strokeWidth="1.5" 
        />
      ))}

      {/* Document Nodes */}
      {docNodes.map(doc => (
        <g key={`node-${doc.id}`} style={{ cursor: 'pointer' }}>
          <title>{doc.filename}&#10;Class: {doc.classification}&#10;Chunks: {doc.chunk_count}</title>
          <circle cx={doc.x} cy={doc.y} r={doc.risk_status === 'Risk Detected' ? 8 : 6} fill={doc.color} />
          {doc.risk_status === 'Risk Detected' && (
            <circle cx={doc.x} cy={doc.y} r={12} fill="none" stroke="#DC2626" strokeWidth="2" strokeDasharray="2 2" />
          )}
          <text x={doc.x} y={doc.y + 14} fontSize="9" fill="#5C5A55" textAnchor="middle">
            {doc.filename.substring(0, 10)}...
          </text>
        </g>
      ))}

      {/* Department Nodes */}
      {deptNodes.map(dept => (
        <g key={`node-dept-${dept.name}`}>
          <circle cx={dept.x} cy={dept.y} r={28} fill="#141413" />
          <text x={dept.x} y={dept.y + 4} fontSize="12" fontWeight="bold" fill="#FAF9F5" textAnchor="middle">
            {dept.name}
          </text>
          <text x={dept.x} y={dept.y + 42} fontSize="11" fontWeight="600" fill="#141413" textAnchor="middle">
            {dept.document_count} docs
          </text>
        </g>
      ))}

      {/* Center Organization Node */}
      <g>
        <circle cx={centerX} cy={centerY} r={36} fill="#E05E3F" />
        <circle cx={centerX} cy={centerY} r={42} fill="none" stroke="#E05E3F" strokeWidth="1" strokeOpacity="0.5" />
        <text x={centerX} y={centerY + 5} fontSize="14" fontWeight="bold" fill="#FAF9F5" textAnchor="middle">
          Intradoc
        </text>
      </g>
    </svg>
  );
}
