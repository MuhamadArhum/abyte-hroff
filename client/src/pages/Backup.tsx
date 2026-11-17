import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useUI } from '../contexts/UIContext';
import { RotateCcw, Trash2 } from 'lucide-react';

export default function Backup() {
  const { confirm, toast } = useUI();
  const [logs, setLogs] = useState<any[]>([]); const [msg, setMsg] = useState('');
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [autoTime, setAutoTime] = useState('02:00');
  const [settingsMsg, setSettingsMsg] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [rowsMode, setRowsMode] = useState<'preset' | 'custom'>('preset');

  const load = () => api.get('/backup/history')
    .then((r) => { setLogs(r.data); setPage(1); })
    .catch((e: any) => toast(e?.response?.data?.message || 'Failed to load backup history', 'error'));
  const loadSettings = () => api.get('/settings/backup').then(r => {
    setAutoEnabled(!!r.data.autoBackupEnabled);
    setAutoTime(r.data.autoBackupTime || '02:00');
  }).catch(() => toast('Failed to load backup settings', 'error'));
  useEffect(()=>{ load(); loadSettings(); }, []);

  const create = async () => { setMsg('Creating backup...'); try { const r = await api.post('/backup/create'); setMsg(r.data.message); load(); } catch(e:any){ setMsg(e.response?.data?.message || 'Backup failed'); } };
  const restore = async (filename:string) => { if(!await confirm({ title:'Restore Backup', message:`Restore ${filename}? This will overwrite current data. Restart the server after restore.`, confirmText:'Restore', danger:true })) return; setMsg('Restoring...'); try { const r = await api.post('/backup/restore',{filename}); setMsg(r.data.message); } catch(e:any){ setMsg(e.response?.data?.message || 'Restore failed'); } };
  const del = async (filename:string) => { if(!await confirm({ title:'Delete Backup', message:`Delete backup ${filename}?`, confirmText:'Delete', danger:true })) return; try { await api.delete(`/backup/${encodeURIComponent(filename)}`); setMsg('Backup deleted'); load(); } catch(e:any){ setMsg(e.response?.data?.message || 'Delete failed'); } };
  const saveSettings = async (e:any) => {
    e.preventDefault(); setSettingsMsg('');
    try {
      const r = await api.put('/settings/backup', { autoBackupEnabled: autoEnabled, autoBackupTime: autoTime });
      setSettingsMsg(r.data.message || 'Settings saved');
    } catch(err:any){ setSettingsMsg(err.response?.data?.message || 'Failed to save settings'); }
  };

  const totalPages = Math.max(1, Math.ceil(logs.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedLogs = logs.slice((safePage - 1) * limit, safePage * limit);

  return <div>
    <div className="page-head-row">
      <div><div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>Backup & Restore</div><div className="sub-mono">LOCAL DATABASE · IMAGES · DOCUMENTS</div></div>
      <button onClick={create} className="btn-cp primary">Create Manual Backup</button>
    </div>

    <div className="grid-2col">
      <div className="panel">
        <div className="panel-head"><span className="section-title">Automatic Backup Schedule</span></div>
        <div className="panel-body">
          <form onSubmit={saveSettings} style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <input type="checkbox" checked={autoEnabled} onChange={e=>setAutoEnabled(e.target.checked)} />
              Enable automatic backup
            </label>
            <div>
              <label className="label-mono">Daily Backup Time (24-hour)</label>
              <input type="time" className="input-cp" value={autoTime} onChange={e=>setAutoTime(e.target.value)} required style={{ maxWidth: 220 }} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-cp dark">Save Schedule</button>
              {settingsMsg && <span className="mono" style={{ fontSize: 11, color: 'var(--green-ok)' }}>{settingsMsg}</span>}
            </div>
          </form>
          <div className="mono muted" style={{ fontSize: 11, marginTop: 14 }}>System user-specified time par daily automatic backup create karega (app/server running honi chahiye).</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><span className="section-title">Backup Status</span></div>
        <div className="panel-body">
          <ul className="list-clean">
            <li className="list-row"><span className="mono muted" style={{ fontSize: 11 }}>MODE</span><span>{autoEnabled ? `Daily at ${autoTime}` : 'Disabled'}</span></li>
            <li className="list-row"><span className="mono muted" style={{ fontSize: 11 }}>INCLUDES</span><span>SQLite DB + All Image/Document Folders</span></li>
            <li className="list-row"><span className="mono muted" style={{ fontSize: 11 }}>TOTAL HISTORY</span><span>{logs.length}</span></li>
          </ul>
          {msg && <div className="mono" style={{ fontSize: 11, color: 'var(--green-ok)', marginTop: 12 }}>{msg}</div>}
        </div>
      </div>
    </div>

    <div className="panel">
      <div className="panel-head"><span className="section-title">Backup History</span><span className="mono muted" style={{ fontSize: 11 }}>{logs.length} records</span></div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>File</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {pagedLogs.map(l=> <tr key={l.id}>
              <td className="mono">{new Date(l.createdAt).toLocaleString()}</td>
              <td><span className={`status-pill ${l.type==='AUTOMATIC'?'at-risk': l.type==='RESTORE'?'inactive':'active'}`}>{l.type}</span></td>
              <td className="mono" style={{ fontSize: 11 }}>{l.filePath}</td>
              <td><span className={`status-pill ${l.status==='SUCCESS'?'active':'delayed'}`}>{l.status}</span></td>
              <td>
                <div className="action-group">
                  {l.status==='SUCCESS' && l.type!=='RESTORE' && <button onClick={()=>restore(l.filePath)} className="row-action edit" title="Restore"><RotateCcw /> Restore</button>}
                  {l.filePath && <button onClick={()=>del(l.filePath)} className="row-action danger" title="Delete"><Trash2 /> Delete</button>}
                </div>
              </td>
            </tr>)}
            {logs.length===0 && <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center' }} className="muted">No backups yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {logs.length > 0 && <div className="panel-footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="mono muted" style={{ fontSize: 12 }}>Showing <b style={{ color: 'var(--ch-text)' }}>{logs.length ? ((safePage - 1) * limit + 1) : 0}-{Math.min(safePage * limit, logs.length)}</b> of <b style={{ color: 'var(--ch-text)' }}>{logs.length}</b></div>
          <select className="select-cp" value={rowsMode === 'custom' ? 'custom' : String(limit)} onChange={e=>{ const v = e.target.value; if (v === 'custom') setRowsMode('custom'); else { setRowsMode('preset'); setPage(1); setLimit(Number(v)); } }} style={{ width: 120, height: 34, padding: '4px 8px' }}>
            <option value={10}>10 rows</option><option value={20}>20 rows</option><option value={50}>50 rows</option><option value={100}>100 rows</option><option value="custom">Custom</option>
          </select>
          {rowsMode === 'custom' && <input type="number" min={1} max={500} className="input-cp" value={limit} onChange={e=>{ const n = Math.max(1, Math.min(500, Number(e.target.value)||1)); setPage(1); setLimit(n); }} style={{ width: 90, height: 34, padding: '4px 8px' }} />}
        </div>
        <div className="pagination-wrap">
          <button disabled={safePage<=1} onClick={()=>setPage(1)} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>First</button>
          <button disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Prev</button>
          <span className="mono muted" style={{ fontSize: 12, padding: '0 6px' }}>Page <b style={{ color: 'var(--ch-text)' }}>{safePage}</b> / {totalPages}</span>
          <button disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Next</button>
          <button disabled={safePage>=totalPages} onClick={()=>setPage(totalPages)} className="btn-cp" style={{ height: 34, padding: '0 12px' }}>Last</button>
        </div>
      </div>}
    </div>
  </div>;
}
