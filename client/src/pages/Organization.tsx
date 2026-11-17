import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';

function DepartmentsTab() {
  const { canWrite } = useAuth();
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [status, setStatus] = useState('ACTIVE'); const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null); const [search, setSearch] = useState(''); const [msg, setMsg] = useState('');
  const [page, setPage] = useState(1); const [limit, setLimit] = useState(10); const [rowsMode, setRowsMode] = useState<'preset' | 'custom'>('preset');
  const load = () => api.get('/departments', { params: { search } }).then(r => { setItems(r.data); setPage(1); }).catch((e: any) => toast(e?.response?.data?.message || 'Failed to load departments', 'error'));
  useEffect(() => { load(); }, [search]);
  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedItems = items.slice((safePage - 1) * limit, safePage * limit);
  const submit = async (e: any) => {
    e.preventDefault(); setMsg('');
    try {
      if (editing) { await api.put(`/departments/${editing.id}`, { name, description, status }); toast('Department updated', 'success'); }
      else { await api.post('/departments', { name, description, status }); toast('Department created', 'success'); }
      setName(''); setDescription(''); setStatus('ACTIVE'); setEditing(null); load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Failed'); toast(err.response?.data?.message || 'Failed', 'error'); }
  };
  const edit = (d: any) => { setEditing(d); setName(d.name); setDescription(d.description || ''); setStatus(d.status || 'ACTIVE'); };
  const view = async (id: number) => { try { const r = await api.get(`/departments/${id}`); setViewing(r.data); } catch (err: any) { toast(err.response?.data?.message || 'Failed to load department', 'error'); } };
  const del = async (id: number) => {
    const ok = await confirm({ title: 'Delete Department', message: 'Delete this department?', confirmText: 'Yes', cancelText: 'No', danger: true });
    if (!ok) return; setMsg('');
    try { await api.delete(`/departments/${id}`); toast('Department deleted', 'success'); load(); if (viewing?.id === id) setViewing(null); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Delete failed'); toast(err.response?.data?.message || 'Delete failed', 'error'); }
  };
  return <div>
    {msg && <div className="mono" style={{ marginBottom: 12, fontSize: 11, color: 'var(--red-risk)' }}>{msg}</div>}
    {canWrite && <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head"><span className="section-title">{editing ? 'Edit Department' : 'Add Department'}</span></div>
      <div className="panel-body">
        <form onSubmit={submit} className="filter-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          <div><label className="label-mono">Name</label><input className="input-cp" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required /></div>
          <div><label className="label-mono">Description</label><input className="input-cp" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div><label className="label-mono">Status</label><select className="select-cp" value={status} onChange={e => setStatus(e.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button className="btn-cp primary">{editing ? 'Update' : 'Add'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setName(''); setDescription(''); setStatus('ACTIVE'); }} className="btn-cp">Cancel</button>}
          </div>
        </form>
      </div>
    </div>}
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-body" style={{ padding: 12 }}><input className="input-cp" style={{ maxWidth: 320 }} placeholder="Search departments..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
    </div>
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head"><span className="section-title">Departments List</span><span className="mono muted" style={{ fontSize: 11 }}>{items.length} records</span></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Description</th><th>Status</th><th>Employees</th><th>Actions</th></tr></thead><tbody>
        {pagedItems.map(d => <tr key={d.id}><td style={{ fontWeight: 600 }}>{d.name}</td><td>{d.description || '-'}</td><td><span className={`status-pill ${(d.status || 'ACTIVE') === 'ACTIVE' ? 'active' : 'inactive'}`}>{d.status || 'ACTIVE'}</span></td><td className="mono">{d.employeeCount ?? d._count?.employees ?? 0}</td><td><div className="action-group"><button onClick={() => view(d.id)} className="row-action view" title="View"><Eye /> View</button>{canWrite && <><button onClick={() => edit(d)} className="row-action edit" title="Edit"><Pencil /> Edit</button><button onClick={() => del(d.id)} className="row-action danger" title="Delete"><Trash2 /> Delete</button></>}</div></td></tr>)}
        {items.length === 0 && <tr><td colSpan={5} className="empty-cell">No departments found.</td></tr>}
      </tbody></table></div>
      {items.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--rule)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="mono muted" style={{ fontSize: 11 }}>Showing {((safePage - 1) * limit + 1)}-{Math.min(safePage * limit, items.length)} of {items.length}</div>
          <select className="select-cp" value={rowsMode === 'custom' ? 'custom' : String(limit)} onChange={e => { const v = e.target.value; if (v === 'custom') setRowsMode('custom'); else { setRowsMode('preset'); setPage(1); setLimit(Number(v)); } }} style={{ width: 110, padding: '6px 8px' }}><option value={10}>10 rows</option><option value={20}>20 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option><option value="custom">Custom</option></select>
          {rowsMode === 'custom' && <input type="number" min={1} max={500} className="input-cp" value={limit} onChange={e => { const n = Math.max(1, Math.min(500, Number(e.target.value) || 1)); setPage(1); setLimit(n); }} style={{ width: 80, padding: '6px 8px' }} />}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button disabled={safePage <= 1} onClick={() => setPage(1)} className="btn-cp" style={{ padding: '6px 10px' }}>First</button>
          <button disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-cp" style={{ padding: '6px 10px' }}>Prev</button>
          <span className="mono muted" style={{ fontSize: 11 }}>Page {safePage} / {totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn-cp" style={{ padding: '6px 10px' }}>Next</button>
          <button disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} className="btn-cp" style={{ padding: '6px 10px' }}>Last</button>
        </div>
      </div>}
    </div>
    {viewing && <div className="panel">
      <div className="panel-head"><span className="section-title">Department: {viewing.name} — Employees ({viewing.employees?.length || 0})</span><button onClick={() => setViewing(null)} className="btn-cp" style={{ padding: '4px 10px' }}>Close</button></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Action</th></tr></thead><tbody>{(viewing.employees || []).map((e: any) => <tr key={e.id}><td className="mono">{e.employeeCode}</td><td>{e.name}</td><td><span className={`status-pill ${e.employmentStatus === 'ACTIVE' ? 'active' : 'inactive'}`}>{e.employmentStatus}</span></td><td><div className="action-group"><Link className="row-action view" to={`/employees/${e.id}`} title="Open"><Eye /> Open</Link></div></td></tr>)}{(!viewing.employees || viewing.employees.length === 0) && <tr><td colSpan={4} className="empty-cell">No employees in this department.</td></tr>}</tbody></table></div>
    </div>}
  </div>;
}

