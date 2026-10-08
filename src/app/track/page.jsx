'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { gbp, when, STATUS_LABEL } from '@/lib/util';
import { PlugIcon, Pill, Progress } from '@/components/ui';

export default function Track() {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [state, setState] = useState('idle');

  async function lookup(e) {
    e.preventDefault();
    if (!configured) return;
    setState('loading');
    const { data, error } = await supabase.rpc('track_order', { p_code: code, p_phone: phone });
    if (error || !data) { setOrder(null); setState('missing'); return; }
    setOrder(data);
    setState('found');
  }

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand"><PlugIcon /><span>Back to shop</span></Link>
      </header>
      <div className="sechead"><h2>Track your order</h2></div>
      <p className="lead">Enter the 4-character code from your confirmation and the mobile number you ordered with.</p>
      <form className="form" style={{ marginTop: 16 }} onSubmit={lookup}>
        <div className="two">
          <div className="fld"><label htmlFor="t-code">Order code</label><input id="t-code" className="mono" required maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" /></div>
          <div className="fld"><label htmlFor="t-phone">Mobile number</label><input id="t-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></div>
        </div>
        <button className="btn pri" type="submit" disabled={state === 'loading'}>{state === 'loading' ? 'Looking' : 'Find my order'}</button>
      </form>

      {state === 'missing' && <div className="empty"><p>No order matches that code and number. Check both and try again.</p></div>}
      {state === 'found' && order && (
        <div className="ocard" style={{ marginTop: 16 }}>
          <div className="ohead static">
            <div><div className="code">#{order.code}</div><div className="sub">{when(order.created_at)}</div></div>
            <Pill tone={order.status === 'cancelled' ? 'bad' : order.status === 'completed' ? 'ok' : 'acc'}>{STATUS_LABEL[order.status] || order.status}</Pill>
          </div>
          <Progress status={order.status} />
          <div className="lines">
            {order.lines.map((l, i) => (
              <div key={i}><span>{l.qty} &times; {l.name}</span><span className="mono">{gbp(l.unit_price * l.qty)}</span></div>
            ))}
            <div><b>Total</b><b className="mono">{gbp(order.total)}</b></div>
          </div>
        </div>
      )}
    </div>
  );
}
