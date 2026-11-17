import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import SearchSelect from '../components/SearchSelect';

const initial = {
  employeeCode: '', name: '', fatherName: '',
  cnic: '', cnicIssueDate: '', cnicExpiryDate: '', dateOfBirth: '',
  gender: '', bloodGroup: '', maritalStatus: '', religion: '',
  mobileNumber: '', alternatePhone: '', personalEmail: '',
  address: '', permanentAddress: '', city: '',
  emergencyContact: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactAddress: '',
  qualification: '', skills: '',
  departmentId: '', designationId: '', reportingManager: '', shiftTimings: '', jobType: '', dateOfJoining: '',
  resignationDate: '', lastWorkingDate: '', salary: '', employmentStatus: 'ACTIVE', employeeCardNumber: '',
  eobiNumber: '', socialSecurityNumber: '',
  referenceName: '', referenceContact: '', referenceRelation: '', notes: ''
};

const dateKeys = ['cnicIssueDate','cnicExpiryDate','dateOfBirth','dateOfJoining','resignationDate','lastWorkingDate'];

function calcAge(dob: string) {
  if (!dob) return '';
  const d = new Date(dob); if (isNaN(d.getTime())) return '';
  const t = new Date(); let age = t.getFullYear() - d.getFullYear(); const m = t.getMonth()-d.getMonth();
  if (m<0 || (m===0 && t.getDate()<d.getDate())) age--; return age;
}
function toDateInput(v: any) { return v ? String(v).slice(0,10) : ''; }

