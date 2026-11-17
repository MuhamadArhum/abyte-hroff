import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user, isAdmin, refreshUser } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api.get('/settings').then((r) => setSettings(r.data)).catch((e: any) => {
      setMsg(e?.response?.data?.message || 'Failed to load settings.');
      setSettings({});
    });
  }, []);
  const change = async (e:any) => {
    e.preventDefault(); setMsg('');
    try {
      const r = await api.post('/auth/change-password', { currentPassword, newPassword });
      await refreshUser().catch(() => undefined);
      setMsg(r.data.message || 'Password changed'); setCurrentPassword(''); setNewPassword('');
    }
    catch(err:any){ setMsg(err.response?.data?.message || 'Failed to change password'); }
  };
  if (!settings) return <div className="panel"><div className="panel-body">Loading settings...</div></div>;
  const infoRow = (label: string, value: any) => (
    <div className="list-row"><span className="mono muted" style={{ fontSize: 11 }}>{label}</span><span style={{ textAlign: 'right', wordBreak: 'break-all' }}>{String(value ?? '-')}</span></div>
  );
  return <div>
    <div className="page-head-row">
      <div><div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>Settings</div><div className="sub-mono">APPLICATION · DATABASE · STORAGE · SECURITY · RBAC</div></div>
      {isAdmin && <Link to="/users" className="btn-cp primary">Manage Users</Link>}
    </div>
    <div className="grid-2col">
      <div className="panel">
        <div className="panel-head"><span className="section-title">System Information</span></div>
        <div className="panel-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
          <ul className="list-clean">
            {infoRow('APPLICATION', settings.applicationName)}
            {infoRow('VERSION', settings.version)}
            {infoRow('PLATFORM', settings.system.platform)}
            {infoRow('NODE', settings.system.node)}
            {infoRow('HOSTNAME', settings.system.hostname)}
            {infoRow('EMPLOYEES', settings.stats.employees)}
            {infoRow('DEPARTMENTS', settings.stats.departments)}
            {infoRow('DESIGNATIONS', settings.stats.designations)}
          </ul>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><span className="section-title">Database & Storage</span></div>
        <div className="panel-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
          <ul className="list-clean">
            {infoRow('DATABASE', settings.database.provider)}
            {infoRow('DB PATH', settings.database.path)}
            {infoRow('DB SIZE', `${settings.database.sizeBytes} bytes`)}
            {infoRow('STORAGE PATH', settings.storage.path)}
            {infoRow('BACKUP PATH', settings.storage.backupPath)}
            {infoRow('UPLOAD LIMIT', `${settings.upload.maxImageSizeMB} MB`)}
            {infoRow('ALLOWED TYPES', settings.upload.allowedImageTypes.join(', '))}
            {infoRow('AUTO BACKUP', settings.backup.automaticEnabled ? settings.backup.interval : 'Disabled')}
            {infoRow('TOTAL BACKUPS', settings.backup.totalBackups)}
          </ul>
        </div>
      </div>
    </div>
    <div className="panel">
      <div className="panel-head"><span className="section-title">Change Password</span><span className="mono muted" style={{ fontSize: 11 }}>{user?.username} ({user?.role})</span></div>
      <div className="panel-body">
        {msg && <div className="mono" style={{ marginBottom: 12, fontSize: 11, color: msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('incorrect') ? 'var(--red-risk)' : 'var(--green-ok)' }}>{msg}</div>}
        <form onSubmit={change} className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', maxWidth: 900 }}>
          <div><label className="label-mono">Current Password</label><input type="password" className="input-cp" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required /></div>
          <div><label className="label-mono">New Password</label><input type="password" className="input-cp" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={12} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}" title="At least 12 characters with upper, lower, digit and symbol" /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn-cp primary" style={{ width: '100%', justifyContent: 'center' }}>Change Password</button></div>
        </form>
      </div>
    </div>
    <div className="panel">
      <div className="panel-head"><span className="section-title">Access & Roles (RBAC)</span></div>
      <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>ADMIN</b>: Full access — manage users, backups, all data, settings.</li>
          <li><b>MANAGER</b>: View all + create/edit employees, departments, designations, uploads; no user/backup admin.</li>
          <li><b>HR</b>: View all + create/edit employees, departments, designations, uploads (HR operations); no user/backup admin.</li>
          <li><b>VIEWER</b>: Read-only access to dashboard, employees, organization, reports, and settings info.</li>
          <li><b>OTHER</b>: Read-only access to dashboard, employees, organization, reports, and settings info.</li>
        </ul>
        {!isAdmin && <div className="mono muted" style={{ fontSize: 11, marginTop: 10 }}>User management and backup administration are available to ADMIN users only.</div>}
      </div>
    </div>
  </div>;
}
