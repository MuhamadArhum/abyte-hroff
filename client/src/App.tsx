import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, type UserRole } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeForm from './pages/EmployeeForm';
import EmployeeProfile from './pages/EmployeeProfile';
import Organization from './pages/Organization';
import Reports from './pages/Reports';
import Backup from './pages/Backup';
import Settings from './pages/Settings';
import EmployeeSummary from './pages/EmployeeSummary';
import Users from './pages/Users';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled UI error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>
            This page could not be displayed. Try reloading or return to the dashboard.
          </p>
          <button className="btn-cp primary" onClick={() => window.location.assign('/')}>Reload application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ForbiddenNotifier() {
  const { toast } = useUI();
  useEffect(() => {
    const onForbidden = (e: Event) => {
      const message = (e as CustomEvent<{ message?: string }>).detail?.message;
      toast(message || 'You do not have permission to perform this action.', 'warning');
    };
    window.addEventListener('ems:forbidden', onForbidden);
    return () => window.removeEventListener('ems:forbidden', onForbidden);
  }, [toast]);
  return null;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PasswordChangeGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function RoleGuard({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <UIProvider>
          <ForbiddenNotifier />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/change-password" element={<Protected><ChangePassword /></Protected>} />
              <Route path="/" element={<Protected><PasswordChangeGate><Layout /></PasswordChangeGate></Protected>}>
                <Route index element={<Dashboard />} />
                <Route path="employees" element={<Employees />} />
                <Route path="employee-summary" element={<EmployeeSummary />} />
                <Route path="employees/new" element={<RoleGuard roles={['ADMIN', 'MANAGER', 'HR']}><EmployeeForm /></RoleGuard>} />
                <Route path="employees/:id/edit" element={<RoleGuard roles={['ADMIN', 'MANAGER', 'HR']}><EmployeeForm /></RoleGuard>} />
                <Route path="employees/:id" element={<EmployeeProfile />} />
                <Route path="organization" element={<Organization />} />
                <Route path="departments" element={<Organization />} />
                <Route path="designations" element={<Organization />} />
                <Route path="reports" element={<Reports />} />
                <Route path="backup" element={<RoleGuard roles={['ADMIN']}><Backup /></RoleGuard>} />
                <Route path="users" element={<RoleGuard roles={['ADMIN']}><Users /></RoleGuard>} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </UIProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
