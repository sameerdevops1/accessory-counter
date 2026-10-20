'use client';
import { useEffect, useRef, useState } from 'react';

// A sort button with an icon. Tap it and a small menu lists the orders to choose from.
// options: [[key, "Label"], ...]   value: the chosen key   onChange(key)
function Svg({ children, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
  );
}

export default function SortMenu({ value, options, onChange, label = 'Sort by', id }) {
  const [open, setOpen] = useState(false);
  const [right, setRight] = useState(false);
  const root = useRef(null);
  const cur = options.find(([k]) => k === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const box = root.current;
    // Open towards the side that has room, so the menu never runs off the screen.
    const r = box.getBoundingClientRect();
    setRight(r.left + 250 > document.documentElement.clientWidth && r.right - 250 >= 0);
    box.querySelector('[aria-checked="true"]')?.focus();
    const away = (e) => { if (!box.contains(e.target)) setOpen(false); };
    const key = (e) => {
      if (e.key === 'Escape') { setOpen(false); box.querySelector('.sortm-btn')?.focus(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...box.querySelectorAll('[role="menuitemradio"]')];
        const i = items.indexOf(document.activeElement);
        const n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[n]?.focus();
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div className="sortm" ref={root}>
      <button type="button" id={id} className="sortm-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`${label}: ${cur[1]}`} onClick={() => setOpen((o) => !o)}>
        <Svg size={18}><path d="M7 4v16M7 20l-3-3M7 20l3-3" /><path d="M17 20V4M17 4l-3 3M17 4l3 3" /></Svg>
        <span className="sortm-cur">{cur[1]}</span>
        <span className="chev"><Svg size={16}><path d="m6 9 6 6 6-6" /></Svg></span>
      </button>
      {open && (
        <div className={`sortm-menu${right ? ' r' : ''}`} role="menu" aria-label={label}>
          {options.map(([k, l]) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={k === value} className={k === value ? 'on' : ''}
              onClick={() => { onChange(k); setOpen(false); box_focus(root); }}>
              <span>{l}</span>
              {k === value && <Svg size={18}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function box_focus(root) {
  // Put focus back on the button so keyboard users do not lose their place.
  setTimeout(() => root.current?.querySelector('.sortm-btn')?.focus(), 0);
}
