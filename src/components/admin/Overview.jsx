'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { gbp, ago } from '@/lib/util';
import { Pill, Thumb } from '@/components/ui';

export default function Overview({ d, reload, toast, openForm, goOrders }) {
  const [shop, setShop] = useState(null);
  const s = shop || d.settings || { shop_name: 'Accessory Counter', contact: '', pickup_note: '' };
  const set = (k) => (e) => setShop({ ...s, [k]: e.target.value });

  async function saveShop(e) {
    e.preventDefault();
    const { error } = await supabase.from('settings').upsert({ id: 1, shop_name: s.shop_name.trim() || 'Accessory Counter', contact: s.contact || '', pickup_note: s.pickup_note || '' });
    if (error) toast(error.message); else { toast('Shop details saved'); setShop(null); reload(); }
  }

  const products = d.products || [];
  const orders = d.orders || [];
  let cost = 0, retail = 0, units = 0;
  products.forEach((p) => { cost += p.cost * p.qty; retail += Number(p.price) * p.qty; units += p.qty; });
  const low = products.filter((p) => p.qty <= p.low_at).sort((a, b) => a.qty - b.qty);
  const waiting = orders.filter((o) => o.status === 'new').reverse();

  const since = Date.now() - 30 * 864e5;
  let rev = 0, cnt = 0, cogs = 0;
  const sold = {};
  orders.forEach((o) => {
    if (o.status === 'cancelled' || new Date(o.created_at).getTime() < since) return;
    cnt++; rev += Number(o.total);
    (o.order_lines || []).forEach((l) => {
      const p = products.find((x) => x.id === l.product_id);
      cogs += (p?.cost || 0) * l.qty;
      const t = (sold[l.name] ||= { name: l.name, qty: 0, rev: 0 });
      t.qty += l.qty; t.rev += Number(l.unit_price) * l.qty;
    });
  });
  const top = Object.values(sold).sort((a, b) => b.qty - a.qty).slice(0, 5);

  if (d.products === null) return <div className="empty"><p>Loading.</p></div>;

  return (
    <>
      <div className="sechead"><h2>Overview</h2><button type="button" className="btn pri" onClick={() => openForm(null)}>Add product</button></div>
      {products.length === 0 ? (
        <div className="empty">
          <h2>Your stock is empty</h2>
          <p>Add a product by hand, or open Receive and scan a barcode when a delivery arrives.</p>
        </div>
      ) : (
        <div className="stats">
          <div className="stat"><span className="k">Stock at cost</span><b>{gbp(cost)}</b></div>
          <div className="stat"><span className="k">Stock at retail</span><b>{gbp(retail)}</b></div>
          <div className="stat"><span className="k">Units on shelf</span><b>{units}</b></div>
          <div className="stat"><span className="k">Products</span><b>{products.length}</b></div>
        </div>
      )}

      <div className="cols">
        <section>
          <div className="sechead"><h2>Orders waiting</h2></div>
          {waiting.length ? (
            <div className="list">
              {waiting.slice(0, 5).map((o) => (
                <button key={o.id} type="button" className="item plain" style={{ cursor: 'pointer' }} onClick={() => goOrders(o.id)}>
                  <div><div className="nm">#{o.code} &middot; {o.customer_name}</div><div className="meta">{ago(o.created_at)} &middot; {(o.order_lines || []).length} line(s)</div></div>
                  <span className="mono">{gbp(o.total)}</span>
                </button>
              ))}
            </div>
          ) : <p className="muted">No new orders waiting.</p>}
        </section>
        <section>
          <div className="sechead"><h2>Running low</h2></div>
          {low.length ? (
            <div className="list">
              {low.slice(0, 8).map((p) => (
                <button key={p.id} type="button" className="item" onClick={() => openForm(p)}>
                  <div className="thumb"><Thumb p={p} /></div>
                  <div><div className="nm">{p.name}</div><div className="meta">{p.sku || p.barcode || ''}</div></div>
                  <div className="rt">{p.qty <= 0 ? <Pill tone="bad">Out</Pill> : <Pill tone="warn">Low &middot; {p.qty}</Pill>}</div>
                </button>
              ))}
            </div>
          ) : <p className="muted">Everything is above its low-stock level.</p>}
        </section>
      </div>

      <div className="sechead"><h2>Last 30 days</h2></div>
      <dl className="kv">
        <dt>Orders</dt><dd className="mono">{cnt}</dd>
        <dt>Sales</dt><dd className="mono">{gbp(rev)}</dd>
        <dt>Gross margin</dt><dd className="mono">{gbp(rev - cogs)} (at current cost)</dd>
      </dl>
      <div style={{ height: 12 }} />
      <h3>Best sellers</h3>
      <div style={{ height: 8 }} />
      {top.length ? (
        <div className="list">
          {top.map((t) => (
            <div key={t.name} className="item plain"><div className="nm">{t.name}</div><div className="mono">{t.qty} sold &middot; {gbp(t.rev)}</div></div>
          ))}
        </div>
      ) : <p className="muted">No sales in the last 30 days.</p>}

      <div className="sechead"><h2>Shop details</h2></div>
      <form className="form" onSubmit={saveShop}>
        <div className="fld"><label htmlFor="s-name">Shop name</label><input id="s-name" value={s.shop_name} onChange={set('shop_name')} maxLength={40} /></div>
        <div className="fld"><label htmlFor="s-contact">Contact line shown on the shop (address, hours, phone)</label><input id="s-contact" value={s.contact} onChange={set('contact')} maxLength={160} /></div>
        <div className="fld"><label htmlFor="s-note">Message under the order button</label><input id="s-note" value={s.pickup_note} onChange={set('pickup_note')} maxLength={200} placeholder="We confirm by phone. Pay when you collect." /></div>
        <button className="btn" type="submit">Save shop details</button>
      </form>
    </>
  );
}
