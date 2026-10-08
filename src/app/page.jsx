'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { gbp, CATS } from '@/lib/util';
import { CartIcon, PlugIcon, Sheet, Stepper, Thumb, useToast } from '@/components/ui';

const BLANK = { name: '', phone: '', email: '', address: '', note: '', website: '' };

export default function Shop() {
  const [products, setProducts] = useState(null);
  const [shop, setShop] = useState({ shop_name: 'Accessory Counter', contact: '', pickup_note: '' });
  const [cart, setCart] = useState({});
  const [info, setInfo] = useState(BLANK);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const hydrated = useRef(false);
  const [toastNode, toast] = useToast();

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem('ac.cart') || '{}'));
      setInfo((i) => ({ ...i, ...JSON.parse(localStorage.getItem('ac.info') || '{}') }));
    } catch {}
    hydrated.current = true;
    if (!configured) { setProducts([]); return; }
    (async () => {
      const [p, s] = await Promise.all([
        supabase.from('products')
          .select('id,name,brand,category,model,description,price,photo_url,in_stock')
          .eq('published', true).order('name'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (p.error) setLoadError('The shop could not load. Please try again in a moment.');
      setProducts(p.data || []);
      if (s.data) setShop(s.data);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem('ac.cart', JSON.stringify(cart)); } catch {}
  }, [cart]);
  useEffect(() => {
    if (!hydrated.current) return;
    const { website, ...rest } = info;
    try { localStorage.setItem('ac.info', JSON.stringify(rest)); } catch {}
  }, [info]);

  const lines = useMemo(
    () => Object.entries(cart).map(([id, qty]) => {
      const p = products?.find((x) => x.id === id);
      return { id, qty, p, ok: !!p && p.in_stock };
    }),
    [cart, products],
  );
  const count = lines.reduce((a, l) => a + (l.ok ? l.qty : 0), 0);
  const total = lines.reduce((a, l) => a + (l.ok ? Number(l.p.price) * l.qty : 0), 0);

  const add = (id) => setCart((c) => ({ ...c, [id]: Math.min(99, (c[id] || 0) + 1) }));
  const dec = (id) => setCart((c) => {
    const n = { ...c };
    if ((n[id] || 0) <= 1) delete n[id]; else n[id]--;
    return n;
  });
  const remove = (id) => setCart((c) => { const n = { ...c }; delete n[id]; return n; });
  const field = (k) => (e) => setInfo((i) => ({ ...i, [k]: e.target.value }));

  async function place(e) {
    e.preventDefault();
    if (info.website) { setSheet({ type: 'done', code: '----' }); return; } // spam trap
    if (!info.name.trim() || info.phone.replace(/\D/g, '').length < 7) {
      toast('Add your name and a mobile number');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('place_order', {
      p_name: info.name, p_phone: info.phone, p_email: info.email, p_address: info.address, p_note: info.note,
      p_lines: lines.filter((l) => l.ok).map((l) => ({ product_id: l.id, qty: l.qty })),
    });
    setBusy(false);
    if (error) { toast(error.message || 'Could not send your order. Try again.'); return; }
    setCart({});
    setSheet({ type: 'done', code: data });
  }

  const cats = useMemo(() => {
    const seen = new Set((products || []).map((p) => p.category).filter(Boolean));
    return ['All', ...CATS.filter((c) => seen.has(c)), ...[...seen].filter((c) => !CATS.includes(c))];
  }, [products]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (products || [])
      .filter((p) => (cat === 'All' || p.category === cat)
        && (!s || [p.name, p.brand, p.model, p.category].join(' ').toLowerCase().includes(s)))
      .sort((a, b) => (a.in_stock === false) - (b.in_stock === false) || a.name.localeCompare(b.name));
  }, [products, q, cat]);

  const open = sheet?.type === 'product' ? products?.find((p) => p.id === sheet.id) : null;

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand"><PlugIcon /><span>{shop.shop_name}</span></Link>
        <div className="top-r">
          <Link href="/track" className="toplink">Track order</Link>
          <button type="button" className="iconbtn" onClick={() => setSheet({ type: 'cart' })} aria-label="Basket">
            <CartIcon />{count > 0 && <span className="badge">{count}</span>}
          </button>
        </div>
      </header>

      {!configured && (
        <div className="notice">This site is not connected to its database yet. Follow the setup steps in README.md, then reload.</div>
      )}
      {loadError && <div className="notice">{loadError}</div>}

      {products === null ? (
        <div className="empty"><p>Loading products.</p></div>
      ) : products.length === 0 ? (
        <div className="empty">
          <h2>No products yet</h2>
          <p>The shop has not published any products yet. Check back soon.</p>
        </div>
      ) : (
        <>
          <input className="search" type="search" placeholder="Search cases, chargers, cables" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" autoComplete="off" />
          <div className="chips">
            {cats.map((c) => (
              <button key={c} type="button" className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          {shown.length === 0 ? (
            <div className="empty"><p>Nothing matches that search.</p></div>
          ) : (
            <div className="grid">
              {shown.map((p) => {
                const out = !p.in_stock;
                const n = cart[p.id] || 0;
                return (
                  <article key={p.id} className={`card ${out ? 'out' : ''}`} onClick={() => setSheet({ type: 'product', id: p.id })}>
                    <div className="thumb"><Thumb p={p} /></div>
                    <div className="cbody">
                      <h3>{p.name}</h3>
                      <p className="sub">{[p.brand, p.model].filter(Boolean).join(' · ')}</p>
                      <p className={`stk ${out ? 'bad' : 'ok'}`}>{out ? 'Sold out' : '✓ In stock'}</p>
                      <div className="cfoot" onClick={(e) => e.stopPropagation()}>
                        <span className="price">{gbp(p.price)}</span>
                        {!out && (n
                          ? <Stepper n={n} onInc={() => add(p.id)} onDec={() => dec(p.id)} />
                          : <button type="button" className="btn pri sm" onClick={() => add(p.id)}>Add</button>)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {shop.contact && <p className="sub" style={{ marginTop: 24 }}>{shop.contact}</p>}

      {count > 0 && !sheet && (
        <button type="button" className="basket" onClick={() => setSheet({ type: 'cart' })}>
          <span>View basket &middot; {count} item{count > 1 ? 's' : ''}</span>
          <span className="mono">{gbp(total)}</span>
        </button>
      )}

      {open && (
        <Sheet title={open.name} onClose={() => setSheet(null)}>
          <div className="hero"><Thumb p={open} /></div>
          <div className="cfoot">
            <span className="price lg">{gbp(open.price)}</span>
            <span className={`stk ${open.in_stock ? 'ok' : 'bad'}`}>{open.in_stock ? '✓ In stock' : 'Sold out'}</span>
          </div>
          <dl className="kv">
            {open.brand && (<><dt>Brand</dt><dd>{open.brand}</dd></>)}
            {open.model && (<><dt>Fits</dt><dd>{open.model}</dd></>)}
            {open.category && (<><dt>Category</dt><dd>{open.category}</dd></>)}
          </dl>
          {open.description && <p>{open.description}</p>}
          {open.in_stock && (cart[open.id]
            ? <div className="acts"><Stepper n={cart[open.id]} onInc={() => add(open.id)} onDec={() => dec(open.id)} /><button type="button" className="btn pri" onClick={() => setSheet({ type: 'cart' })}>View basket</button></div>
            : <button type="button" className="btn pri" onClick={() => add(open.id)}>Add to basket</button>)}
        </Sheet>
      )}

      {sheet?.type === 'cart' && (
        <Sheet title="Your basket" onClose={() => setSheet(null)}>
          {lines.length === 0 ? (
            <div className="empty"><p>Your basket is empty. Add something from the shop.</p><button type="button" className="btn" onClick={() => setSheet(null)}>Keep browsing</button></div>
          ) : (
            <>
              <div className="list">
                {lines.map((l) => (
                  <div key={l.id} className="item">
                    <div className="thumb"><Thumb p={l.p} /></div>
                    <div>
                      <div className="nm">{l.p?.name || 'Unavailable item'}</div>
                      <div className="meta">{l.ok ? `${gbp(l.p.price)} each` : 'No longer available'}</div>
                    </div>
                    <div className="rt">
                      {l.ok
                        ? <Stepper n={l.qty} onInc={() => add(l.id)} onDec={() => dec(l.id)} />
                        : <button type="button" className="btn sm" onClick={() => remove(l.id)}>Remove</button>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="cfoot"><span className="k">Total</span><span className="price lg">{gbp(total)}</span></div>
              <form className="form" onSubmit={place}>
                <h3>Your details</h3>
                <div className="two">
                  <div className="fld"><label htmlFor="c-name">Name</label><input id="c-name" required value={info.name} onChange={field('name')} autoComplete="name" /></div>
                  <div className="fld"><label htmlFor="c-phone">Mobile number</label><input id="c-phone" type="tel" required value={info.phone} onChange={field('phone')} autoComplete="tel" /></div>
                </div>
                <div className="fld"><label htmlFor="c-email">Email (optional)</label><input id="c-email" type="email" value={info.email} onChange={field('email')} autoComplete="email" /></div>
                <div className="fld"><label htmlFor="c-addr">Address (optional)</label><input id="c-addr" value={info.address} onChange={field('address')} autoComplete="street-address" /></div>
                <div className="fld"><label htmlFor="c-note">Note to the shop (optional)</label><textarea id="c-note" value={info.note} onChange={field('note')} /></div>
                <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={info.website} onChange={field('website')} />
                <button className="btn pri" type="submit" disabled={busy || lines.some((l) => !l.ok)}>{busy ? 'Sending order' : 'Place order'}</button>
                {lines.some((l) => !l.ok) && <p className="sub">Remove unavailable items before ordering.</p>}
                <p className="sub">{shop.pickup_note || 'The shop will confirm your order on the number above. You pay when you collect.'}</p>
              </form>
            </>
          )}
        </Sheet>
      )}

      {sheet?.type === 'done' && (
        <Sheet title="Order sent" onClose={() => setSheet(null)}>
          <div className="empty">
            <span className="price lg">#{sheet.code}</span>
            <p>The shop has your order and will confirm it on {info.phone || 'your number'}. Keep this code. You can check progress any time with your code and mobile number.</p>
            <div className="acts">
              <Link className="btn" href="/track">Track my order</Link>
              <button type="button" className="btn pri" onClick={() => setSheet(null)}>Done</button>
            </div>
          </div>
        </Sheet>
      )}

      {toastNode}
    </div>
  );
}
