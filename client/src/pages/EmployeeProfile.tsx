import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { storageUrl } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { Camera, Image as ImageIcon } from 'lucide-react';

const tabs = ['Personal & Contact','Job & Employment','Statutory & References','Employee Pictures','CNIC Documents','Father Picture','Other Pictures','Record History'];

function ImgCard({ img, onDelete, onReplaceFiles, onPreview, canWrite }: any) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  return <div className="panel" style={{ overflow: 'hidden' }}>
    <img src={storageUrl(img.relativePath)} onClick={()=>onPreview(storageUrl(img.relativePath), img.storedFilename)} style={{ width: '100%', height: 160, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
    <div style={{ padding: 10 }}>
      <div className="mono muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={img.storedFilename}>{img.storedFilename}</div>
      <div className="flex gap-3 mt-2 no-print" style={{ fontSize: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {canWrite && <>
          <button type="button" className="link-more" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={()=>camRef.current?.click()}>Camera</button>
          <button type="button" className="link-more" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={()=>galRef.current?.click()}>Gallery</button>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>{ if(e.target.files?.length) onReplaceFiles(e.target.files); e.target.value=''; }} />
          <input ref={galRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/*" className="hidden" onChange={e=>{ if(e.target.files?.length) onReplaceFiles(e.target.files); e.target.value=''; }} />
        </>}
        {canWrite && <button onClick={onDelete} style={{ color: 'var(--red-risk)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Delete</button>}
        <a href={storageUrl(img.relativePath)} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-soft)' }}>Open</a>
      </div>
    </div>
  </div>;
}

function UploadPicker({ label, multiple = false, disabled = false, onFiles }: { label?: string; multiple?: boolean; disabled?: boolean; onFiles: (files: FileList) => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  return <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    {label && <span className="mono muted" style={{ fontSize: 12, marginRight: 4 }}>{label}</span>}
    <button type="button" className="btn-cp" disabled={disabled} onClick={() => camRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px' }}>
      <Camera size={15} /> Camera
    </button>
    <button type="button" className="btn-cp primary" disabled={disabled} onClick={() => galRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px' }}>
      <ImageIcon size={15} /> Gallery
    </button>
    <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ''; }} />
    <input ref={galRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/*" multiple={multiple} className="hidden" onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ''; }} />
  </div>;
}

export default function EmployeeProfile() {
  const { canWrite } = useAuth();
  const { confirm, toast } = useUI();
  const { id } = useParams();
  const [emp, setEmp] = useState<any>(null);
  const [tab, setTab] = useState(0);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{url:string; title:string} | null>(null);
  const load = () => api.get(`/employees/${id}`)
    .then((r) => { setEmp(r.data); setLoadError(''); })
    .catch((e: any) => setLoadError(e?.response?.data?.message || 'Could not load this employee.'));
  useEffect(()=>{ load(); }, [id]);

  if (loadError) return <div className="panel"><div className="panel-body" style={{ color: 'var(--red-risk)' }}>{loadError}</div></div>;
  if (!emp) return <div className="panel"><div className="panel-body">Loading...</div></div>;
  const images = emp.images || [];
  const byCat = (c:string) => images.filter((i:any)=>i.imageCategory===c);
  const d = (v:any) => v ? String(v).slice(0,10) : '';

  const upload = async (category:string, files: FileList | null, replaceId?: number) => {
    if (!files || !files.length) return;
    setUploading(true); setMsg('Uploading image(s)...');
    const fd = new FormData();
    fd.append('category', category);
    if (replaceId) fd.append('replaceId', String(replaceId));
    Array.from(files).forEach(f => fd.append('files', f));
    try { await api.post(`/employees/${id}/images`, fd); setMsg('Upload completed'); load(); } catch(e:any){ setMsg(e.response?.data?.message || 'Upload failed'); } finally { setUploading(false); }
  };
  const delImg = async (imageId:number) => {
    if (!await confirm({ title: 'Delete Image', message: 'Delete this image?', confirmText: 'Delete', danger: true })) return;
    try { await api.delete(`/employees/images/${imageId}`); toast('Image deleted', 'success'); load(); }
    catch (e: any) { toast(e?.response?.data?.message || 'Delete failed', 'error'); }
  };
  const uploadDocs = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true); setMsg('Uploading documents...');
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    try { await api.post(`/employees/${id}/documents`, fd); setMsg('Documents uploaded'); load(); } catch(e:any){ setMsg(e.response?.data?.message || 'Document upload failed'); } finally { setUploading(false); }
  };
  const delDoc = async (docId:number) => {
    if (!await confirm({ title: 'Delete Document', message: 'Delete this document?', confirmText: 'Delete', danger: true })) return;
    try { await api.delete(`/employees/documents/${docId}`); toast('Document deleted', 'success'); load(); }
    catch (e: any) { toast(e?.response?.data?.message || 'Delete failed', 'error'); }
  };

  const profile = byCat('PROFILE')[0];
  const wide = (k: string) => ['Current Address','Permanent Address','Skills','Notes','Emergency Contact Address'].includes(k);
  const infoGrid = (items: [string, any][]) => (
    <div className="profile-info-grid">
      {items.map(([k, v]) => {
        const val = (v !== null && v !== undefined && v !== '') ? String(v) : '-';
        const isEmpty = val === '-';
        return (
          <div key={k as string} className={`profile-info-item ${wide(k as string) ? 'wide' : ''}`}>
            <div className="profile-info-label">{k}</div>
            <div className={`profile-info-value ${isEmpty ? 'empty' : ''}`}>{val}</div>
          </div>
        );
      })}
    </div>
  );

  return <div>
    <div className="page-head-row">
      <div className="flex gap-4 items-center">
        {profile ? <img src={storageUrl(profile.relativePath)} onClick={()=>setPreview({url: storageUrl(profile.relativePath), title: profile.storedFilename})} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--rule)', cursor: 'zoom-in' }} /> : <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--rule)' }}/>}
        <div>
          <div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>{emp.name}</div>
          <div className="sub-mono">{emp.employeeCode} · {emp.department?.name||'No Department'} · {emp.designation?.title||'No Designation'}</div>
          <div style={{ marginTop: 6 }}><span className={`status-pill ${emp.employmentStatus==='ACTIVE'?'active':'inactive'}`}>{emp.employmentStatus}</span></div>
        </div>
      </div>
      <div className="flex gap-2 no-print">
        {canWrite && <Link to={`/employees/${id}/edit`} className="btn-cp primary">Edit</Link>}
        <button onClick={()=>window.print()} className="btn-cp">Print</button>
        <Link to="/employees" className="btn-cp">Back</Link>
      </div>
    </div>

    {msg && <div className="panel no-print" style={{ marginBottom: 16 }}><div className="panel-body mono" style={{ fontSize: 12, color: 'var(--safety-orange-deep)', display: 'flex', alignItems: 'center', gap: 8 }}>{uploading && <span style={{ width: 14, height: 14, border: '2px solid var(--safety-orange)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}></span>}{msg}</div></div>}

    <div className="flex flex-wrap gap-2 mb-4 no-print">
      {tabs.map((t,i)=><button key={t} onClick={()=>setTab(i)} className={`btn-cp ${tab===i?'primary':''}`}>{t}</button>)}
    </div>

    <div className="panel profile-screen-panel no-print-screen-only">
      <div className="panel-head"><span className="section-title">{tabs[tab]}</span></div>
      <div className="panel-body">
        {tab===0 && <div>
          <div className="label-mono" style={{ marginBottom: 8 }}>Personal</div>
          <div className="info-section">
            {infoGrid([
              ['Employee Code', emp.employeeCode],['Name',emp.name],['Father Name',emp.fatherName],
              ['CNIC',emp.cnic],['CNIC Issue Date',d(emp.cnicIssueDate)],['CNIC Expiry Date',d(emp.cnicExpiryDate)],
              ['Date of Birth', d(emp.dateOfBirth)],['Age',emp.age],['Gender',emp.gender],['Blood Group',emp.bloodGroup],['Marital Status',emp.maritalStatus],['Religion',emp.religion],
            ])}
          </div>
          <div className="label-mono info-section-title" style={{ margin: '24px 0 10px' }}>Contact & Address</div>
          <div className="info-section">
            {infoGrid([
              ['Mobile',emp.mobileNumber],['Alternate / WhatsApp',emp.alternatePhone],['Personal Email',emp.personalEmail],
              ['City',emp.city],['Current Address',emp.address],['Permanent Address',emp.permanentAddress],
            ])}
          </div>
          <div className="label-mono info-section-title" style={{ margin: '24px 0 10px' }}>Emergency Contact</div>
          <div className="info-section">
            {infoGrid([['Emergency Contact Name',emp.emergencyContactName],['Emergency Contact No.',emp.emergencyContact],['Emergency Relation',emp.emergencyContactRelation],['Emergency Contact Address',emp.emergencyContactAddress]])}
          </div>
          <div className="label-mono info-section-title" style={{ margin: '24px 0 10px' }}>Education & Skills</div>
          <div className="info-section">
            {infoGrid([['Qualification',emp.qualification],['Skills',emp.skills]])}
          </div>
          <div style={{ marginTop: 24, borderTop: '1px solid var(--rule)', paddingTop: 18 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Employee Documents</div>
            {canWrite && <input type="file" multiple onChange={e=>uploadDocs(e.target.files)} disabled={uploading} className="no-print" style={{ fontSize: 13 }} />}
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {(emp.documents||[]).map((doc:any)=>(
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', padding: '10px 12px', background: '#fff' }}>
                  <a className="link-more" href={storageUrl(doc.relativePath)} target="_blank" rel="noreferrer">{doc.originalFilename}</a>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="mono muted" style={{ fontSize: 11 }}>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                    {canWrite && <button onClick={()=>delDoc(doc.id)} className="no-print" style={{ color: 'var(--red-risk)', background: 'none', border: 'none', padding: 0, fontSize: 12, cursor: 'pointer' }}>Delete</button>}
                  </div>
                </div>
              ))}
              {(!emp.documents || emp.documents.length===0) && <div className="muted">No documents uploaded.</div>}
            </div>
          </div>
        </div>}

        {tab===1 && <div className="info-section">{infoGrid([
          ['Department', emp.department?.name],['Designation',emp.designation?.title],['Job Type',emp.jobType],['Reporting Manager',emp.reportingManager],['Shift Timings',emp.shiftTimings],
          ['Date of Joining', d(emp.dateOfJoining)],['Resignation Date',d(emp.resignationDate)],['Last Working Date',d(emp.lastWorkingDate)],
          ['Salary',emp.salary],['Employment Status',emp.employmentStatus],['Employee Card Number',emp.employeeCardNumber],['Notes',emp.notes]
        ])}</div>}

        {tab===2 && <div className="info-section">{infoGrid([
          ['EOBI Number',emp.eobiNumber],['Social Security Number',emp.socialSecurityNumber],
          ['Reference Name',emp.referenceName],['Reference Contact',emp.referenceContact],['Reference Relation',emp.referenceRelation]
        ])}</div>}

        {tab===3 && <div>
          <div className="label-mono" style={{ marginBottom: 8 }}>Profile Picture</div>
          <div className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>Camera ya Gallery se picture add karein.</div>
          {canWrite && <UploadPicker disabled={uploading} onFiles={(files)=>upload('PROFILE', files, profile?.id)} />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 14 }}>{profile && <ImgCard img={profile} canWrite={canWrite} onPreview={(url:string,title:string)=>setPreview({url,title})} onDelete={()=>delImg(profile.id)} onReplaceFiles={(files:FileList)=>upload('PROFILE', files, profile.id)} />}</div>
        </div>}

        {tab===4 && <div className="grid-2col" style={{ marginBottom: 0 }}>
          {['CNIC_FRONT','CNIC_BACK'].map(cat=>{ const img = byCat(cat)[0]; return <div key={cat}>
            <div className="label-mono" style={{ marginBottom: 8 }}>{cat.replace('_',' ')}</div>
            <div className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>Select an image using Camera or Gallery.</div>
            {canWrite && <UploadPicker disabled={uploading} onFiles={(files)=>upload(cat, files, img?.id)} />}
            <div style={{ marginTop: 14 }}>{img ? <ImgCard img={img} canWrite={canWrite} onPreview={(url:string,title:string)=>setPreview({url,title})} onDelete={()=>delImg(img.id)} onReplaceFiles={(files:FileList)=>upload(cat, files, img.id)} /> : <div className="muted" style={{ marginTop: 8 }}>No image uploaded.</div>}</div>
          </div>; })}
        </div>}

        {tab===5 && <div>
          <div className="label-mono" style={{ marginBottom: 8 }}>Father Picture</div>
          {(()=>{const img=byCat('FATHER')[0]; return <>
            <div className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>Add a picture using Camera or Gallery.</div>
            {canWrite && <UploadPicker disabled={uploading} onFiles={(files)=>upload('FATHER', files, img?.id)} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 14 }}>{img ? <ImgCard img={img} canWrite={canWrite} onPreview={(url:string,title:string)=>setPreview({url,title})} onDelete={()=>delImg(img.id)} onReplaceFiles={(files:FileList)=>upload('FATHER', files, img.id)} /> : <div className="muted">No image uploaded.</div>}</div>
          </>;})()}
        </div>}

        {tab===6 && <div>
          <div className="label-mono" style={{ marginBottom: 8 }}>Other Pictures (multiple)</div>
          <div className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>Add one or more pictures using Camera or Gallery.</div>
          {canWrite && <UploadPicker multiple disabled={uploading} onFiles={(files)=>upload('OTHER', files)} />}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 14 }}>
            {byCat('OTHER').map((img:any)=><ImgCard key={img.id} img={img} canWrite={canWrite} onPreview={(url:string,title:string)=>setPreview({url,title})} onDelete={()=>delImg(img.id)} onReplaceFiles={(files:FileList)=>upload('OTHER', files, img.id)} />)}
            {byCat('OTHER').length===0 && <div className="muted">No other pictures uploaded.</div>}
          </div>
        </div>}

        {tab===7 && <div>
          {(emp.history||[]).length===0 ? <div className="muted">No history records.</div> : (
            <ul className="list-clean">
              {(emp.history||[]).map((h:any)=>(
                <li key={h.id} className="list-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{h.action}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{h.details || '-'}</div>
                    {h.performedByUsername && <div className="mono muted" style={{ fontSize: 10, marginTop: 4 }}>by {h.performedByUsername}</div>}
                  </div>
                  <div className="mono muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(h.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>}
      </div>
    </div>

    {/* Print-only comprehensive profile */}
    <div className="print-only profile-print-only" style={{ display: 'none' }}>
      <div style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ fontSize: 18, marginBottom: 2 }}>Employee Profile — {emp.name}</div>
        <div className="mono muted" style={{ fontSize: 10 }}>{emp.employeeCode} · {emp.department?.name||'No Department'} · {emp.designation?.title||'No Designation'} · {emp.employmentStatus}</div>
      </div>
      <div className="panel" style={{ marginBottom: 10 }}><div className="panel-head"><span className="section-title">Personal & Contact</span></div><div className="panel-body">
        {infoGrid([
          ['Employee Code', emp.employeeCode],['Name',emp.name],['Father Name',emp.fatherName],['CNIC',emp.cnic],['CNIC Issue Date',d(emp.cnicIssueDate)],['CNIC Expiry Date',d(emp.cnicExpiryDate)],
          ['Date of Birth', d(emp.dateOfBirth)],['Age',emp.age],['Gender',emp.gender],['Blood Group',emp.bloodGroup],['Marital Status',emp.maritalStatus],['Religion',emp.religion],
          ['Mobile',emp.mobileNumber],['Alternate / WhatsApp',emp.alternatePhone],['Personal Email',emp.personalEmail],['City',emp.city],['Current Address',emp.address],['Permanent Address',emp.permanentAddress],
          ['Emergency Contact Name',emp.emergencyContactName],['Emergency Contact No.',emp.emergencyContact],['Emergency Relation',emp.emergencyContactRelation],['Emergency Contact Address',emp.emergencyContactAddress],
          ['Qualification',emp.qualification],['Skills',emp.skills]
        ])}
      </div></div>
      <div className="panel" style={{ marginBottom: 10 }}><div className="panel-head"><span className="section-title">Job & Employment</span></div><div className="panel-body">
        {infoGrid([
          ['Department', emp.department?.name],['Designation',emp.designation?.title],['Job Type',emp.jobType],['Reporting Manager',emp.reportingManager],['Shift Timings',emp.shiftTimings],
          ['Date of Joining', d(emp.dateOfJoining)],['Resignation Date',d(emp.resignationDate)],['Last Working Date',d(emp.lastWorkingDate)],
          ['Salary',emp.salary],['Employment Status',emp.employmentStatus],['Employee Card Number',emp.employeeCardNumber],['Notes',emp.notes]
        ])}
      </div></div>
      <div className="panel" style={{ marginBottom: 10 }}><div className="panel-head"><span className="section-title">Statutory & References</span></div><div className="panel-body">
        {infoGrid([['EOBI Number',emp.eobiNumber],['Social Security Number',emp.socialSecurityNumber],['Reference Name',emp.referenceName],['Reference Contact',emp.referenceContact],['Reference Relation',emp.referenceRelation]])}
      </div></div>
      {(emp.documents||[]).length > 0 && <div className="panel" style={{ marginBottom: 10 }}><div className="panel-head"><span className="section-title">Documents</span></div><div className="panel-body">
        <ul className="list-clean">{emp.documents.map((doc:any)=>(<li key={doc.id} className="list-row"><span>{doc.originalFilename}</span><span className="mono muted" style={{fontSize:10}}>{new Date(doc.uploadDate).toLocaleDateString()}</span></li>))}</ul>
      </div></div>}
      <div className="mono muted" style={{ fontSize: 9, marginTop: 6 }}>Printed from Abyte-EMS on {new Date().toLocaleString()}</div>
    </div>

    {preview && <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,30,33,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }} onClick={()=>setPreview(null)}>
      <div style={{ maxWidth: 1000, width: '100%' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', marginBottom: 8 }}>
          <div className="mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.title}</div>
          <button className="btn-cp" style={{ padding: '4px 10px' }} onClick={()=>setPreview(null)}>Close</button>
        </div>
        <img src={preview.url} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', background: '#000', borderRadius: 'var(--radius)' }} />
      </div>
    </div>}
  </div>;
}
