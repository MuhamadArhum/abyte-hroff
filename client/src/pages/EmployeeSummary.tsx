import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useUI } from '../contexts/UIContext';
import SearchSelect from '../components/SearchSelect';
import { Eye } from 'lucide-react';

function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EmployeeSummary() {
  const { toast } = useUI();
  const [data, setData] = useState<any>({ items: [], total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [jobType, setJobType] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [joiningFrom, setJoiningFrom] = useState(monthStartStr());
  const [joiningTo, setJoiningTo] = useState(todayStr());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number | 'all'>(10);
  const [rowsMode, setRowsMode] = useState<'preset' | 'custom' | 'all'>('preset');
  const [sortBy, setSortBy] = useState('employeeCode');
  const [sortOrder, setSortOrder] = useState('asc');
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
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, departmentId, designationId, jobType, employmentStatus, joiningFrom, joiningTo, page, limit, sortBy, sortOrder]);

  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setDepartmentId(''); setDesignationId(''); setJobType(''); setEmploymentStatus(''); setJoiningFrom(monthStartStr()); setJoiningTo(todayStr()); setPage(1);
  };

  const exportData = async (type: 'excel' | 'pdf') => {
    let url = '';
    try {
      const searching = search.trim().length > 0;
      const res = await api.get(`/reports/${type}`, { params: { employmentStatus: employmentStatus || undefined, jobType: jobType || undefined, departmentId: departmentId || undefined, designationId: designationId || undefined, joiningFrom: searching ? undefined : (joiningFrom || undefined), joiningTo: searching ? undefined : (joiningTo || undefined) }, responseType: 'blob' });
      const blob = new Blob([res.data]);
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = type === 'excel' ? `Abyte-EMS-Employee-Summary-${stamp}.xlsx` : `Abyte-EMS-Employee-Summary-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Export failed', 'error');
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const fmt = (d?: string | null) => d ? String(d).slice(0, 10) : '-';

  return <div>
    <div className="page-head-row">
      <div>
        <div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>Employee Summary</div>
        <div className="sub-mono">COMPLETE EMPLOYEE LIST · TABLE VIEW · EXPORTS</div>
      </div>
      <div className="flex gap-2 no-print">
        <button onClick={() => exportData('excel')} className="btn-cp">Export Excel</button>
        <button onClick={() => exportData('pdf')} className="btn-cp">Export PDF</button>
      </div>
    </div>

    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head"><span className="section-title">Filters & Search</span><span className="mono muted" style={{ fontSize: 11 }}>Total: {data.total ?? 0}</span></div>
      <div className="panel-body">
        <div className="filter-grid">
          <div style={{ gridColumn: 'span 2' }}><label className="label-mono">Search</label><input className="input-cp" placeholder="Code, name, CNIC, phone, email" value={searchInput} onChange={e => setSearchInput(e.target.value)} /></div>
          <div><label className="label-mono">Department</label><SearchSelect endpoint="/departments" labelKey="name" value={departmentId} onChange={v => { setPage(1); setDepartmentId(v); }} placeholder="Search department..." emptyLabel="All Departments" /></div>
          <div><label className="label-mono">Designation</label><SearchSelect endpoint="/designations" labelKey="title" value={designationId} onChange={v => { setPage(1); setDesignationId(v); }} placeholder="Search designation..." emptyLabel="All Designations" /></div>
          <div><label className="label-mono">Job Type</label><select className="select-cp" value={jobType} onChange={e => { setPage(1); setJobType(e.target.value); }}><option value="">All Job Types</option><option>PERMANENT</option><option>CONTRACT</option><option>TEMPORARY</option><option>INTERN</option></select></div>
          <div><label className="label-mono">Status</label><select className="select-cp" value={employmentStatus} onChange={e => { setPage(1); setEmploymentStatus(e.target.value); }}><option value="">All Status</option><option>ACTIVE</option><option>INACTIVE</option></select></div>
          <div><label className="label-mono">Joining From</label><input type="date" className="input-cp" value={joiningFrom} onChange={e => { setPage(1); setJoiningFrom(e.target.value); }} /></div>
          <div><label className="label-mono">Joining To</label><input type="date" className="input-cp" value={joiningTo} onChange={e => { setPage(1); setJoiningTo(e.target.value); }} /></div>
          <div><label className="label-mono">Sort By</label><select className="select-cp" value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="employeeCode">Code</option><option value="name">Name</option><option value="dateOfJoining">Joining</option><option value="employmentStatus">Status</option><option value="createdAt">Created</option><option value="updatedAt">Updated</option></select></div>
          <div><label className="label-mono">Order</label><select className="select-cp" value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option value="asc">Asc</option><option value="desc">Desc</option></select></div>
          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}><button onClick={()=>{setJoiningFrom(''); setJoiningTo(''); setPage(1);}} className="btn-cp">All Dates</button><button onClick={clearFilters} className="btn-cp">Clear Filters</button></div>
        </div>
      </div>
    </div>

    <div className="panel">
      <div className="panel-head"><span className="section-title">Employee Summary Table</span><span className="mono muted" style={{ fontSize: 11 }}>Page {page} / {data.totalPages || 1}{data.capped ? ` · showing first ${data.cap}` : ''}</span></div>
      {data.capped && <div className="mono" style={{ padding: '8px 20px', fontSize: 11, color: 'var(--amber-warn)', borderBottom: '1px solid var(--rule)' }}>Showing first {data.cap?.toLocaleString()} of {data.total?.toLocaleString()} employees (performance cap). Use filters/search or pagination to narrow results.</div>}
      <div className="table-scroll">
        <table className="data-table" style={{ minWidth: 1400 }}>
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Father Name</th><th>CNIC</th><th>DOB</th><th>Age</th><th>Gender</th><th>Phone</th><th>Email</th><th>City</th><th>Department</th><th>Designation</th><th>Job Type</th><th>Joining Date</th><th>Salary</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={17} style={{ padding: 24, textAlign: 'center' }} className="muted">Loading...</td></tr>}
            {!loading && data.items.map((e: any) => (
              <tr key={e.id}>
                <td className="mono" style={{ fontWeight: 600 }}>{e.employeeCode}</td>
                <td>{e.name}</td>
                <td>{e.fatherName || '-'}</td>
                <td className="mono">{e.cnic || '-'}</td>
                <td className="mono">{fmt(e.dateOfBirth)}</td>
                <td>{e.age ?? '-'}</td>
                <td>{e.gender || '-'}</td>
                <td className="mono">{e.mobileNumber || '-'}</td>
                <td>{e.email || '-'}</td>
                <td>{e.city || '-'}</td>
                <td>{e.department?.name || '-'}</td>
                <td>{e.designation?.title || '-'}</td>
                <td>{e.jobType || '-'}</td>
                <td className="mono">{fmt(e.dateOfJoining)}</td>
                <td className="mono">{e.salary ?? '-'}</td>
                <td><span className={`status-pill ${e.employmentStatus === 'ACTIVE' ? 'active' : 'inactive'}`}>{e.employmentStatus}</span></td>
                <td><div className="action-group"><Link to={`/employees/${e.id}`} className="row-action view" title="View"><Eye /> View</Link></div></td>
              </tr>
            ))}
            {!loading && data.items.length === 0 && <tr><td colSpan={17} style={{ padding: 32, textAlign: 'center' }} className="muted">No employees found. (Search ignores joining date filter; use "All Dates" for full list.)</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="panel-footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="mono muted" style={{ fontSize: 12 }}>Showing <b style={{ color: 'var(--ch-text)' }}>{data.total ? (limit === 'all' ? 1 : ((page - 1) * (limit as number) + 1)) : 0}-{limit === 'all' ? (data.total || 0) : Math.min(page * (limit as number), data.total || 0)}</b> of <b style={{ color: 'var(--ch-text)' }}>{data.total ?? 0}</b></div>
          <select className="select-cp" value={rowsMode === 'all' ? 'all' : rowsMode === 'custom' ? 'custom' : String(limit)} onChange={e=>{ const v = e.target.value; if (v === 'all') { setRowsMode('all'); setLimit('all'); setPage(1); } else if (v === 'custom') { setRowsMode('custom'); if (limit === 'all') setLimit(10); } else { setRowsMode('preset'); setPage(1); setLimit(Number(v)); } }} style={{ width: 120, height: 34, padding: '4px 8px' }}>
            <option value={10}>10 rows</option><option value={20}>20 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option><option value="all">All</option><option value="custom">Custom</option>
          </select>
          {rowsMode === 'custom' && <input type="number" min={1} max={100000} className="input-cp" value={limit === 'all' ? 10 : limit} onChange={e=>{ const n = Math.max(1, Math.min(100000, Number(e.target.value)||1)); setPage(1); setLimit(n); }} style={{ width: 90, height: 34, padding: '4px 8px' }} />}
        </div>
        <div className="pagination-wrap">
          {limit !== 'all' && <>
            <button disabled={page <= 1} onClick={() => setPage(1)} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>First</button>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Prev</button>
            <span className="mono muted" style={{ fontSize: 12, padding: '0 6px' }}>Page <b style={{ color: 'var(--ch-text)' }}>{page}</b> / {data.totalPages || 1}</span>
            <button disabled={page >= (data.totalPages || 1)} onClick={() => setPage(p => Math.min(data.totalPages || 1, p + 1))} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Next</button>
            <button disabled={page >= (data.totalPages || 1)} onClick={() => setPage(data.totalPages || 1)} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Last</button>
          </>}
        </div>
      </div>
    </div>
  </div>;
}
