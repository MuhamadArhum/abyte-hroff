import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useUI } from '../contexts/UIContext';
import SearchSelect from '../components/SearchSelect';

function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Reports() {
  const { toast } = useUI();
  const [status, setStatus] = useState(''); const [jobType, setJobType] = useState(''); const [departmentId, setDepartmentId] = useState(''); const [designationId, setDesignationId] = useState('');
  const [joiningFrom, setJoiningFrom] = useState(monthStartStr()); const [joiningTo, setJoiningTo] = useState(todayStr()); const [reportType, setReportType] = useState('');
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState<number | null>(null); const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false); const [msg, setMsg] = useState('');
  const [page, setPage] = useState(1); const [limit, setLimit] = useState<number | 'all'>(25);
  const [rowsMode, setRowsMode] = useState<'preset' | 'custom' | 'all'>('preset');
  const [hasLoaded, setHasLoaded] = useState(false);

  const filterParams = { employmentStatus: status || undefined, jobType: jobType || undefined, departmentId: departmentId || undefined, designationId: designationId || undefined, joiningFrom: joiningFrom || undefined, joiningTo: joiningTo || undefined, reportType: reportType || undefined };

  const fetchPreview = async (p = page, l = limit) => {
    setLoading(true); setMsg('');
    try {
      const res = await api.get('/reports/preview', { params: { ...filterParams, page: p, limit: l } });
      const items = res.data.items || [];
      setRows(items);
      setTotal(res.data.total ?? 0);
      setTotalPages(res.data.totalPages ?? 1);
      setPage(res.data.page ?? p);
      setHasLoaded(true);
      if (items.length === 0) setMsg('No records found for selected filters.');
      else if (res.data.capped) setMsg(`Showing first ${items.length.toLocaleString()} of ${(res.data.total ?? 0).toLocaleString()} records (performance cap). Use Excel/PDF export for full filtered data.`);
      else setMsg('');
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Failed to load report data');
      setRows([]); setTotal(0); setTotalPages(1); setHasLoaded(true);
    } finally { setLoading(false); }
  };

  const viewReport = () => {
    // Pagination changes are handled by the effect below; avoid a duplicate request.
    if (page === 1) void fetchPreview(1, limit);
    else setPage(1);
  };

  useEffect(() => { if (hasLoaded) fetchPreview(page, limit); }, [page, limit]);

  const download = async (type: 'excel'|'pdf') => {
    let url = '';
    try {
      const res = await api.get(`/reports/${type}`, { params: filterParams, responseType: 'blob' });
      const blob = new Blob([res.data]);
      url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = type === 'excel' ? `Abyte-EMS-Employees-${stamp}.xlsx` : `Abyte-EMS-Employees-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast(`${type.toUpperCase()} export started`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Export failed', 'error');
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const clearFilters = () => {
    setStatus(''); setJobType(''); setDepartmentId(''); setDesignationId(''); setJoiningFrom(monthStartStr()); setJoiningTo(todayStr()); setReportType('');
    setRows([]); setTotal(null); setTotalPages(1); setMsg(''); setPage(1); setHasLoaded(false);
  };

  const pagedRows = rows; // server-paginated
  const effectiveLimitNum = limit === 'all' ? (rows.length || 1) : (limit as number);
  const safePage = page;

  return <div>
    <div className="page-head-row">
      <div><div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>Reports & Exports</div><div className="sub-mono">FILTER · PREVIEW · EXPORT · PRINT</div></div>
    </div>
    <div className="print-only" style={{ display: 'none', marginBottom: 10 }}>
      <div className="section-title" style={{ fontSize: 18, marginBottom: 2 }}>Abyte-EMS — Employee Report</div>
      <div className="mono muted" style={{ fontSize: 10 }}>Generated: {new Date().toLocaleString()} &nbsp;|&nbsp; Records: {total ?? rows.length}</div>
      <div className="mono muted" style={{ fontSize: 10, marginTop: 2 }}>Filters: {status||'All Status'} · {jobType||'All Job Types'} · Dept: {departmentId || 'All'} · Desig: {designationId || 'All'} · Joining: {joiningFrom||'...'} to {joiningTo||'...'}</div>
    </div>

    <div className="panel no-print" style={{ marginBottom: 20 }}>
      <div className="panel-head"><span className="section-title">Report Filters</span><span className="mono muted" style={{ fontSize: 11 }}>{total !== null ? `Loaded: ${total}` : 'No data loaded'}</span></div>
      <div className="panel-body">
        <div className="filter-grid">
          <div><label className="label-mono" htmlFor="report-type">Status</label><select id="report-type" className="select-cp" value={reportType} onChange={e=>{ setReportType(e.target.value); setStatus(''); }}><option value="">All Employees</option><option value="ACTIVE">Active Employees</option><option value="INACTIVE">Inactive Employees</option></select></div>
          <div><label className="label-mono">Job Type</label><select className="select-cp" value={jobType} onChange={e=>setJobType(e.target.value)}><option value="">All Job Types</option><option value="PERMANENT">Permanent</option><option value="CONTRACT">Contract</option><option value="TEMPORARY">Temporary</option><option value="INTERN">Intern</option></select></div>
          <div><label className="label-mono">Department</label><SearchSelect endpoint="/departments" labelKey="name" value={departmentId} onChange={v=>{ setDepartmentId(v); }} placeholder="Search department..." emptyLabel="All Departments" /></div>
          <div><label className="label-mono">Designation</label><SearchSelect endpoint="/designations" labelKey="title" value={designationId} onChange={v=>{ setDesignationId(v); }} placeholder="Search designation..." emptyLabel="All Designations" /></div>
          <div><label className="label-mono">Joining From</label><input type="date" className="input-cp" value={joiningFrom} onChange={e=>setJoiningFrom(e.target.value)} /></div>
          <div><label className="label-mono">Joining To</label><input type="date" className="input-cp" value={joiningTo} onChange={e=>setJoiningTo(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={viewReport} className="btn-cp dark">View</button>
            <button onClick={()=>download('excel')} className="btn-cp primary">Excel</button>
            <button onClick={()=>download('pdf')} className="btn-cp">PDF</button>
            <button onClick={clearFilters} className="btn-cp">Clear</button>
            <button onClick={()=>window.print()} className="btn-cp">Print</button>
          </div>
        </div>
        {msg && <div className="mono" style={{ marginTop: 12, fontSize: 11, color: 'var(--amber-warn)' }}>{msg}</div>}
      </div>
    </div>

    <div className="panel" style={{ overflow: 'hidden' }}>
      <div className="panel-head"><span className="section-title">Employee Report Data</span>{total !== null && <span className="mono muted" style={{ fontSize: 11 }}>Records: {total}</span>}</div>
      <div className="table-scroll no-print-keep">
        <table className="data-table report-screen-table" style={{ minWidth: 1300 }}>
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Father Name</th><th>CNIC</th><th>DOB</th><th>Age</th><th>Gender</th><th>Mobile</th><th>Email</th><th>Department</th><th>Designation</th><th>Job Type</th><th>Joining</th><th>Salary</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center' }} className="muted">Loading report data...</td></tr>}
            {!loading && pagedRows.map((e:any) => (
              <tr key={e.id}>
                <td className="mono" style={{ fontWeight: 600 }}>{e.employeeCode}</td>
                <td>{e.name}</td>
                <td>{e.fatherName || '-'}</td>
                <td className="mono">{e.cnic || '-'}</td>
                <td className="mono">{e.dateOfBirth || '-'}</td>
                <td>{e.age ?? '-'}</td>
                <td>{e.gender || '-'}</td>
                <td className="mono">{e.mobileNumber || '-'}</td>
                <td>{e.email || '-'}</td>
                <td>{e.department || '-'}</td>
                <td>{e.designation || '-'}</td>
                <td>{e.jobType || '-'}</td>
                <td className="mono">{e.dateOfJoining || '-'}</td>
                <td className="mono">{e.salary ?? '-'}</td>
                <td><span className={`status-pill ${e.employmentStatus==='ACTIVE'?'active':'inactive'}`}>{e.employmentStatus || '-'}</span></td>
              </tr>
            ))}
            {!loading && total === null && <tr><td colSpan={15} style={{ padding: 32, textAlign: 'center' }} className="muted">Select filters and click <b>View</b> to load data.</td></tr>}
            {!loading && total !== null && rows.length === 0 && <tr><td colSpan={15} style={{ padding: 32, textAlign: 'center' }} className="muted">No records found for selected filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Print-only: all loaded rows */}
      {rows.length > 0 && <div className="print-only" style={{ display: 'none' }}>
        <table className="data-table" style={{ width: '100%', fontSize: 10 }}>
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Father Name</th><th>CNIC</th><th>DOB</th><th>Age</th><th>Gender</th><th>Mobile</th><th>Email</th><th>Department</th><th>Designation</th><th>Job Type</th><th>Joining</th><th>Salary</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e:any) => (
              <tr key={`p-${e.id}`}>
                <td className="mono" style={{ fontWeight: 600 }}>{e.employeeCode}</td>
                <td>{e.name}</td>
                <td>{e.fatherName || '-'}</td>
                <td className="mono">{e.cnic || '-'}</td>
                <td className="mono">{e.dateOfBirth || '-'}</td>
                <td>{e.age ?? '-'}</td>
                <td>{e.gender || '-'}</td>
                <td className="mono">{e.mobileNumber || '-'}</td>
                <td>{e.email || '-'}</td>
                <td>{e.department || '-'}</td>
                <td>{e.designation || '-'}</td>
                <td>{e.jobType || '-'}</td>
                <td className="mono">{e.dateOfJoining || '-'}</td>
                <td className="mono">{e.salary ?? '-'}</td>
                <td>{e.employmentStatus || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {(hasLoaded || rows.length > 0) && <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--rule)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="mono muted" style={{ fontSize: 11 }}>Showing {total ? (limit === 'all' ? 1 : ((safePage - 1) * effectiveLimitNum + 1)) : 0}-{limit === 'all' ? (rows.length) : Math.min(safePage * effectiveLimitNum, total || 0)} of {total ?? 0}</div>
          <select className="select-cp" value={rowsMode === 'all' ? 'all' : rowsMode === 'custom' ? 'custom' : String(limit)} onChange={e=>{
            const v = e.target.value;
            if (v === 'all') { setRowsMode('all'); setLimit('all'); setPage(1); }
            else if (v === 'custom') { setRowsMode('custom'); if (limit === 'all') setLimit(25); }
            else { setRowsMode('preset'); setLimit(Number(v)); setPage(1); }
          }} style={{ width: 120, padding: '6px 8px' }}>
            <option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option><option value={200}>200 rows</option><option value="all">All (cap 1000)</option><option value="custom">Custom</option>
          </select>
          {rowsMode === 'custom' && <input type="number" min={1} max={1000} className="input-cp" value={limit === 'all' ? 25 : limit} onChange={e=>{ const n = Math.max(1, Math.min(1000, Number(e.target.value)||1)); setPage(1); setLimit(n); }} style={{ width: 90, padding: '6px 8px' }} />}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {limit !== 'all' && <>
            <button disabled={safePage<=1 || loading} onClick={()=>setPage(1)} className="btn-cp" style={{ padding: '6px 10px' }}>First</button>
            <button disabled={safePage<=1 || loading} onClick={()=>setPage(p=>Math.max(1,p-1))} className="btn-cp" style={{ padding: '6px 10px' }}>Prev</button>
            <span className="mono muted" style={{ fontSize: 11 }}>Page {safePage} / {totalPages || 1}</span>
            <button disabled={safePage>= (totalPages||1) || loading} onClick={()=>setPage(p=>Math.min(totalPages||1,p+1))} className="btn-cp" style={{ padding: '6px 10px' }}>Next</button>
            <button disabled={safePage>= (totalPages||1) || loading} onClick={()=>setPage(totalPages||1)} className="btn-cp" style={{ padding: '6px 10px' }}>Last</button>
          </>}
        </div>
      </div>}
    </div>
  </div>;
}
