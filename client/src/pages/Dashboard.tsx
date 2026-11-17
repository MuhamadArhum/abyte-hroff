import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { Users, UserCheck, UserX, Building2, Briefcase, ArrowUpRight } from 'lucide-react';

function GaugeChart({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  const data = [
    { name: 'value', value: v },
    { name: 'rest', value: 100 - v },
  ];
  return (
    <div style={{ position: 'relative', width: '100%', height: 170 }}>
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie data={data} dataKey="value" startAngle={180} endAngle={0} cx="50%" cy="85%" innerRadius={58} outerRadius={78} paddingAngle={0} stroke="none" isAnimationActive animationDuration={1200}>
            <Cell fill={color} />
            <Cell fill="#eef1f7" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#2b335e', lineHeight: 1, fontFamily: 'Comfortaa, cursive' }}>{v}%</div>
        <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>Performance</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get('/dashboard')
      .then(r => { if (mounted) setStats(r.data); })
      .catch(e => { if (mounted) setError(e?.response?.data?.message || 'Failed to load dashboard'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const deptData = useMemo(() => (stats?.departmentStats || []).slice(0, 8).map((d: any) => ({ name: d.name, count: d.count })), [stats]);
  const mainChartData = useMemo(() => {
    const base = deptData.length ? deptData : [{ name: 'No Data', count: 0 }];
    return base.map((d: any, i: number, arr: any[]) => {
      const prev = arr[i - 1]?.count ?? d.count;
      const next = arr[i + 1]?.count ?? d.count;
      const trend = Math.round((d.count + prev + next) / 3);
      return { ...d, trend };
    });
  }, [deptData]);
  const trendData = useMemo(() => stats?.hiringResignationTrend || [], [stats]);
  const activeRate = useMemo(() => stats?.totalEmployees ? Math.round((stats.activeEmployees / stats.totalEmployees) * 100) : 0, [stats]);
  const inactiveRate = Math.max(0, 100 - activeRate);

  if (loading) {
    return (
      <div className="ch-dashboard">
        <div className="ch-chart-header"><div className="skeleton-block" style={{ height: 220, borderRadius: 12, background: 'rgba(255,255,255,0.08)' }} /></div>
        <div className="row ch-row">
          {[1,2,3].map(i => <div key={i} className="col-xl-4 col-lg-6 col-md-12"><div className="card pull-up"><div className="card-body" style={{height:180}} /></div></div>)}
        </div>
      </div>
    );
  }
  if (error) return <div className="card"><div className="card-body" style={{ color: '#f74b5c' }}>{error}</div></div>;
  if (!stats) return null;

  const statCards = [
    { label: 'Total Employees', value: stats.totalEmployees, icon: Users, color: '#fa626b', cls: 'danger', to: '/employees', sub: 'All workforce records', data: deptData },
    { label: 'Active Employees', value: stats.activeEmployees, icon: UserCheck, color: '#1e9ff2', cls: 'info', to: '/employees?employmentStatus=ACTIVE', sub: `${activeRate}% of total workforce`, data: deptData.map((d: any) => ({ name: d.name, count: Math.max(0, Math.round((d.count || 0) * (activeRate / 100 || 0))) })) },
    { label: 'Inactive Employees', value: stats.inactiveEmployees, icon: UserX, color: '#ff9149', cls: 'warning', to: '/employees?employmentStatus=INACTIVE', sub: `${inactiveRate}% of total workforce`, data: deptData.map((d: any) => ({ name: d.name, count: Math.max(0, Math.round((d.count || 0) * (inactiveRate / 100 || 0))) })) },
  ];

  const recentAdded = stats.recentAdded || [];
  const recentUpdated = stats.recentUpdated || [];
  const jobTypes = stats.jobTypeStats || [];
  const topDeptShare = (() => {
    const depts = stats?.departmentStats || [];
    const total = Number(stats?.totalEmployees || 0);
    if (!depts.length || !total) return 0;
    const max = Math.max(...depts.map((d: any) => Number(d.count || 0)));
    return Math.round((max / total) * 100);
  })();

  const gauges = [
    { label: 'Active Workforce', value: activeRate, color: '#28d094', note: `${Number(stats.activeEmployees || 0).toLocaleString()} active employees` },
    { label: 'Inactive Workforce', value: inactiveRate, color: '#fa626b', note: `${Number(stats.inactiveEmployees || 0).toLocaleString()} inactive employees` },
    { label: 'Top Dept. Share', value: topDeptShare, color: '#1e9ff2', note: 'Largest department of total workforce' },
  ];

  return (
    <div className="ch-dashboard">
      {/* Top gradient line chart area (Chameleon default) */}
      <div className="row ch-row ch-chart-header">
        <div className="col-12">
          <div>
            <div id="gradient-line-chart1" className="GradientlineShadow1 ch-chart-surface" style={{ height: 290 }}>
              <ResponsiveContainer width="100%" height={290}>
                <LineChart data={mainChartData} margin={{ top: 24, right: 26, left: -6, bottom: 36 }}>
                  <defs>
                    <linearGradient id="lineA" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#28d094" />
                      <stop offset="50%" stopColor="#1e9ff2" />
                      <stop offset="100%" stopColor="#6967ce" />
                    </linearGradient>
                    <linearGradient id="lineB" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ff9149" />
                      <stop offset="100%" stopColor="#fa626b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.10)" strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} interval={0} dy={8} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'dataMax + 2']} />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(30,36,61,0.97)', color: '#fff', boxShadow: '0 16px 36px rgba(0,0,0,0.3)', padding: '10px 14px' }}
                    labelStyle={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Employees"
                    stroke="url(#lineA)"
                    strokeWidth={4}
                    dot={{ r: 4, fill: '#262d47', stroke: '#1e9ff2', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#28d094', stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={1800}
                    animationEasing="ease-in-out"
                  />
                  <Line
                    type="basis"
                    dataKey="trend"
                    name="Trend"
                    stroke="url(#lineB)"
                    strokeWidth={3}
                    strokeDasharray="8 6"
                    dot={false}
                    activeDot={{ r: 5, fill: '#ff9149', stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationBegin={300}
                    animationDuration={2000}
                    animationEasing="ease-in-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* eCommerce statistic cards */}
      <div className="row ch-row">
        {statCards.map((c, idx) => {
          const Icon = c.icon;
          const mini = c.data.length ? c.data.slice(0, 8) : [{ name: '-', count: 0 }];
          return (
            <div key={c.label} className={idx === 2 ? 'col-xl-4 col-lg-12' : 'col-xl-4 col-lg-6 col-md-12'}>
              <Link to={c.to} className="card pull-up ecom-card-1 bg-white text-decoration-none ch-ecom-card">
                <div className="card-content ecom-card2">
                  <div className="ch-ecom-top">
                    <h5 className={`ch-ecom-title ${c.cls}`}>{c.label}</h5>
                    <span className={`ch-ecom-icon-wrap ${c.cls}`}><Icon size={26} /></span>
                  </div>
                  <div className="ch-ecom-metric">
                    <div className="ch-ecom-number" style={{ color: c.color }}>{Number(c.value || 0).toLocaleString()}</div>
                    <div className="ch-ecom-sub">{c.sub}</div>
                  </div>
                  <div className="progress-stats-container ch-progress-stats">
                    <div className="ch-mini-layer">
                      <ResponsiveContainer width="100%" height={64}>
                        <BarChart data={mini} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
                          <Bar dataKey="count" fill="#eef0f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="ch-mini-layer ch-mini-line-layer">
                      <ResponsiveContainer width="100%" height={64}>
                        <AreaChart data={mini} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={c.color} />
                              <stop offset="100%" stopColor={c.color} stopOpacity={0.75} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="count" stroke={`url(#grad-${idx})`} strokeWidth={4} fill="transparent" dot={false} activeDot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Performance speedometer charts */}
      <div className="row ch-row">
        {gauges.map((g) => (
          <div key={g.label} className="col-xl-4 col-lg-6 col-md-12">
            <div className="card h-100">
              <div className="card-header ch-card-header">
                <h4 className="card-title">{g.label}</h4>
                <span className="ch-badge" style={{ background: `${g.color}22`, color: g.color }}>{g.value}%</span>
              </div>
              <div className="card-content">
                <div className="card-body" style={{ paddingTop: 8, paddingBottom: 12 }}>
                  <GaugeChart value={g.value} color={g.color} />
                  <div className="mono muted" style={{ textAlign: 'center', fontSize: 12, marginTop: -4 }}>{g.note}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insights row */}
      <div className="row ch-row match-height">
        <div className="col-xl-6 col-lg-12">
          <div className="card h-100">
            <div className="card-header ch-card-header"><h4 className="card-title">Hiring vs Resignation Trend</h4><span className="mono muted" style={{ fontSize: 11 }}>Last 6 months</span></div>
            <div className="card-content"><div className="card-body" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData.length ? trendData : [{ month: '-', joined: 0, resigned: 0 }]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#e9edf5" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#6b6f82', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b6f82', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e7ed' }} />
                  <Legend />
                  <Bar dataKey="joined" name="Joined" fill="#28d094" radius={[6,6,0,0]} maxBarSize={28} />
                  <Bar dataKey="resigned" name="Resigned" fill="#fa626b" radius={[6,6,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div></div>
          </div>
        </div>
        <div className="col-xl-6 col-lg-12">
          <div className="card h-100">
            <div className="card-header ch-card-header"><h4 className="card-title">Department-wise Employees</h4><span className="ch-badge">{activeRate}% Active</span></div>
            <div className="card-content"><div className="card-body" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={(stats.departmentStats || []).slice(0, 8).map((d: any) => ({ name: d.name, count: d.count }))} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#e9edf5" strokeDasharray="3 5" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6b6f82', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#404e67', fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e7ed' }} cursor={{ fill: 'rgba(105,103,206,0.06)' }} />
                  <Bar dataKey="count" name="Employees" fill="#6967ce" radius={[0,8,8,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div></div>
          </div>
        </div>
      </div>

      {/* Statistics row (3 cards like Chameleon) */}
      <div className="row ch-row match-height">
        <div className="col-xl-4 col-lg-12">
          <div className="card h-100">
            <div className="card-header ch-card-header">
              <h4 className="card-title">Workforce Overview</h4>
              <span className="ch-badge">{activeRate}% Active</span>
            </div>
            <div className="card-content">
              <div className="card-body">
                <h4 className="ch-inner-title">Summary</h4>
                <p className="card-text">Total <strong>{Number(stats.totalEmployees||0).toLocaleString()}</strong> employees across <strong>{Number(stats.totalDepartments||0).toLocaleString()}</strong> departments and <strong>{Number(stats.totalDesignations||0).toLocaleString()}</strong> designations.</p>
                <p className="card-text">Active employees: <strong>{Number(stats.activeEmployees||0).toLocaleString()}</strong>. Inactive employees: <strong>{Number(stats.inactiveEmployees||0).toLocaleString()}</strong>.</p>
                <div className="ch-job-list">
                  {jobTypes.length ? jobTypes.map((j:any, i:number) => (
                    <span key={j.name || i} className="ch-chip">{j.name || 'Unspecified'} <b>{Number(j.count||0).toLocaleString()}</b></span>
                  )) : <span className="text-muted">No job type data</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-lg-12">
          <div className="card h-100">
            <div className="card-header ch-card-header">
              <h4 className="card-title">Recently Added</h4>
              <Link to="/employees" className="ch-link">View all <ArrowUpRight size={14} /></Link>
            </div>
            <div className="card-content">
              <div className="card-body p-0">
                <div className="ch-media-list">
                  {recentAdded.length === 0 && <div className="p-3 text-muted">No recent employees.</div>}
                  {recentAdded.map((e: any, i: number) => (
                    <Link key={e.id} to={`/employees/${e.id}`} className="ch-media">
                      <span className="ch-avatar"><img src={`/theme-assets/images/portrait/small/avatar-s-${(i%20)+1}.png`} alt="" onError={(ev)=>{(ev.target as HTMLImageElement).style.display='none';}} /><span className="ch-avatar-fallback">{String(e.name||'?').charAt(0).toUpperCase()}</span></span>
                      <div className="ch-media-body">
                        <span className="ch-media-title">{e.name}</span>
                        <p className="ch-media-sub"><span>{e.employeeCode}</span> · {e.department?.name || 'No Department'}{e.designation?.title ? ` · ${e.designation.title}` : ''}</p>
                      </div>
                      <span className="ch-media-meta">{e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '-'}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-lg-12">
          <div className="card h-100">
            <div className="card-header ch-card-header">
              <h4 className="card-title">Recently Updated</h4>
              <Link to="/employees" className="ch-link">Manage <ArrowUpRight size={14} /></Link>
            </div>
            <div className="card-content">
              <div className="card-body p-0">
                <div className="ch-media-list">
                  {recentUpdated.length === 0 && <div className="p-3 text-muted">No recent updates.</div>}
                  {recentUpdated.map((e: any, i: number) => (
                    <Link key={`u-${e.id}`} to={`/employees/${e.id}`} className="ch-media">
                      <span className="ch-avatar alt"><img src={`/theme-assets/images/portrait/small/avatar-s-${((i+7)%20)+1}.png`} alt="" onError={(ev)=>{(ev.target as HTMLImageElement).style.display='none';}} /><span className="ch-avatar-fallback">{String(e.name||'?').charAt(0).toUpperCase()}</span></span>
                      <div className="ch-media-body">
                        <span className="ch-media-title">{e.name}</span>
                        <p className="ch-media-sub"><span>{e.employeeCode}</span> · {e.department?.name || 'No Department'}{e.designation?.title ? ` · ${e.designation.title}` : ''}</p>
                      </div>
                      <span className="ch-media-meta"><UserCheck size={12} /> {e.updatedAt ? new Date(e.updatedAt).toLocaleDateString() : '-'}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ch-footer-note">Abyte-EMS · {Number(stats.totalEmployees||0).toLocaleString()} records · {Number(stats.totalDepartments||0).toLocaleString()} departments · <Link to="/organization" className="ch-link">Organization <Building2 size={13} /></Link> · <Link to="/employee-summary" className="ch-link">Summary <Briefcase size={13} /></Link></div>
    </div>
  );
}
