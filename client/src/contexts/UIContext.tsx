import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type Toast = { id: number; type: ToastType; message: string };

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type UIContextValue = {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const idRef = useRef(1);
  const timers = useRef<number[]>([]);
  const pendingConfirm = useRef<((v: boolean) => void) | null>(null);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, type, message }]);
    const timer = window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      timers.current = timers.current.filter((x) => x !== timer);
    }, 3500);
    timers.current.push(timer);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      pendingConfirm.current = resolve;
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const closeConfirm = useCallback((value: boolean) => {
    const resolve = pendingConfirm.current;
    pendingConfirm.current = null;
    setConfirmState(null);
    if (resolve) resolve(value);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmState) closeConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);

  useEffect(() => {
    const timerIds = timers.current;
    const pending = pendingConfirm.current;
    return () => {
      timerIds.forEach((id) => window.clearTimeout(id));
      if (pending) pending(false);
    };
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-${t.type}`} role="status">
            <span>{t.message}</span>
            <button className="toast-close" aria-label="Dismiss notification" onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="confirm-overlay" role="alertdialog" aria-modal="true" aria-label={confirmState.title || 'Confirm action'} aria-describedby="confirm-message">
          <div className="confirm-dialog" onKeyDown={(e) => { if (e.key === 'Escape') closeConfirm(false); }}>
            <div className="confirm-title">{confirmState.title || 'Please Confirm'}</div>
            <div className="confirm-message" id="confirm-message">{confirmState.message}</div>
            <div className="confirm-actions">
              <button className="btn-cp" onClick={() => closeConfirm(false)}>{confirmState.cancelText || 'Cancel'}</button>
              <button className={`btn-cp ${confirmState.danger ? 'danger' : 'primary'}`} onClick={() => closeConfirm(true)} autoFocus>
                {confirmState.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
