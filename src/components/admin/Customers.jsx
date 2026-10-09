'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ago, gbp, phoneKey, STATUS_LABEL } from '@/lib/util';
import { Sheet } from '@/components/ui';
import Invoice from './Invoice';

export default function Customers({ d, reload, toast }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(undefined); // undefined = closed, null = new, object = existing
  if (d.customers === null) return <div className="empty"><p>Loading.</p></div>;

  const stats = {};
  (d.orders || []).forEach((o) => {
    if (o.status === 'cancelled' || !o.customer_id) return;
    const s = (stats[o.customer_id] ||= { n: 0, total: 0, last: 0, orders: [] });
    s.n++; s.total += Number(o.total); s.last = Math.max(s.last, new Date(o.created_at).getTime()); s.orders.push(o);
  });
  const s = q.trim().toLowerCase();
  const rows = d.customers
    .filter((c) => !s || [c.name, c.phone, c.email].join(' ').toLowerCase().includes(s))
    .map((c) => ({ c, s: stats[c.id] || { n: 0, total: 0, last: 0, orders: [] } }))
    .sort((a, b) => (b.s.last || new Date(b.c.created_at)) - (a.s.last || new Date(a.c.created_at)));

  return (
    <>
      <div className="sechead"><h2>Customers</h2><button type="button" className="btn pri" onClick={() => setEdit(null)}>Add customer</button></div>
      <input className="search" type="search" placeholder="Search name, number or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" autoComplete="off" />
      {rows.length === 0 ? (
        <div className="empty"><p>{d.customers.length ? 'No customers match.' : 'Customers are saved here automatically from their orders. You can also add one by hand.'}</p></div>
      ) : (
        <div className="list">
          {rows.map(({ c, s: st }) => (
            <button key={c.id} type="button" className="item plain" style={{ cursor: 'pointer' }} onClick={() => setEdit({ ...c, stats: st })}>
              <div><div className="nm">{c.name}</div><div className="meta">{c.phone}{st.last ? ` · last order ${ago(st.last)}` : ''}</div></div>
              <div className="rt"><span className="mono">{gbp(st.total)}</span><span className="meta">{st.n} order{st.n === 1 ? '' : 's'}</span></div>
            </button>
          ))}
        </div>
      )}
      {edit !== undefined && <CustomerSheet d={d} c={edit} onClose={() => setEdit(undefined)} reload={reload} toast={toast} />}
    </>
  );
}

function CustomerSheet({ d, c, onClose, reload, toast }) {
  const [inv, setInv] = useState(null);
  const isNew = !c;
  const [f, setF] = useState({ name: c?.name || '', phone: c?.phone || '', email: c?.email || '', address: c?.address || '', notes: c?.notes || '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    if (!f.name.trim() || phoneKey(f.phone).length < 7) { toast('Add a name and a mobile number'); return; }
    setBusy(true);
    const row = { name: f.name.trim(), phone: f.phone.trim(), phone_key: phoneKey(f.phone), email: f.email.trim(), address: f.address.trim(), notes: f.notes.trim() };
    const { error } = isNew
      ? await supabase.from('customers').insert(row)
      : await supabase.from('customers').update(row).eq('id', c.id);
    setBusy(false);
    if (error) { toast(error.code === '23505' ? 'A customer with that number already exists' : error.message); return; }
    toast('Customer saved');
    reload();
    onClose();
  }

  const st = c?.stats;
  return (
    <Sheet title={isNew ? 'Add customer' : c.name} onClose={onClose}>
      {st && (
        <dl className="kv">
          <dt>Orders</dt><dd className="mono">{st.n}</dd>
          <dt>Total purchases</dt><dd className="mono">{gbp(st.total)}</dd>
          <dt>Last order</dt><dd>{st.last ? ago(st.last) : 'None yet'}</dd>
        </dl>
      )}
      <form className="form" onSubmit={save}>
        <div className="two">
          <div className="fld"><label htmlFor="cu-name">Name</label><input id="cu-name" value={f.name} onChange={set('name')} /></div>
          <div className="fld"><label htmlFor="cu-phone">Mobile number</label><input id="cu-phone" type="tel" value={f.phone} onChange={set('phone')} /></div>
        </div>
        <div className="fld"><label htmlFor="cu-email">Email</label><input id="cu-email" type="email" value={f.email} onChange={set('email')} /></div>
        <div className="fld"><label htmlFor="cu-addr">Address</label><input id="cu-addr" value={f.address} onChange={set('address')} /></div>
        <div className="fld"><label htmlFor="cu-notes">Notes</label><textarea id="cu-notes" value={f.notes} onChange={set('notes')} /></div>
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Saving' : 'Save customer'}</button>
      </form>
      {st && st.orders.length > 0 && (
        <>
          <h3>Recent orders</h3>
          <div className="lines">
            {st.orders.slice(0, 6).map((o) => (
              <div key={o.id}>
                <span>#{o.code} &middot; {ago(o.created_at)} &middot; {STATUS_LABEL[o.status]}</span>
                <span className="mono">{gbp(o.total)}{o.status !== 'cancelled' && <> &middot; <button type="button" className="linkbtn" onClick={() => setInv(o)}>Invoice</button></>}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {inv && <Invoice order={inv} shop={d.settings} inv={d.invoice} onClose={() => setInv(null)} toast={toast} />}
    </Sheet>
  );
}
