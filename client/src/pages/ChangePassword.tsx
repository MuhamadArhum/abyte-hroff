import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, KeyRound, LogOut } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePassword() {
  const { refreshUser, logout } = useAuth();
  const nav = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post('/auth/change-password', { currentPassword, newPassword });
      await refreshUser().catch(() => undefined);
      nav('/', { replace: true });
      void r;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not change the password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <div className="lg-bg" />
      <div className="lg-shell">
        <section className="lg-showcase">
          <div className="lg-brand"><span className="lg-brand-dot" />Abyte-EMS</div>
          <div className="lg-kicker">Account security</div>
          <h1 className="lg-hero-title">Set your own<br />password.</h1>
          <p className="lg-hero-text">
            For your security, a temporary or administrator-issued password must be replaced before you continue.
            Use at least 12 characters with upper and lower case letters, a digit and a symbol.
          </p>
        </section>
        <section className="lg-form-side">
          <form onSubmit={submit} className="lg-card">
            <div className="lg-card-head">
              <div className="lg-card-badge">Required</div>
              <h2 className="lg-card-title">Change password</h2>
              <p className="lg-card-sub">Choose a strong password you do not use elsewhere.</p>
            </div>
            {error && <div className="lg-error" role="alert">{error}</div>}
            <div className="lg-field">
              <label className="lg-label" htmlFor="cp-current">Current password</label>
              <div className="lg-input-wrap">
                <Lock size={16} className="lg-input-icon" />
                <input id="cp-current" type="password" className="lg-input" value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
              </div>
            </div>
            <div className="lg-field">
              <label className="lg-label" htmlFor="cp-new">New password</label>
              <div className="lg-input-wrap">
                <KeyRound size={16} className="lg-input-icon" />
                <input id="cp-new" type="password" className="lg-input" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={12} />
              </div>
            </div>
            <div className="lg-field">
              <label className="lg-label" htmlFor="cp-confirm">Confirm new password</label>
              <div className="lg-input-wrap">
                <KeyRound size={16} className="lg-input-icon" />
                <input id="cp-confirm" type="password" className="lg-input" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={12} />
              </div>
            </div>
            <button type="submit" className="lg-submit" disabled={loading}>
              <KeyRound size={16} /> {loading ? 'Saving...' : 'Change password'}
            </button>
            <button type="button" className="lg-submit" style={{ marginTop: 8, background: 'transparent', color: 'var(--ink)' }}
              onClick={() => { void logout(); }}>
              <LogOut size={16} /> Sign out
            </button>
          </form>
          <div className="lg-footer-note">Abyte-EMS · Local system · v1.0</div>
        </section>
      </div>
    </div>
  );
}
