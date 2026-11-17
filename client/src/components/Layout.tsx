import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, FileBarChart, DatabaseBackup, LogOut, Settings, TableProperties, Search, Bell, UserCog, Menu, X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type NavItem = { to: string; label: string; icon: any; roles?: string[] };
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/employees', label: 'Employees', icon: Users },
      { to: '/employee-summary', label: 'Summary', icon: TableProperties },
    ],
  },
  {
    label: 'Organization',
    items: [
      { to: '/organization', label: 'Departments & Designations', icon: Building2 },
      { to: '/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/backup', label: 'Backup', icon: DatabaseBackup, roles: ['ADMIN'] },
      { to: '/users', label: 'Users', icon: UserCog, roles: ['ADMIN'] },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function getTitle(pathname: string) {
  if (pathname === '/') return { title: 'Dashboard', sub: 'EMPLOYEE OVERVIEW · LOCAL SYSTEM' };
  if (pathname.startsWith('/employees/new')) return { title: 'Add Employee', sub: 'EMPLOYEE MANAGEMENT · CREATE RECORD' };
  if (/^\/employees\/\d+\/edit/.test(pathname)) return { title: 'Edit Employee', sub: 'EMPLOYEE MANAGEMENT · UPDATE RECORD' };
  if (/^\/employees\/\d+/.test(pathname)) return { title: 'Employee Profile', sub: 'EMPLOYEE MANAGEMENT · PROFILE VIEW' };
  if (pathname.startsWith('/employees')) return { title: 'Employees', sub: 'EMPLOYEE MANAGEMENT · RECORDS' };
  if (pathname.startsWith('/employee-summary')) return { title: 'Employee Summary', sub: 'EMPLOYEE MANAGEMENT · DATA TABLE' };
  if (pathname.startsWith('/organization') || pathname.startsWith('/departments') || pathname.startsWith('/designations')) return { title: 'Departments & Designations', sub: 'ORGANIZATION STRUCTURE' };
  if (pathname.startsWith('/reports')) return { title: 'Reports', sub: 'EXPORTS & DATA PREVIEW' };
  if (pathname.startsWith('/backup')) return { title: 'Backup & Restore', sub: 'LOCAL DATA PROTECTION' };
  if (pathname.startsWith('/users')) return { title: 'User Management', sub: 'RBAC · MULTI-USER ACCESS' };
  if (pathname.startsWith('/settings')) return { title: 'Settings', sub: 'APPLICATION CONFIGURATION' };
  return { title: 'Employee Management', sub: 'LOCAL SYSTEM' };
}

export default function Layout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const page = getTitle(location.pathname);
  const initials = (user?.username || 'AD').slice(0, 2).toUpperCase();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('ems-theme');
  }, []);

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : ''} ${collapsed ? 'menu-collapsed' : ''}`}>
      {menuOpen && <div className="sidebar-overlay no-print" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar no-print ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img className="brand-logo" src="/favicon.svg" alt="Abyte-EMS logo" style={{ width: 28, height: 28 }} />
          <span className="brand-text">Abyte-EMS</span>
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={16} /></button>
        </div>
        <nav className="sidebar-nav">
          {navSections.map(section => {
            const items = section.items.filter(i => !i.roles || (user && i.roles.includes(user.role)));
            if (items.length === 0) return null;
            return (
              <div key={section.label}>
                <div className="nav-label">{section.label}</div>
                {items.map(i => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.to === '/'}
                    title={i.label}
                    className={({ isActive }) => {
                      const orgActive = i.to === '/organization' && (location.pathname.startsWith('/departments') || location.pathname.startsWith('/designations') || location.pathname.startsWith('/organization'));
                      return `nav-item ${isActive || orgActive ? 'active' : ''}`;
                    }}
                  >
                    <i.icon />
                    <span className="menu-title">{i.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
          <div className="nav-label">Account</div>
          <button className="nav-item" onClick={() => { void logout(); }} title="Logout" style={{ background: 'transparent', width: '100%', textAlign: 'left' }}>
            <LogOut />
            <span className="menu-title">Logout</span>
          </button>
        </nav>
        <div className="sidebar-foot">Abyte-EMS — v1.0 · Chameleon UI</div>
      </aside>

      <div className="main-area">
        <div className="content-wrapper-before" aria-hidden="true"></div>
        <div className="topbar no-print">
          <div className="topbar-left">
            <button
              className="icon-btn menu-toggle-btn"
              aria-label={collapsed ? 'Expand sidebar' : 'Toggle sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Toggle sidebar'}
              onClick={() => {
                if (window.innerWidth <= 900) setMenuOpen(true);
                else setCollapsed(c => !c);
              }}
            >
              {typeof window !== 'undefined' && window.innerWidth <= 900 ? <Menu size={18} /> : (collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />)}
            </button>
            <div>
              <h1>{page.title}</h1>
              <div className="sub-mono">{page.sub}</div>
            </div>
          </div>
          <div className="topbar-right">
            <div className="search-box top-search">
              <Search size={15} />
              <input type="text" placeholder="Search employees..." onKeyDown={(e) => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; if (v) nav(`/employees?search=${encodeURIComponent(v)}`); } }} />
            </div>

            <button className="icon-btn" aria-label="Notifications"><Bell size={16} /></button>
            <div className="user-chip" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="user-meta" style={{ textAlign: 'right', lineHeight: 1.2 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.fullName || user?.username}</div>
                <div className="mono muted" style={{ fontSize: 10 }}>{user?.role}</div>
              </div>
              <div className="avatar" title={user?.username || 'User'}>{initials}</div>
            </div>
          </div>
        </div>

        <div className="content print-area">
          <div key={location.pathname} className="page-animate">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