export default function EmployeeForm() {
  const { id } = useParams(); const nav = useNavigate(); const isEdit = !!id;
  const [form, setForm] = useState<any>(initial); const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) api.get(`/employees/${id}`).then(r => {
      const e = r.data || {};
      const next: any = { ...initial };
      Object.keys(initial).forEach((k) => {
        const v = (e as any)[k];
        next[k] = v === null || v === undefined ? '' : v;
      });
      dateKeys.forEach(k => next[k] = toDateInput(e[k]));
      next.departmentId = e.departmentId ? String(e.departmentId) : '';
      next.designationId = e.designationId ? String(e.designationId) : '';
      next.salary = e.salary ?? '';
      setForm(next);
    }).catch(() => setErr('Could not load employee details.'));
  }, [id]);

  const set = (k:string,v:any)=> setForm((f:any)=>({...f,[k]:v}));
  const submit = async (e:any) => {
    e.preventDefault();
    if (saving) return;
    setErr(''); setSaving(true);
    try {
      const payload: any = { ...form, departmentId: form.departmentId||null, designationId: form.designationId||null };
      if (isEdit) await api.put(`/employees/${id}`, payload); else await api.post('/employees', payload);
      nav('/employees');
    } catch (ex:any) {
      const issues = ex?.response?.data?.issues;
      if (Array.isArray(issues) && issues.length) {
        setErr(`${ex.response?.data?.message || 'Validation failed'}: ${issues.map((i: any) => `${i.field} - ${i.message}`).join('; ')}`);
      } else {
        setErr(ex.response?.data?.message || 'Save failed');
      }
    } finally { setSaving(false); }
  };

  const age = calcAge(form.dateOfBirth);
  const I = (k:string,label:string,props:any={}) => <div><label className="label-mono">{label}</label><input className="input-cp" value={form[k] ?? ''} onChange={e=>set(k,e.target.value)} {...props} /></div>;
  const D = (k:string,label:string) => <div><label className="label-mono">{label}</label><input type="date" className="input-cp" value={form[k] ?? ''} onChange={e=>set(k,e.target.value)} /></div>;
  const T = (k:string,label:string,rows=3,span=3) => <div style={{ gridColumn: `span ${span}` }}><label className="label-mono">{label}</label><textarea className="textarea-cp" rows={rows} value={form[k] ?? ''} onChange={e=>set(k,e.target.value)} /></div>;

  return <div>
    <div className="page-head-row">
      <div>
        <div className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>{isEdit ? 'Edit Employee' : 'Add New Employee'}</div>
        <div className="sub-mono">{isEdit ? 'UPDATE EMPLOYEE RECORD' : 'CREATE EMPLOYEE RECORD'}</div>
      </div>
      <button type="button" onClick={()=>nav('/employees')} className="btn-cp">Back to Employees</button>
    </div>
    {err && <div className="panel" style={{ marginBottom: 16, borderColor: 'rgba(194,59,46,0.3)' }}><div className="panel-body" style={{ color: 'var(--red-risk)' }}>{err}</div></div>}
    <form onSubmit={submit}>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><span className="section-title">Personal Information</span></div>
        <div className="panel-body"><div className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {I('employeeCode','Employee Code',{placeholder:'Auto-generated if empty'})}
          <div><label className="label-mono">Employee Name *</label><input required className="input-cp" value={form.name} onChange={e=>set('name',e.target.value)} /></div>
          {I('fatherName','Father Name')}
          {I('cnic','CNIC Number')}{D('cnicIssueDate','CNIC Issue Date')}{D('cnicExpiryDate','CNIC Expiry Date')}
          {D('dateOfBirth','Date of Birth')}
          <div><label className="label-mono">Age (auto)</label><input className="input-cp" value={age} readOnly style={{ background: 'var(--paper)' }} /></div>
          <div><label className="label-mono">Gender</label><select className="select-cp" value={form.gender} onChange={e=>set('gender',e.target.value)}><option value="">Select</option><option>MALE</option><option>FEMALE</option><option>OTHER</option></select></div>
          <div><label className="label-mono">Blood Group</label><select className="select-cp" value={form.bloodGroup} onChange={e=>set('bloodGroup',e.target.value)}><option value="">Select</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div>
          <div><label className="label-mono">Marital Status</label><select className="select-cp" value={form.maritalStatus} onChange={e=>set('maritalStatus',e.target.value)}><option value="">Select</option><option>SINGLE</option><option>MARRIED</option><option>DIVORCED</option><option>WIDOWED</option></select></div>
          <div><label className="label-mono">Religion</label><select className="select-cp" value={form.religion} onChange={e=>set('religion',e.target.value)}><option value="">Select</option><option>Islam</option><option>Christianity</option><option>Hinduism</option><option>Sikhism</option><option>Buddhism</option><option>Other</option></select></div>
        </div></div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><span className="section-title">Contact & Address</span></div>
        <div className="panel-body"><div className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {I('mobileNumber','Mobile Number')}{I('alternatePhone','Alternate / WhatsApp')}{I('personalEmail','Personal Email',{type:'email'})}
          {I('city','City')}
          <div style={{ gridColumn: 'span 2' }}><label className="label-mono">Current Address</label><input className="input-cp" value={form.address} onChange={e=>set('address',e.target.value)} /></div>
          <div style={{ gridColumn: 'span 3' }}><label className="label-mono">Permanent Address</label><input className="input-cp" value={form.permanentAddress} onChange={e=>set('permanentAddress',e.target.value)} /></div>
        </div></div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><span className="section-title">Emergency Contact</span></div>
        <div className="panel-body"><div className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {I('emergencyContactName','Emergency Contact Name')}{I('emergencyContact','Emergency Contact Number')}{I('emergencyContactRelation','Relation')}
          <div style={{ gridColumn: 'span 3' }}><label className="label-mono">Emergency Contact Address</label><input className="input-cp" value={form.emergencyContactAddress} onChange={e=>set('emergencyContactAddress',e.target.value)} /></div>
        </div></div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><span className="section-title">Education & Skills</span></div>
        <div className="panel-body"><div className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {I('qualification','Qualification')}
          {T('skills','Skills',3,3)}
        </div></div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><span className="section-title">Job Information</span></div>
        <div className="panel-body"><div className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <div><label className="label-mono">Department</label><SearchSelect endpoint="/departments" labelKey="name" value={String(form.departmentId || '')} onChange={v=>set('departmentId',v)} placeholder="Search department..." emptyLabel="Select" allowEmpty /></div>
          <div><label className="label-mono">Designation</label><SearchSelect endpoint="/designations" labelKey="title" value={String(form.designationId || '')} onChange={v=>set('designationId',v)} placeholder="Search designation..." emptyLabel="Select" allowEmpty /></div>
          <div><label className="label-mono">Job Type</label><select className="select-cp" value={form.jobType} onChange={e=>set('jobType',e.target.value)}><option value="">Select</option><option>PERMANENT</option><option>CONTRACT</option><option>TEMPORARY</option><option>INTERN</option></select></div>
          {I('reportingManager','Reporting Manager')}{I('shiftTimings','Shift Timings')}
          {D('dateOfJoining','Date of Joining')}{D('resignationDate','Resignation Date')}{D('lastWorkingDate','Last Working Date')}
          <div><label className="label-mono">Salary</label><input type="number" className="input-cp" value={form.salary} onChange={e=>set('salary',e.target.value)} /></div>
          <div><label className="label-mono">Employment Status</label><select className="select-cp" value={form.employmentStatus} onChange={e=>set('employmentStatus',e.target.value)}><option>ACTIVE</option><option>INACTIVE</option></select></div>
          {I('employeeCardNumber','Employee Card Number')}
          {T('notes','Notes',4,3)}
        </div></div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><span className="section-title">Statutory & References</span></div>
        <div className="panel-body"><div className="filter-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {I('eobiNumber','EOBI Number')}{I('socialSecurityNumber','Social Security Number')}
          {I('referenceName','Reference Name')}{I('referenceContact','Reference Contact')}{I('referenceRelation','Reference Relation')}
        </div></div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn-cp primary" disabled={saving}>{saving ? 'Saving...' : (isEdit ? 'Update' : 'Create')} Employee</button>
        <button type="button" onClick={()=>nav('/employees')} className="btn-cp">Cancel</button>
        <span className="mono muted" style={{ fontSize: 11 }}>All fields are optional except Employee Name. Pictures and documents can be managed from the employee profile after saving.</span>
      </div>
    </form>
  </div>;
}
