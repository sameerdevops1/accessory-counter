'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { gbp, when } from '@/lib/util';

// Print layout. The invoice is placed straight under <body> (see createPortal below) so that, when
// printing, everything else on the screen can be switched off with display:none. That way the invoice
// starts at the top of page 1, a normal order fits on one page, a long one runs on to a second page
// neatly, and no empty pages are printed after it. These rules also replace the older print rules
// in globals.css (the !important marks make sure of that).
const PRINT_CSS = `
@media print{
  @page{size:A4;margin:12mm 14mm}
  html,body{height:auto!important;min-height:0!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
  body>*:not(.inv-overlay){display:none!important}
  .inv-overlay{position:static!important;display:block!important;inset:auto!important;width:auto!important;height:auto!important;overflow:visible!important;background:#fff!important;padding:0!important;margin:0!important}
  .inv-overlay,.inv-overlay *{visibility:visible!important}
  .inv-bar,.inv-hint,.inv-mail{display:none!important}
  .inv-paper{position:static!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important;font-size:12.5px;line-height:1.4}
  .inv-head{padding-bottom:12px;break-inside:avoid;page-break-inside:avoid}
  .inv-bill{margin:14px 0 8px;break-inside:avoid;page-break-inside:avoid}
  .inv-table thead{display:table-header-group}
  .inv-table tfoot{display:table-row-group}
  .inv-table tr{break-inside:avoid;page-break-inside:avoid}
  .inv-table th{padding:7px 6px}
  .inv-table td{padding:6px}
  .inv-table tfoot td{padding-top:10px}
  .inv-status,.inv-foot{break-inside:avoid;page-break-inside:avoid}
}`;

// A printable invoice for one order. Print / Save PDF uses the device's own print dialog,
// which on an iPad offers Save to Files, Share and AirPrint.
// Email opens the device's Mail app with the invoice already written, ready to send.
export default function Invoice({ order: o, shop, inv, onClose, toast }) {
  const [email, setEmail] = useState(o.customer_email || '');
  const lines = o.order_lines || [];
  const paid = o.status === 'completed';
  const number = `INV-${o.code}`;
  const details = (inv?.business_details || '').trim();
  const foot = (inv?.footer_note || '').trim();

  function asText() {
    const rows = lines.map((l) => `${l.qty} x ${l.name}  ${gbp(l.unit_price * l.qty)}`).join('\n');
    return [
      `${shop?.shop_name || 'Invoice'}`,
      details,
      '',
      `Invoice ${number}`,
      `Date: ${when(o.created_at)}`,
      `Customer: ${o.customer_name}`,
      '',
      rows,
      '',
      `Total: ${gbp(o.total)}`,
      paid ? 'Paid' : 'Payment due on collection',
      foot,
    ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  }

  async function share() {
    const text = asText();
    try {
      if (navigator.share) { await navigator.share({ title: `Invoice ${number}`, text }); return; }
      await navigator.clipboard.writeText(text);
      toast('Invoice text copied. Paste it into a message.');
    } catch { /* share sheet closed */ }
  }

  function sendEmail(e) {
    e.preventDefault();
    const to = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast("Type the customer's email address first"); return; }
    const subject = `Invoice ${number} from ${shop?.shop_name || 'us'}`;
    const body = `Hello ${o.customer_name},\n\nThank you for your order. Your invoice is below.\n\n${asText()}\n`;
    // A real link click is the most reliable way to open Mail on iPad Safari.
    const a = document.createElement('a');
    a.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="inv-overlay" role="dialog" aria-modal="true" aria-label={`Invoice ${number}`}>
      <style>{PRINT_CSS}</style>
      <div className="inv-bar">
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <div className="acts">
          <button type="button" className="btn" onClick={share}>Share as text</button>
          <button type="button" className="btn pri" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>
      <form className="inv-mail" onSubmit={sendEmail} noValidate>
        <label className="sr-only" htmlFor="inv-email">Customer email</label>
        <input id="inv-email" type="email" inputMode="email" autoComplete="off" placeholder="Customer email address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="btn">Email invoice</button>
      </form>
      {!details && <p className="notice inv-hint">Add your business address and VAT number under Overview &gt; Invoice details so they appear here.</p>}
      <article className="inv-paper">
        <header className="inv-head">
          <div>
            <h1>{shop?.shop_name || 'Accessory Counter'}</h1>
            {details && <p className="inv-details">{details}</p>}
          </div>
          <div className="inv-meta">
            <div className="inv-title">INVOICE</div>
            <dl>
              <dt>Invoice no.</dt><dd className="mono">{number}</dd>
              <dt>Date</dt><dd>{when(o.created_at)}</dd>
              <dt>Order</dt><dd className="mono">#{o.code}</dd>
            </dl>
          </div>
        </header>

        <section className="inv-bill">
          <h2>Bill to</h2>
          <p><b>{o.customer_name}</b></p>
          {o.customer_phone && <p>{o.customer_phone}</p>}
          {o.customer_email && <p>{o.customer_email}</p>}
          {o.customer_address && <p>{o.customer_address}</p>}
        </section>

        <table className="inv-table">
          <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}><td>{l.name}</td><td className="r">{l.qty}</td><td className="r">{gbp(l.unit_price)}</td><td className="r">{gbp(l.unit_price * l.qty)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="r"><b>Total</b></td><td className="r"><b>{gbp(o.total)}</b></td></tr>
          </tfoot>
        </table>

        <p className={`inv-status ${paid ? 'paid' : ''}`}>{paid ? 'Paid in full. Thank you.' : 'Payment due on collection.'}</p>
        {foot && <p className="inv-foot">{foot}</p>}
      </article>
    </div>,
    document.body,
  );
}
