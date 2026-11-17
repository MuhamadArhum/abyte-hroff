import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { storageUrl } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import SearchSelect from '../components/SearchSelect';
import { useUI } from '../contexts/UIContext';
import { Eye, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';

function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Employees() {
  const { canWrite } = useAuth();
  const { toast, confirm } = useUI();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>({ items: [], total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || ''); const [search, setSearch] = useState(searchParams.get('search') || '');
  const [departmentId, setDepartmentId] = useState(searchParams.get('departmentId') || ''); const [designationId, setDesignationId] = useState(searchParams.get('designationId') || '');
  const [jobType, setJobType] = useState(searchParams.get('jobType') || ''); const [employmentStatus, setEmploymentStatus] = useState(searchParams.get('employmentStatus') || searchParams.get('status') || '');
  const [joiningFrom, setJoiningFrom] = useState(searchParams.get('joiningFrom') ?? monthStartStr()); const [joiningTo, setJoiningTo] = useState(searchParams.get('joiningTo') ?? todayStr());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number | 'all'>(10);
  const [rowsMode, setRowsMode] = useState<'preset' | 'custom' | 'all'>('preset');
  const [sortBy, setSortBy] = useState('createdAt'); const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const load = async () => {
    setLoading(true);
    try {
      const searching = search.length > 0;
      const r = await api.get('/employees', { params: { search, departmentId, designationId, jobType, employmentStatus, joiningFrom: searching ? undefined : joiningFrom, joiningTo: searching ? undefined : joiningTo, page, limit, sortBy, sortOrder } });
      setData(r.data);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Failed to load employees', 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [search, departmentId, designationId, jobType, employmentStatus, joiningFrom, joiningTo, page, limit, sortBy, sortOrder]);
  const clearFilters = () => { setSearchInput(''); setSearch(''); setDepartmentId(''); setDesignationId(''); setJobType(''); setEmploymentStatus(''); setJoiningFrom(monthStartStr()); setJoiningTo(todayStr()); setPage(1); };

  const del = async (id: number) => {
    const ok = await confirm({ title: 'Delete Employee', message: 'Delete employee and all associated images/documents?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try { await api.delete(`/employees/${id}`); toast('Employee deleted', 'success'); load(); } catch (e: any) { toast(e?.response?.data?.message || 'Delete failed', 'error'); }
  };
  const toggle = async (e: any) => {
    const isActive = e.employmentStatus === 'ACTIVE';
    const ok = await confirm({
      title: isActive ? 'Deactivate Employee' : 'Activate Employee',
      message: isActive ? `Are you sure you want to deactivate "${e.name}"?` : `Are you sure you want to activate "${e.name}"?`,
      confirmText: 'Yes',
      cancelText: 'No',
      danger: isActive,
    });
    if (!ok) return;
    try { await api.patch(`/employees/${e.id}/status`); toast(`Employee ${isActive ? 'deactivated' : 'activated'}`, 'success'); load(); } catch (ex: any) { toast(ex?.response?.data?.message || 'Status update failed', 'error'); }
  };
  const exportData = async (type: 'excel'|'pdf') => {
    try {
      const searching = search.trim().length > 0;
      const res = await api.get(`/reports/${type}`, { params: { employmentStatus: employmentStatus || undefined, jobType: jobType || undefined, departmentId: departmentId || undefined, designationId: designationId || undefined, joiningFrom: searching ? undefined : (joiningFrom || undefined), joiningTo: searching ? undefined : (joiningTo || undefined) }, responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = type === 'excel' ? `Abyte-EMS-Employees-${stamp}.xlsx` : `Abyte-EMS-Employees-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`${type.toUpperCase()} export started`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Export failed', 'error');
    }
  };

  return <div>
    <div className="page-head-row">
      <div><div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>Employees</div><div className="sub-mono">EMPLOYEE RECORDS · SEARCH · MANAGE</div></div>
      {canWrite && <Link to="/employees/new" className="btn-cp primary">Add Employee</Link>}
    </div>

    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><span className="section-title">Filters & Search</span><span className="mono muted" style={{ fontSize: 11 }}>Results: {data.total ?? 0}</span></div>
      <div className="panel-body">
        <div className="filter-grid">
          <div style={{ gridColumn: 'span 2' }}><label className="label-mono">Search</label><input className="input-cp" placeholder="Code, name, CNIC, phone, email" value={searchInput} onChange={e=>setSearchInput(e.target.value)} /></div>
          <div><label className="label-mono">Department</label><SearchSelect endpoint="/departments" labelKey="name" value={departmentId} onChange={v=>{setPage(1);setDepartmentId(v)}} placeholder="Search department..." emptyLabel="All Departments" /></div>
          <div><label className="label-mono">Designation</label><SearchSelect endpoint="/designations" labelKey="title" value={designationId} onChange={v=>{setPage(1);setDesignationId(v)}} placeholder="Search designation..." emptyLabel="All Designations" /></div>
          <div><label className="label-mono">Job Type</label><select className="select-cp" value={jobType} onChange={e=>{setPage(1);setJobType(e.target.value)}}><option value="">All Job Types</option><option>PERMANENT</option><option>CONTRACT</option><option>TEMPORARY</option><option>INTERN</option></select></div>
          <div><label className="label-mono">Status</label><select className="select-cp" value={employmentStatus} onChange={e=>{setPage(1);setEmploymentStatus(e.target.value)}}><option value="">All Status</option><option>ACTIVE</option><option>INACTIVE</option></select></div>
          <div><label className="label-mono">Joining From</label><input type="date" className="input-cp" value={joiningFrom} onChange={e=>{setPage(1);setJoiningFrom(e.target.value)}} /></div>
          <div><label className="label-mono">Joining To</label><input type="date" className="input-cp" value={joiningTo} onChange={e=>{setPage(1);setJoiningTo(e.target.value)}} /></div>
          <div><label className="label-mono">Sort By</label><select className="select-cp" value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="name">Name</option><option value="employeeCode">Code</option><option value="dateOfJoining">Joining</option><option value="employmentStatus">Status</option></select></div>
          <div><label className="label-mono">Order</label><select className="select-cp" value={sortOrder} onChange={e=>setSortOrder(e.target.value)}><option value="desc">Desc</option><option value="asc">Asc</option></select></div>
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={()=>{setJoiningFrom(''); setJoiningTo(''); setPage(1);}} className="btn-cp">All Dates</button>
            <button onClick={clearFilters} className="btn-cp">Clear Filters</button>
            <button onClick={()=>exportData('excel')} className="btn-cp">Export Excel</button>
            <button onClick={()=>exportData('pdf')} className="btn-cp">Export PDF</button>
          </div>
        </div>
      </div>
    </div>

    <div className="panel">
      <div className="panel-head"><span className="section-title">Employee List</span><span className="mono muted" style={{ fontSize: 11 }}>Page {page} / {data.totalPages || 1}{data.capped ? ` · showing first ${data.cap}` : ''}</span></div>
      {data.capped && <div className="mono" style={{ padding: '10px 20px', fontSize: 12, color: 'var(--amber-warn)', borderBottom: '1px solid var(--ch-border)', background: '#fffaf5' }}>Showing first {data.cap?.toLocaleString()} of {data.total?.toLocaleString()} employees (performance cap). Use filters/search or pagination to narrow results.</div>}
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Photo</th><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center' }} className="muted">Loading...</td></tr>}
            {!loading && data.items.map((e:any)=>{ const pic = e.images?.[0]?.relativePath; return <tr key={e.id}>
              <td>{pic ? <img src={storageUrl(pic)} onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).parentElement?.querySelector('.img-fallback')?.classList.remove('hidden-fallback'); }} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}/> : null}{!pic ? <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--rule)' }}/> : <div className="img-fallback hidden-fallback" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--rule)' }} />}</td>
              <td className="mono" style={{ fontWeight: 600 }}>{e.employeeCode}</td>
              <td>{e.name}</td>
              <td>{e.department?.name||'-'}</td>
              <td>{e.designation?.title||'-'}</td>
              <td><span className={`status-pill ${e.employmentStatus==='ACTIVE'?'active':'inactive'}`}>{e.employmentStatus}</span></td>
              <td>
                <div className="action-group">
                  <Link to={`/employees/${e.id}`} className="row-action view" title="View"><Eye /> View</Link>
                  {canWrite && <>
                    <Link to={`/employees/${e.id}/edit`} className="row-action edit" title="Edit"><Pencil /> Edit</Link>
                    <button onClick={()=>toggle(e)} className={`row-action ${e.employmentStatus==='ACTIVE' ? 'warn' : 'success'}`} title={e.employmentStatus==='ACTIVE'?'Deactivate':'Activate'}>{e.employmentStatus==='ACTIVE' ? <UserX /> : <UserCheck />} {e.employmentStatus==='ACTIVE'?'Deactivate':'Activate'}</button>
                    <button onClick={()=>del(e.id)} className="row-action danger" title="Delete"><Trash2 /> Delete</button>
                  </>}
                </div>
              </td>
            </tr>;})}
            {!loading && data.items.length===0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center' }} className="muted">No employees found. Try adjusting search or filters (search ignores joining date filter; use "All Dates" for full list).</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="panel-footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="mono muted" style={{ fontSize: 12 }}>Showing <b style={{ color: 'var(--ch-text)' }}>{data.total ? (limit === 'all' ? 1 : ((page - 1) * (limit as number) + 1)) : 0}-{limit === 'all' ? (data.total || 0) : Math.min(page * (limit as number), data.total || 0)}</b> of <b style={{ color: 'var(--ch-text)' }}>{data.total ?? 0}</b></div>
          <select className="select-cp" value={rowsMode === 'all' ? 'all' : rowsMode === 'custom' ? 'custom' : String(limit)} onChange={e=>{
            const v = e.target.value;
            if (v === 'all') { setRowsMode('all'); setLimit('all'); setPage(1); }
            else if (v === 'custom') { setRowsMode('custom'); if (limit === 'all') setLimit(10); }
            else { setRowsMode('preset'); setPage(1); setLimit(Number(v)); }
          }} style={{ width: 120, height: 34, padding: '4px 8px' }}>
            <option value={10}>10 rows</option><option value={20}>20 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option><option value="all">All</option><option value="custom">Custom</option>
          </select>
          {rowsMode === 'custom' && <input type="number" min={1} max={100000} className="input-cp" value={limit === 'all' ? 10 : limit} onChange={e=>{ const n = Math.max(1, Math.min(100000, Number(e.target.value)||1)); setPage(1); setLimit(n); }} style={{ width: 90, height: 34, padding: '4px 8px' }} />}
        </div>
        <div className="pagination-wrap">
          {limit !== 'all' && <>
            <button disabled={page<=1} onClick={()=>setPage(1)} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>First</button>
            <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Prev</button>
            <span className="mono muted" style={{ fontSize: 12, padding: '0 6px' }}>Page <b style={{ color: 'var(--ch-text)' }}>{page}</b> / {data.totalPages||1}</span>
            <button disabled={page>=data.totalPages} onClick={()=>setPage(p=>p+1)} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Next</button>
            <button disabled={page>=data.totalPages} onClick={()=>setPage(data.totalPages||1)} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Last</button>
          </>}
        </div>
      </div>
    </div>
  </div>;
}