function DesignationsTab() {
  const { canWrite } = useAuth();
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState(''); const [msg, setMsg] = useState('');
  const [page, setPage] = useState(1); const [limit, setLimit] = useState(10); const [rowsMode, setRowsMode] = useState<'preset' | 'custom'>('preset');
  const load = () => api.get('/designations', { params: { search } }).then(r => { setItems(r.data); setPage(1); }).catch((e: any) => toast(e?.response?.data?.message || 'Failed to load designations', 'error'));
  useEffect(() => { load(); }, [search]);
  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedItems = items.slice((safePage - 1) * limit, safePage * limit);
  const submit = async (e: any) => {
    e.preventDefault(); setMsg('');
    try {
      if (editing) { await api.put(`/designations/${editing.id}`, { title, description }); toast('Designation updated', 'success'); }
      else { await api.post('/designations', { title, description }); toast('Designation created', 'success'); }
      setTitle(''); setDescription(''); setEditing(null); load();
    } catch (err: any) { setMsg(err.response?.data?.message || 'Failed'); toast(err.response?.data?.message || 'Failed', 'error'); }
  };
  const edit = (d: any) => { setEditing(d); setTitle(d.title); setDescription(d.description || ''); };
  const del = async (id: number) => {
    const ok = await confirm({ title: 'Delete Designation', message: 'Delete this designation?', confirmText: 'Yes', cancelText: 'No', danger: true });
    if (!ok) return;
    try { await api.delete(`/designations/${id}`); toast('Designation deleted', 'success'); load(); }
    catch (err: any) { setMsg(err.response?.data?.message || 'Delete failed'); toast(err.response?.data?.message || 'Delete failed', 'error'); }
  };
  return <div>
    {msg && <div className="mono" style={{ marginBottom: 12, fontSize: 11, color: 'var(--red-risk)' }}>{msg}</div>}
    {canWrite && <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head"><span className="section-title">{editing ? 'Edit Designation' : 'Add Designation'}</span></div>
      <div className="panel-body">
        <form onSubmit={submit} className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <div><label className="label-mono">Title</label><input className="input-cp" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required /></div>
          <div><label className="label-mono">Description</label><input className="input-cp" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button className="btn-cp primary">{editing ? 'Update' : 'Add'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setTitle(''); setDescription(''); }} className="btn-cp">Cancel</button>}
          </div>
        </form>
      </div>
    </div>}
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-body" style={{ padding: 12 }}><input className="input-cp" style={{ maxWidth: 320 }} placeholder="Search designations..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
    </div>
    <div className="panel">
      <div className="panel-head"><span className="section-title">Designations List</span><span className="mono muted" style={{ fontSize: 11 }}>{items.length} records</span></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Title</th><th>Description</th><th>Employees</th><th>Actions</th></tr></thead><tbody>
        {pagedItems.map(d => <tr key={d.id}><td style={{ fontWeight: 600 }}>{d.title}</td><td>{d.description || '-'}</td><td className="mono">{d._count?.employees ?? 0}</td><td><div className="action-group">{canWrite && <><button onClick={() => edit(d)} className="row-action edit" title="Edit"><Pencil /> Edit</button><button onClick={() => del(d.id)} className="row-action danger" title="Delete"><Trash2 /> Delete</button></>}</div></td></tr>)}
        {items.length === 0 && <tr><td colSpan={4} className="empty-cell">No designations found.</td></tr>}
      </tbody></table></div>
      {items.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--rule)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="mono muted" style={{ fontSize: 11 }}>Showing {((safePage - 1) * limit + 1)}-{Math.min(safePage * limit, items.length)} of {items.length}</div>
          <select className="select-cp" value={rowsMode === 'custom' ? 'custom' : String(limit)} onChange={e => { const v = e.target.value; if (v === 'custom') setRowsMode('custom'); else { setRowsMode('preset'); setPage(1); setLimit(Number(v)); } }} style={{ width: 110, padding: '6px 8px' }}><option value={10}>10 rows</option><option value={20}>20 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option><option value="custom">Custom</option></select>
          {rowsMode === 'custom' && <input type="number" min={1} max={500} className="input-cp" value={limit} onChange={e => { const n = Math.max(1, Math.min(500, Number(e.target.value) || 1)); setPage(1); setLimit(n); }} style={{ width: 80, padding: '6px 8px' }} />}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button disabled={safePage <= 1} onClick={() => setPage(1)} className="btn-cp" style={{ padding: '6px 10px' }}>First</button>
          <button disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-cp" style={{ padding: '6px 10px' }}>Prev</button>
          <span className="mono muted" style={{ fontSize: 11 }}>Page {safePage} / {totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn-cp" style={{ padding: '6px 10px' }}>Next</button>
          <button disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} className="btn-cp" style={{ padding: '6px 10px' }}>Last</button>
        </div>
      </div>}
    </div>
  </div>;
}

export default function Organization() {
  const location = useLocation();
  const initial = location.pathname.includes('designation') ? 1 : 0;
  const [tab, setTab] = useState(initial);
  useEffect(() => { setTab(location.pathname.includes('designation') ? 1 : 0); }, [location.pathname]);

  return <div>
    <div className="page-head-row">
      <div><div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>Departments & Designations</div><div className="sub-mono">ORGANIZATION STRUCTURE — MANAGEMENT</div></div>
    </div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button onClick={() => setTab(0)} className={`btn-cp ${tab === 0 ? 'primary' : ''}`}>Departments</button>
      <button onClick={() => setTab(1)} className={`btn-cp ${tab === 1 ? 'primary' : ''}`}>Designations</button>
    </div>
    {tab === 0 ? <DepartmentsTab /> : <DesignationsTab />}
  </div>;
}
