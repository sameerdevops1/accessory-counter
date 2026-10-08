'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { gbp } from '@/lib/util';
import { ScanIcon, Stepper, Thumb } from '@/components/ui';
import Scanner from './Scanner';

// Counter sales: scan each item, tap Complete sale. Stock comes off straight away.
export default function Sell({ d, reload, toast }) {
  const [lines, setLines] = useState([]); // [{ id, qty }]
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');
  const [scan, setScan] = useState(false);
  const [cust, setCust] = useState({ name: '', phone: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const ref = useRef([]);
  const codeRef = useRef(null);
  const products = d.products || [];

  const commit = (next) => { ref.current = next; setLines(next); };
  const byId = (id) => products.find((p) => p.id === id);
  const view = lines.map((l) => ({ ...l, p: byId(l.id) })).filter((l) => l.p);
  const total = view.reduce((a, l) => a + Number(l.p.price) * l.qty, 0);
  const count = view.reduce((a, l) => a + l.qty, 0);

  // Adds one of a product. Returns { ok, msg } so the scanner can show and beep the result.
  function addProduct(p) {
    const cur = ref.current.find((l) => l.id === p.id)?.qty || 0;
    if (p.qty <= 0) return { ok: false, msg: `${p.name} is out of stock` };
    if (cur + 1 > p.qty) return { ok: false, msg: `Only ${p.qty} of ${p.name} in stock` };
    const next = cur
      ? ref.current.map((l) => (l.id === p.id ? { ...l, qty: cur + 1 } : l))
      : [...ref.current, { id: p.id, qty: 1 }];
    commit(next);
    return { ok: true, msg: `${p.name} × ${cur + 1}  ·  ${gbp(Number(p.price))}` };
  }
  function addCode(c) {
    const k = c.trim().toLowerCase();
    if (!k) return { ok: false, msg: 'Empty code' };
    const p = products.find((x) => (x.barcode || '').toLowerCase() === k || (x.sku || '').toLowerCase() === k);
    if (!p) return { ok: false, msg: `No product with code ${c.trim()}` };
    return addProduct(p);
  }
  const setQty = (id, n) => {
    const p = byId(id);
    if (n <= 0) return commit(ref.current.filter((l) => l.id !== id));
    if (p && n > p.qty) { toast(`Only ${p.qty} of ${p.name} in stock`); return; }
    commit(ref.current.map((l) => (l.id === id ? { ...l, qty: n } : l)));
  };

  function typed(e) {
    e.preventDefault();
    const r = addCode(code);
    if (!r.ok) toast(r.msg);
    setCode('');
    codeRef.current?.focus();
  }

  const s = q.trim().toLowerCase();
  const matches = s.length < 2 ? [] : products
    .filter((p) => p.published !== undefined && [p.name, p.brand, p.model, p.sku, p.barcode].join(' ').toLowerCase().includes(s))
    .slice(0, 6);

  async function complete() {
    if (!view.length) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('record_sale', {
      p_lines: view.map((l) => ({ product_id: l.id, qty: l.qty })),
      p_name: cust.name, p_phone: cust.phone, p_note: cust.note,
    });
    setBusy(false);
    if (error) { toast(error.message); return; }
    setScan(false);
    setDone({ code: data, total, count });
    commit([]);
    setCust({ name: '', phone: '', note: '' });
    reload();
  }

  const list = (
    <>
      {view.length === 0 ? (
        <p className="muted">Nothing scanned yet.</p>
      ) : (
        <div className="list">
          {view.map((l) => (
            <div key={l.id} className="item">
              <div className="thumb"><Thumb p={l.p} /></div>
              <div>
                <div className="nm">{l.p.name}</div>
                <div className="meta">{gbp(Number(l.p.price))} each &middot; {l.p.qty} in stock</div>
              </div>
              <div className="rt">
                <Stepper n={l.qty} onInc={() => setQty(l.id, l.qty + 1)} onDec={() => setQty(l.id, l.qty - 1)} />
                <span className="mono">{gbp(Number(l.p.price) * l.qty)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cfoot"><span className="k">{count} item{count === 1 ? '' : 's'}</span><span className="price lg">{gbp(total)}</span></div>
    </>
  );

  return (
    <>
      <div className="sechead"><h2>Sell</h2></div>
      <p className="lead">Scan each item the customer is buying, then complete the sale. Stock comes off straight away.</p>

      {done && (
        <div className="rxcard">
          <h3>Sale #{done.code} recorded</h3>
          <p className="sub">{done.count} item{done.count === 1 ? '' : 's'} &middot; <span className="mono">{gbp(done.total)}</span>. Stock has been updated.</p>
          <button type="button" className="btn pri" onClick={() => { setDone(null); setScan(true); }}><ScanIcon /> Scan next sale</button>
        </div>
      )}

      <div className="scanrow">
        <button type="button" className="btn pri" onClick={() => { setDone(null); setScan(true); }}><ScanIcon /> Scan items</button>
      </div>
      <form className="scanrow" onSubmit={typed}>
        <input ref={codeRef} className="mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type / use a scanner gun, then Enter" autoComplete="off" autoCapitalize="off" aria-label="Barcode or SKU" />
        <button className="btn" type="submit">Add</button>
      </form>
      <input className="search" type="search" placeholder="Or search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products to add" autoComplete="off" />
      {matches.length > 0 && (
        <div className="list" style={{ marginBottom: 12 }}>
          {matches.map((p) => (
            <button key={p.id} type="button" className="item" onClick={() => { const r = addProduct(p); if (!r.ok) toast(r.msg); setQ(''); }}>
              <div className="thumb"><Thumb p={p} /></div>
              <div><div className="nm">{p.name}</div><div className="meta">{p.qty} in stock</div></div>
              <div className="rt"><span className="mono">{gbp(Number(p.price))}</span></div>
            </button>
          ))}
        </div>
      )}

      <div className="sechead"><h2>This sale</h2></div>
      {list}

      {view.length > 0 && (
        <>
          <details className="rxcard">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Customer details (optional)</summary>
            <div className="form" style={{ marginTop: 12 }}>
              <div className="two">
                <div className="fld"><label htmlFor="s-cname">Name</label><input id="s-cname" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></div>
                <div className="fld"><label htmlFor="s-cphone">Mobile number</label><input id="s-cphone" type="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></div>
              </div>
              <div className="fld"><label htmlFor="s-cnote">Note</label><input id="s-cnote" value={cust.note} onChange={(e) => setCust({ ...cust, note: e.target.value })} placeholder="Cash, card, discount given" /></div>
              <p className="sub">Add a name and number to save them under Customers and keep their purchase history.</p>
            </div>
          </details>
          <div className="acts" style={{ marginTop: 12 }}>
            <button type="button" className="btn pri" disabled={busy} onClick={complete}>{busy ? 'Saving' : `Complete sale · ${gbp(total)}`}</button>
            <button type="button" className="btn" onClick={() => commit([])}>Clear</button>
          </div>
        </>
      )}

      {scan && (
        <Scanner title="Scan items" doneLabel="Close camera" onScan={addCode} onClose={() => setScan(false)}>
          {list}
          {view.length > 0 && (
            <button type="button" className="btn pri" disabled={busy} onClick={complete}>{busy ? 'Saving' : `Complete sale · ${gbp(total)}`}</button>
          )}
        </Scanner>
      )}
    </>
  );
}
