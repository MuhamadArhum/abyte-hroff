import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';

type UserRow = { id: number; username: string; fullName?: string; role: 'ADMIN'|'MANAGER'|'HR'|'VIEWER'|'OTHER'; isActive: boolean; createdAt: string };

const emptyForm = { username: '', fullName: '', password: '', role: 'VIEWER' as 'ADMIN'|'MANAGER'|'HR'|'VIEWER'|'OTHER', isActive: true };

export default function Users() {
  const { user: me } = useAuth();
  const { confirm } = useUI();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = async (p = page, l = limit, s = search) => {
    setLoading(true);
    try {
      const r = await api.get('/auth/users', { params: { page: p, limit: l, search: s || undefined } });
      const data = r.data || {};
      setUsers(Array.isArray(data) ? data : (data.items || []));
      setTotal(Array.isArray(data) ? data.length : (data.total || 0));
      setPage(Array.isArray(data) ? 1 : (data.page || p));
      setLimit(Array.isArray(data) ? l : (data.limit || l));
      setTotalPages(Array.isArray(data) ? 1 : (data.totalPages || 1));
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, limit, search); /* eslint-disable-next-line */ }, []);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); setMsg(''); setErr(''); };
  const openEdit = (u: UserRow) => { setEditing(u); setForm({ username: u.username, fullName: u.fullName || '', password: '', role: u.role, isActive: u.isActive }); setShowForm(true); setMsg(''); setErr(''); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      if (editing) {
        const payload: any = { username: form.username, fullName: form.fullName, role: form.role, isActive: form.isActive };
        if (form.password) payload.password = form.password;
        await api.put(`/auth/users/${editing.id}`, payload);
        setMsg('User updated');
        setShowForm(false);
        load(page, limit, search);
      } else {
        await api.post('/auth/users', form);
        setMsg('User created');
        setShowForm(false);
        setPage(1);
        load(1, limit, search);
      }
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Save failed');
    }
  };

  const toggleActive = async (u: UserRow) => {
    if (u.id === me?.id) { setErr('You cannot deactivate your own account'); return; }
    const ok = await confirm({
      title: u.isActive ? 'Deactivate User' : 'Activate User',
      message: u.isActive ? `Are you sure you want to deactivate user "${u.username}"?` : `Are you sure you want to activate user "${u.username}"?`,
      confirmText: 'Yes',
      cancelText: 'No',
      danger: u.isActive,
    });
    if (!ok) return;
    try {
      await api.put(`/auth/users/${u.id}`, { isActive: !u.isActive });
      setMsg(`User ${u.isActive ? 'deactivated' : 'activated'}`);
      load(page, limit, search);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed');
    }
  };

  const remove = async (u: UserRow) => {
    if (u.id === me?.id) { setErr('You cannot delete your own account'); return; }
    const ok = await confirm({ title: 'Delete User', message: `Are you sure you want to delete user "${u.username}"?`, confirmText: 'Yes', cancelText: 'No', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/auth/users/${u.id}`);
      setMsg('User deleted');
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      load(nextPage, limit, search);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to delete user');
    }
  };

  const applySearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const s = searchInput.trim();
    setSearch(s);
    setPage(1);
    load(1, limit, s);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
    load(1, limit, '');
  };

  const changePage = (p: number) => {
    const np = Math.min(Math.max(1, p), totalPages || 1);
    setPage(np);
    load(np, limit, search);
  };

  const changeLimit = (l: number) => {
    setLimit(l);
    setPage(1);
    load(1, l, search);
  };

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pageNumbers = (() => {
    const pages: (number | string)[] = [];
    const tp = totalPages || 1;
    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(tp - 1, page + 1); i++) pages.push(i);
    if (page < tp - 2) pages.push('...');
    pages.push(tp);
    return pages;
  })();

  return (
    <div>
      <div className="page-head-row">
        <div>
          <div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>User Management</div>
          <div className="sub-mono">RBAC · ADD AND MANAGE MULTIPLE USERS</div>
        </div>
        <button className="btn-cp primary" onClick={openCreate}>+ Add User</button>
      </div>

      {(msg || err) && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-body mono" style={{ fontSize: 12, color: err ? 'var(--red-risk)' : 'var(--green-ok)' }}>{err || msg}</div>
        </div>
      )}

      {showForm && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <span className="section-title">{editing ? 'Edit User' : 'Create User'}</span>
            <button className="btn-cp" onClick={() => setShowForm(false)}>Close</button>
          </div>
          <div className="panel-body">
            <form onSubmit={save} className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
              <div>
                <label className="label-mono">Username *</label>
                <input className="input-cp" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
              </div>
              <div>
                <label className="label-mono">Full Name</label>
                <input className="input-cp" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="label-mono">Role *</label>
                <select className="select-cp" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="HR">HR</option>
                  <option value="VIEWER">VIEWER</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div>
                <label className="label-mono">Password {editing ? '(leave blank to keep)' : '*'}</label>
                <input
                  type="password"
                  className="input-cp"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  minLength={6}
                  {...(!editing ? { required: true } : {})}
                  placeholder={editing ? 'New password (optional)' : 'Min 6 characters'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} disabled={editing?.id === me?.id} /> Active
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <button className="btn-cp primary" type="submit">{editing ? 'Update User' : 'Create User'}</button>
                <button type="button" className="btn-cp" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
            <div className="mono muted" style={{ fontSize: 11, marginTop: 10 }}>
              Roles: <b>ADMIN</b> (full access, user/backup management), <b>MANAGER</b> & <b>HR</b> (view + create/edit employees/org), <b>VIEWER</b> & <b>OTHER</b> (read-only).
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="section-title">Users</span>
            <span className="mono muted" style={{ fontSize: 11 }}>{total} total</span>
          </div>
          <form onSubmit={applySearch} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input className="input-cp" placeholder="Search username or name..." value={searchInput} onChange={e => setSearchInput(e.target.value)} style={{ width: 240, height: 36 }} />
            <button className="btn-cp" type="submit" style={{ height: 36, padding: '0 12px' }}>Search</button>
            {search && <button className="btn-cp" type="button" onClick={clearSearch} style={{ height: 36, padding: '0 12px' }}>Clear</button>}
          </form>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center' }} className="muted">Loading...</td></tr>}
              {!loading && users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>
                    {u.username}
                    {u.id === me?.id && <span className="mono muted" style={{ fontSize: 10, marginLeft: 6 }}>(you)</span>}
                  </td>
                  <td>{u.fullName || '-'}</td>
                  <td><span className={`status-pill ${u.role === 'ADMIN' ? 'active' : (u.role === 'MANAGER' || u.role === 'HR') ? 'at-risk' : 'inactive'}`}>{u.role}</span></td>
                  <td><span className={`status-pill ${u.isActive ? 'active' : 'delayed'}`}>{u.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
                  <td className="mono" style={{ fontSize: 11 }}>{new Date(u.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="action-group">
                      <button className="row-action edit" onClick={() => openEdit(u)} title="Edit"><Pencil /> Edit</button>
                      <button className={`row-action ${u.isActive ? 'warn' : 'success'}`} onClick={() => toggleActive(u)} disabled={u.id === me?.id} title={u.isActive ? 'Deactivate' : 'Activate'}>{u.isActive ? <UserX /> : <UserCheck />} {u.isActive ? 'Deactivate' : 'Activate'}</button>
                      <button className="row-action danger" onClick={() => remove(u)} disabled={u.id === me?.id} title="Delete"><Trash2 /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center' }} className="muted">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="panel-footer-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="mono muted" style={{ fontSize: 12 }}>Showing <b style={{ color: 'var(--ch-text)' }}>{start}-{end}</b> of <b style={{ color: 'var(--ch-text)' }}>{total}</b></span>
            <label className="mono muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              Rows per page
              <select className="select-cp" value={limit} onChange={e => changeLimit(Number(e.target.value))} style={{ width: 84, height: 34, padding: '4px 8px' }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
          <div className="pagination-wrap">
            <button className="btn-cp" onClick={() => changePage(1)} disabled={page <= 1 || loading} style={{ height: 34, padding: '0 12px' }}>First</button>
            <button className="btn-cp" onClick={() => changePage(page - 1)} disabled={page <= 1 || loading} style={{ height: 34, padding: '0 12px' }}>Prev</button>
            {pageNumbers.map((p, i) => typeof p === 'number' ? (
              <button key={p} className={`btn-cp ${p === page ? 'primary' : ''}`} onClick={() => changePage(p)} disabled={loading} style={{ minWidth: 36, height: 34, padding: '0 10px' }}>{p}</button>
            ) : (
              <span key={`e-${i}`} className="mono muted" style={{ padding: '0 4px' }}>…</span>
            ))}
            <button className="btn-cp" onClick={() => changePage(page + 1)} disabled={page >= totalPages || loading} style={{ height: 34, padding: '0 12px' }}>Next</button>
            <button className="btn-cp" onClick={() => changePage(totalPages)} disabled={page >= totalPages || loading} style={{ height: 34, padding: '0 12px' }}>Last</button>
          </div>
        </div>
      </div>
    </div>
  );
}
