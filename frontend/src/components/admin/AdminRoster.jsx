import React, { useState } from 'react';
import styles from './AdminStyles';

export default function AdminRoster({ users, authHeaders, API_BASE, onRefreshUsers }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Viewer');
  const [inviteDept, setInviteDept] = useState('General');
  const [inviteMsg, setInviteMsg] = useState('');

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteMsg('Sending invitation...');
    try {
      const res = await fetch(`${API_BASE}/admin/invite`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, department: inviteDept })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMsg(`✅ ${data.detail}`);
        setInviteEmail('');
      } else {
        setInviteMsg(`❌ ${data.detail}`);
      }
    } catch (e) {
      setInviteMsg('❌ Network error sending invitation');
    }
  };

  const handleUpdateUser = async (userId, field, value) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        onRefreshUsers();
      } else {
        const data = await res.json();
        alert(data.detail);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="admin-scrollable">
      {/* Invite Section */}
      <div className="glass-panel" style={styles.card}>
        <h3 style={styles.cardTitle}>✉️ Invite New Employee</h3>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={styles.label}>Email Address</label>
            <input 
              type="email" required value={inviteEmail} 
              onChange={e => setInviteEmail(e.target.value)} 
              style={styles.input} placeholder="employee@company.com" 
            />
          </div>
          <div>
            <label style={styles.label}>Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={styles.input}>
              <option value="Viewer">Viewer (Read Only)</option>
              <option value="Editor">Editor (Can Upload)</option>
              <option value="Admin">Admin (Full Access)</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>Department</label>
            <select value={inviteDept} onChange={e => setInviteDept(e.target.value)} style={styles.input}>
              <option value="General">General</option>
              <option value="HR">HR</option>
              <option value="Legal">Legal</option>
              <option value="Finance">Finance</option>
              <option value="Technical">Technical</option>
            </select>
          </div>
          <button type="submit" className="action-btn primary" style={{ padding: '10px 20px', height: '42px' }}>
            Send Invite
          </button>
        </form>
        {inviteMsg && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: inviteMsg.includes('✅') ? '#059669' : '#DC2626' }}>
            {inviteMsg}
          </div>
        )}
      </div>

      {/* Roster Table */}
      <div className="glass-panel" style={{ ...styles.card, marginTop: '24px' }}>
        <h3 style={styles.cardTitle}>👥 Corporate Directory</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Username</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Joined</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Department</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: '600' }}>{u.username}</td>
                <td style={styles.td}>{u.email || '-'}</td>
                <td style={styles.td}>{new Date(u.date_joined).toLocaleDateString()}</td>
                <td style={styles.td}>
                  <select 
                    value={u.role} 
                    onChange={(e) => handleUpdateUser(u.id, 'role', e.target.value)}
                    style={{ ...styles.input, padding: '4px 8px', fontSize: '12px', height: 'auto' }}
                  >
                    <option value="Viewer">Viewer</option>
                    <option value="Editor">Editor</option>
                    <option value="Admin">Admin</option>
                  </select>
                </td>
                <td style={styles.td}>
                  <select 
                    value={u.department} 
                    onChange={(e) => handleUpdateUser(u.id, 'department', e.target.value)}
                    style={{ ...styles.input, padding: '4px 8px', fontSize: '12px', height: 'auto' }}
                  >
                    <option value="General">General</option>
                    <option value="HR">HR</option>
                    <option value="Legal">Legal</option>
                    <option value="Finance">Finance</option>
                    <option value="Technical">Technical</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
