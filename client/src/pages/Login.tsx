import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, LogIn, ShieldCheck, Database, FileBarChart, Image as ImageIcon } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const next = await login(username, password);
      nav(next.mustChangePassword ? '/change-password' : '/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Database, text: 'Local SQLite Database' },
    { icon: ImageIcon, text: 'Images & Documents' },
    { icon: FileBarChart, text: 'Reports & Exports' },
    { icon: ShieldCheck, text: 'RBAC & Secure Access' },
  ];

  return (
    <div className="lg-page">
      <div className="lg-bg" />
      <div className="lg-shell">
        <section className="lg-showcase">
          <div className="lg-brand"><span className="lg-brand-dot" />Abyte-EMS</div>
          <div className="lg-kicker">Local Employee Management System</div>
          <h1 className="lg-hero-title">Manage your workforce<br />with clarity and control.</h1>
          <p className="lg-hero-text">Employees, departments, designations, documents, reports, and backups — all in one secure local workspace.</p>
          <div className="lg-feature-grid">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.text} className="lg-feature">
                  <span className="lg-feature-icon"><Icon size={16} /></span>
                  <span>{f.text}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg-form-side">
          <form onSubmit={submit} className="lg-card">
            <div className="lg-card-head">
              <div className="lg-card-badge">Secure Login</div>
              <h2 className="lg-card-title">Welcome back</h2>
              <p className="lg-card-sub">Sign in to access Abyte-EMS</p>
            </div>

            {error && <div className="lg-error" role="alert">{error}</div>}

            <div className="lg-field">
              <label className="lg-label" htmlFor="login-username">Username</label>
              <div className="lg-input-wrap">
                <User size={16} className="lg-input-icon" />
                <input
                  id="login-username"
                  className="lg-input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="lg-field">
              <label className="lg-label" htmlFor="login-password">Password</label>
              <div className="lg-input-wrap">
                <Lock size={16} className="lg-input-icon" />
                <input
                  id="login-password"
                  type="password"
                  className="lg-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="lg-submit" disabled={loading}>
              <LogIn size={16} /> {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="lg-hint">
              <div className="lg-hint-muted">Use the credentials issued by your administrator. Contact them if you need access.</div>
            </div>
          </form>
          <div className="lg-footer-note">Abyte-EMS · Local system · v1.0</div>
        </section>
      </div>
    </div>
  );
}
