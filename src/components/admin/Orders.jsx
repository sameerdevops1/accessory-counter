'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FLOW, NEXT_LABEL, STATUS_LABEL, ago, gbp, when } from '@/lib/util';
import { Pill, Progress } from '@/components/ui';
import Invoice from './Invoice';

export default function Orders({ d, reload, toast, focusId }) {
  const [f, setF] = useState('all');
  const [open, setOpen] = useState(focusId || null);
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const [inv, setInv] = useState(null);
  useEffect(() => { if (focusId) { setOpen(focusId); setF('active'); } }, [focusId]);
  if (d.orders === null) return <div className="empty"><p>Loading.</p></div>;

  const live = (o) => o.status !== 'completed' && o.status !== 'cancelled';
  const shown = d.orders.filter((o) => (f === 'active' ? live(o) : f === 'done' ? o.status === 'completed' : f === 'cancelled' ? o.status === 'cancelled' : true));

  async function setStatus(o, status) {
    setBusy(true);
    const { error } = await supabase.rpc('set_order_status', { p_order: o.id, p_status: status });
    setBusy(false);
    setAsk(null);
    if (error) toast(error.message); else { toast(status === 'cancelled' ? 'Order cancelled' : `Order ${STATUS_LABEL[status].toLowerCase()}`); reload(); }
  }

  return (
    <>
      <div className="sechead"><h2>Orders</h2></div>
      <div className="chips">
        {[['all', 'All'], ['active', 'Active'], ['done', 'Completed'], ['cancelled', 'Cancelled']].map(([k, l]) => (
          <button key={k} type="button" className={`chip ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      {shown.length === 0 && (
        <div className="empty"><p>{d.orders.length ? 'No orders in this view.' : 'No orders yet. When a customer places one it appears here.'}</p></div>
      )}
      {shown.map((o) => {
        const isOpen = open === o.id;
        const next = FLOW[FLOW.indexOf(o.status) + 1];
        return (
          <div key={o.id} className="ocard">
            <button type="button" className="ohead" onClick={() => setOpen(isOpen ? null : o.id)}>
              <div>
                <div className="code">#{o.code}</div>
                <div className="sub">{o.customer_name}{(o.note || '').startsWith('Counter sale') ? ' · In shop' : ''} &middot; {ago(o.created_at)} &middot; <span className="mono">{gbp(o.total)}</span></div>
              </div>
              <Pill tone={o.status === 'cancelled' ? 'bad' : o.status === 'completed' ? 'ok' : o.status === 'new' ? 'acc' : 'warn'}>{STATUS_LABEL[o.status]}</Pill>
            </button>
            <Progress status={o.status} />
            {isOpen && (
              <>
                <div className="lines">
                  {(o.order_lines || []).map((l) => (
                    <div key={l.id}><span>{l.qty} &times; {l.name}</span><span className="mono">{gbp(l.unit_price * l.qty)}</span></div>
                  ))}
                  <div><b>Total</b><b className="mono">{gbp(o.total)}</b></div>
                </div>
                <dl className="kv">
                  <dt>Name</dt><dd>{o.customer_name}</dd>
                  <dt>Mobile</dt><dd className="mono">{o.customer_phone}</dd>
                  {o.customer_email && (<><dt>Email</dt><dd>{o.customer_email}</dd></>)}
                  {o.customer_address && (<><dt>Address</dt><dd>{o.customer_address}</dd></>)}
                  {o.note && (<><dt>Note</dt><dd>{o.note}</dd></>)}
                  <dt>Placed</dt><dd>{when(o.created_at)}</dd>
                  <dt>Stock</dt><dd>{o.stock_taken ? 'Taken from stock' : 'Not taken yet'}</dd>
                </dl>
                {o.status !== 'cancelled' && (
                  <div className="acts"><button type="button" className="btn" onClick={() => setInv(o)}>Invoice</button></div>
                )}
                {live(o) && (
                  <div className="acts">
                    {next && <button type="button" className="btn pri" disabled={busy} onClick={() => setStatus(o, next)}>{NEXT_LABEL[o.status]}</button>}
                    {ask === o.id
                      ? <button type="button" className="btn danger" disabled={busy} onClick={() => setStatus(o, 'cancelled')}>Tap again to cancel</button>
                      : <button type="button" className="btn" onClick={() => setAsk(o.id)}>Cancel order</button>}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {inv && <Invoice order={inv} shop={d.settings} inv={d.invoice} onClose={() => setInv(null)} toast={toast} />}
    </>
  );
}
