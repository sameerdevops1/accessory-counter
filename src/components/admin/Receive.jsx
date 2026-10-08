'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ago, int, num } from '@/lib/util';
import { ScanIcon, Stepper, Thumb } from '@/components/ui';
import Scanner from './Scanner';

// Receiving a delivery: scan every item as it comes out of the box. Repeat scans add one each.
// Fix any quantity or cost, then tap Add all to stock.
export default function Receive({ d, reload, toast, openForm }) {
  const [batch, setBatch] = useState([]); // [{ id, qty, cost }]
  const [unknown, setUnknown] = useState([]);
  const [code, setCode] = useState('');
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState([]);
  const ref = useRef([]);
  const codeRef = useRef(null);
  const products = d.products || [];

  const commit = (next) => { ref.current = next; setBatch(next); };
  const byId = (id) => products.find((p) => p.id === id);
  const view = batch.map((b) => ({ ...b, p: byId(b.id) })).filter((b) => b.p);
  const units = view.reduce((a, b) => a + b.qty, 0);

  function addCode(c) {
    const k = c.trim();
    if (!k) return { ok: false, msg: 'Empty code' };
    const lower = k.toLowerCase();
    const p = products.find((x) => (x.barcode || '').toLowerCase() === lower || (x.sku || '').toLowerCase() === lower);
    if (!p) {
      setUnknown((u) => (u.includes(k) ? u : [...u, k]));
      return { ok: false, msg: `Not in inventory yet: ${k}. It is saved below so you can create it.` };
    }
    const cur = ref.current.find((b) => b.id === p.id);
    const next = cur
      ? ref.current.map((b) => (b.id === p.id ? { ...b, qty: b.qty + 1 } : b))
      : [...ref.current, { id: p.id, qty: 1, cost: String(p.cost ?? '') }];
    commit(next);
    return { ok: true, msg: `${p.name} × ${(cur?.qty || 0) + 1}` };
  }

  const setField = (id, k, v) => commit(ref.current.map((b) => (b.id === id ? { ...b, [k]: v } : b)));
  const setQty = (id, n) => commit(n <= 0 ? ref.current.filter((b) => b.id !== id) : ref.current.map((b) => (b.id === id ? { ...b, qty: n } : b)));

  function typed(e) {
    e.preventDefault();
    const r = addCode(code);
    if (!r.ok) toast(r.msg);
    setCode('');
    codeRef.current?.focus();
  }

  async function saveAll() {
    if (!view.length) return;
    setBusy(true);
    let ok = 0;
    for (const b of view) {
      const n = Math.max(1, int(b.qty));
      const { error } = await supabase.rpc('adjust_stock', {
        p_product: b.id, p_delta: n, p_reason: 'Received', p_cost: String(b.cost).trim() === '' ? null : num(b.cost),
      });
      if (error) { toast(`${b.p.name}: ${error.message}`); break; }
      ok++;
      setRecent((r) => [{ name: b.p.name, qty: n, t: Date.now() }, ...r].slice(0, 12));
      commit(ref.current.filter((x) => x.id !== b.id));
    }
    setBusy(false);
    if (ok === view.length) { setScan(false); toast(`Stock updated for ${ok} product${ok === 1 ? '' : 's'}`); }
    reload();
  }

  const list = (
    <>
      {view.length === 0 ? (
        <p className="muted">Nothing scanned yet.</p>
      ) : (
        <div className="list">
          {view.map((b) => (
            <div key={b.id} className="item">
              <div className="thumb"><Thumb p={b.p} /></div>
              <div>
                <div className="nm">{b.p.name}</div>
                <div className="meta">Now {b.p.qty} in stock</div>
              </div>
              <div className="rt"><Stepper n={b.qty} onInc={() => setQty(b.id, b.qty + 1)} onDec={() => setQty(b.id, b.qty - 1)} /></div>
            </div>
          ))}
        </div>
      )}
      {view.length > 0 && <div className="cfoot"><span className="k">{units} unit{units === 1 ? '' : 's'} to add</span></div>}
    </>
  );

  return (
    <>
      <div className="sechead"><h2>Receive stock</h2></div>
      <p className="lead">Scan each item as it comes out of the delivery. Scanning the same product again adds one more.</p>
      <div className="scanrow">
        <button type="button" className="btn pri" onClick={() => setScan(true)}><ScanIcon /> Scan items in</button>
      </div>
      <form className="scanrow" onSubmit={typed}>
        <input ref={codeRef} className="mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type / use a scanner gun, then Enter" autoComplete="off" autoCapitalize="off" aria-label="Barcode or SKU" />
        <button className="btn" type="submit">Add</button>
      </form>

      <div className="sechead"><h2>To add to stock</h2></div>
      {list}
      {view.length > 0 && (
        <div className="rxcard">
          <h3>Unit cost (optional)</h3>
          {view.map((b) => (
            <div key={b.id} className="fld"><label htmlFor={`cost-${b.id}`}>{b.p.name} (GBP each)</label><input id={`cost-${b.id}`} inputMode="decimal" value={b.cost} onChange={(e) => setField(b.id, 'cost', e.target.value)} /></div>
          ))}
          <div className="acts">
            <button type="button" className="btn pri" disabled={busy} onClick={saveAll}>{busy ? 'Saving' : `Add all to stock · ${units}`}</button>
            <button type="button" className="btn" onClick={() => commit([])}>Clear</button>
          </div>
        </div>
      )}

      {unknown.length > 0 && (
        <>
          <div className="sechead"><h2>Barcodes not in inventory</h2></div>
          <div className="list">
            {unknown.map((u) => (
              <div key={u} className="item plain">
                <div className="mono">{u}</div>
                <div className="acts">
                  <button type="button" className="btn sm pri" onClick={() => openForm(null, { barcode: u, qty: '1' })}>Create product</button>
                  <button type="button" className="btn sm" onClick={() => setUnknown((x) => x.filter((c) => c !== u))}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="sechead"><h2>Received this session</h2></div>
          <div className="list">
            {recent.map((r, i) => (
              <div key={i} className="item plain"><div className="nm">{r.name}</div><div className="mono">+{r.qty} &middot; {ago(r.t)}</div></div>
            ))}
          </div>
        </>
      )}

      {scan && (
        <Scanner title="Scan items in" doneLabel="Close camera" onScan={addCode} onClose={() => setScan(false)}>
          {list}
          {unknown.length > 0 && (
            <>
              <h3>Not in inventory yet</h3>
              <div className="list">
                {unknown.map((u) => (
                  <div key={u} className="item plain">
                    <div className="mono">{u}</div>
                    <button type="button" className="btn sm pri" onClick={() => { setScan(false); openForm(null, { barcode: u, qty: '1' }); }}>Create product</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {view.length > 0 && (
            <button type="button" className="btn pri" disabled={busy} onClick={saveAll}>{busy ? 'Saving' : `Add all to stock · ${units}`}</button>
          )}
        </Scanner>
      )}
    </>
  );
}
