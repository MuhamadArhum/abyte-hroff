import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';

type Option = { value: string | number; label: string };

type Props = {
  endpoint: '/departments' | '/designations';
  labelKey: 'name' | 'title';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
};

export default function SearchSelect({ endpoint, labelKey, value, onChange, placeholder, allowEmpty = true, emptyLabel = 'All', className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve selected label when value changes (including initial/edit load)
  useEffect(() => {
    if (!value) { setSelectedLabel(''); return; }
    let cancelled = false;
    api.get(endpoint, { params: { ids: value, limit: 10 } }).then(r => {
      if (cancelled) return;
      const arr = Array.isArray(r.data) ? r.data : (r.data?.items || []);
      const found = arr.find((x: any) => String(x.id) === String(value));
      if (found) setSelectedLabel(String(found[labelKey] ?? ''));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [value, endpoint, labelKey]);

  const fetchOptions = useCallback((q: string) => {
    setLoading(true);
    api.get(endpoint, { params: { search: q || undefined, limit: 'all' } })
      .then(r => {
        const arr = Array.isArray(r.data) ? r.data : (r.data?.items || r.data?.data || []);
        setOptions(arr.map((item: any) => ({ value: String(item.id), label: String(item[labelKey] ?? '') })));
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [endpoint, labelKey]);

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = query ? 250 : 0;
    timerRef.current = setTimeout(() => fetchOptions(query), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, open, fetchOptions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const display = value ? (selectedLabel || `#${value}`) : (emptyLabel || placeholder || 'Select');

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} className={className}>
      <button type="button" disabled={disabled} className="select-cp" style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }} onClick={() => !disabled && setOpen(o => !o)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'var(--ink)' : 'var(--steel)' }}>{display}</span>
        <span className="mono muted" style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div className="panel" style={{ position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 360, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--rule)', background: 'var(--paper-light)' }}>
            <input className="input-cp" autoFocus placeholder={placeholder || 'Search...'} value={query} onChange={e => setQuery(e.target.value)} style={{ padding: '7px 10px' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, maxHeight: 280 }}>
            {allowEmpty && (
              <div onClick={() => { onChange(''); setSelectedLabel(''); setOpen(false); }} style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--rule)', color: !value ? 'var(--safety-orange-deep)' : 'var(--ink)' }}>
                {emptyLabel}
              </div>
            )}
            {loading && <div className="mono muted" style={{ padding: 10, fontSize: 11 }}>Loading...</div>}
            {!loading && options.length === 0 && <div className="mono muted" style={{ padding: 10, fontSize: 11 }}>No results</div>}
            {!loading && options.map(opt => (
              <div key={opt.value} onClick={() => { onChange(String(opt.value)); setSelectedLabel(opt.label); setOpen(false); }} style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--rule)', background: String(value) === String(opt.value) ? 'rgba(217,164,65,0.12)' : 'transparent' }}>
                {opt.label}
              </div>
            ))}
          </div>
          <div className="mono muted" style={{ padding: '6px 10px', fontSize: 10, borderTop: '1px solid var(--rule)', background: 'var(--paper-light)' }}>
            {loading ? 'Loading...' : `${options.length} result${options.length === 1 ? '' : 's'}${query ? '' : ' (type to search)'}`}
          </div>
        </div>
      )}
    </div>
  );
}
