'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FLOW } from '@/lib/util';

export function PlugIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 2v5M15 2v5" /><path d="M6 7h12v4a6 6 0 0 1-12 0z" /><path d="M12 17v5" />
    </svg>
  );
}

export function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6" />
    </svg>
  );
}

export function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 9v6M12 9v6M16 9v6" />
    </svg>
  );
}

export function Thumb({ p }) {
  if (p?.photo_url) return <img src={p.photo_url} alt="" loading="lazy" />;
  return <div className="ph"><span>{p?.category || 'Accessory'}</span></div>;
}

export function Pill({ tone = '', children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Progress({ status }) {
  if (status === 'cancelled') return <Pill tone="bad">Cancelled</Pill>;
  const i = FLOW.indexOf(status);
  return (
    <div className="steps" aria-hidden="true">
      {FLOW.map((s, k) => <i key={s} className={k <= i ? 'on' : ''} />)}
    </div>
  );
}

export function Stepper({ n, onInc, onDec }) {
  return (
    <div className="step">
      <button type="button" onClick={onDec} aria-label="Remove one">&minus;</button>
      <span>{n}</span>
      <button type="button" onClick={onInc} aria-label="Add one">+</button>
    </div>
  );
}

export function Sheet({ title, onClose, children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    document.documentElement.classList.add('lock');
    const key = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', key);
    return () => {
      document.documentElement.classList.remove('lock');
      window.removeEventListener('keydown', key);
    };
  }, []);
  return (
    <div className="sheet">
      <div className="scrim" onClick={onClose} />
      <div className="panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sh-h">
          <h2>{title}</h2>
          <button className="x" type="button" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState('');
  const timer = useRef(null);
  const show = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 3500);
  }, []);
  return [msg ? <div id="toast" role="status">{msg}</div> : null, show];
}
