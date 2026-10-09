'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { gbp, CATS } from '@/lib/util';
import { CartIcon, PlugIcon, Sheet, Stepper, Thumb, useToast } from '@/components/ui';

const BLANK = { name: '', phone: '', email: '', address: '', note: '', website: '' };

function Gallery({ p }) {
  const imgs = p.photos && p.photos.length ? p.photos : (p.photo_url ? [p.photo_url] : []);
  const [i, setI] = useState(0);
  const cur = Math.min(i, Math.max(imgs.length - 1, 0));
  if (imgs.length === 0) return <div className="hero"><Thumb p={p} /></div>;
  return (
    <div className="gallery">
      <div className="hero"><img key={imgs[cur]} src={imgs[cur]} alt={`${p.name}, photo ${cur + 1} of ${imgs.length}`} /></div>
      {imgs.length > 1 && (
        <div className="strip" role="tablist" aria-label="Product photos">
          {imgs.map((u, k) => (
            <button key={u} type="button" role="tab" aria-selected={k === cur} aria-label={`Photo ${k + 1}`} className={k === cur ? 'on' : ''} onClick={() => setI(k)}><img src={u} alt="" loading="lazy" /></button>
          ))}
        </div>
      )}
    </div>
  );
}

function CatIcon({ name }) {
  const n = (name || '').toLowerCase();
  const P = (d) => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
  if (/charg|power|bank/.test(n)) return P(<path d="M13 3 5 13h6l-1 8 8-10h-6z" />);
  if (/cable|usb|lead/.test(n)) return P(<><path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0z" /><path d="M12 16v5" /></>);
  if (/case|cover/.test(n)) return P(<><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></>);
  if (/protect|screen|glass/.test(n)) return P(<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" />);
  if (/audio|ear|head|speaker|sound/.test(n)) return P(<><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>);
  if (/car|holder|mount/.test(n)) return P(<><path d="M5 16l1.5-5h11L19 16" /><rect x="4" y="16" width="16" height="4" rx="1.5" /></>);
  return P(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>);
}

export default function Shop() {
  const [products, setProducts] = useState(null);
  const [shop, setShop] = useState({ shop_name: 'Accessory Counter', contact: '', pickup_note: '' });
  const [cart, setCart] = useState({});
  const [info, setInfo] = useState(BLANK);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [tab, setTab] = useState('top');
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
          .select('id,name,brand,category,model,description,price,photo_url,photos,in_stock,created_at')
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
    const digits = info.phone.replace(/\D/g, '').length;
    if (!info.name.trim()) { toast('Please add your name'); return; }
    if (info.phone.trim() && digits < 7) { toast('That mobile number looks too short. Leave it blank or check it'); return; }
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
      .sort((a, b) => (a.in_stock === false) - (b.in_stock === false) || (tab === 'new' ? String(b.created_at || '').localeCompare(String(a.created_at || '')) : a.name.localeCompare(b.name)));
  }, [products, q, cat, tab]);

  const counts = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => { if (p.category) m[p.category] = (m[p.category] || 0) + 1; });
    return m;
  }, [products]);
  const shelfRef = useRef(null);
  const toShelf = () => shelfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const open = sheet?.type === 'product' ? products?.find((p) => p.id === sheet.id) : null;

  return (
    <div className="wrap store">
      <div className="st-top">
        <span>Order online, pay when you collect</span>
        <Link href="/track">Track order</Link>
      </div>
      <header className="top st-head">
        <Link href="/" className="brand"><PlugIcon /><span>{shop.shop_name}</span></Link>
        <input className="st-search" type="search" placeholder="Search cases, chargers, cables" value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value) toShelf(); }} aria-label="Search products" autoComplete="off" />
        <button type="button" className="iconbtn" onClick={() => setSheet({ type: 'cart' })} aria-label="Basket">
          <CartIcon />{count > 0 && <span className="badge">{count}</span>}
        </button>
      </header>
      {products && products.length > 0 && (
        <nav className="st-nav" aria-label="Categories">
          {cats.map((c) => (
            <button key={c} type="button" className={cat === c ? 'on' : ''} onClick={() => { setCat(c); toShelf(); }}>{c}</button>
          ))}
        </nav>
      )}

      <section className="st-hero" aria-label="Welcome">
        <div className="st-hero-text">
          <span className="tag">Open to order</span>
          <h1>Cases, chargers and cables, ready to collect</h1>
          <p>Choose what you need, place your order online and pay when you pick it up.</p>
          <div className="acts">
            <button type="button" className="btn pri" onClick={toShelf}>Shop now</button>
            <Link href="/track" className="btn">Track my order</Link>
          </div>
        </div>
        <div className="st-hero-art" aria-hidden="true">
          <svg className="cables" viewBox="0 0 600 260" preserveAspectRatio="xMidYMid slice" focusable="false">
            <path className="cb c1" d="M-10 170 C 90 60, 170 250, 290 140 S 460 40, 620 120" />
            <path className="cb c2" d="M-10 210 C 110 130, 210 230, 330 190 S 480 130, 620 200" />
            <path className="cb c3" d="M140 -10 C 190 70, 100 120, 170 270" />
          </svg>
        </div>
      </section>

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
          <section className="st-cats" aria-label="Shop by category">
            <h2>Shop by category</h2>
            <div className="st-tiles">
              {cats.filter((c) => c !== 'All').map((c) => (
                <button key={c} type="button" className={`st-tile ${cat === c ? 'on' : ''}`} onClick={() => { setCat(cat === c ? 'All' : c); toShelf(); }}>
                  <span className="ico"><CatIcon name={c} /></span>
                  <b>{c}</b>
                  <span>{counts[c] || 0} item{(counts[c] || 0) === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
          </section>
          <div className="st-shelfhead" ref={shelfRef}>
            <h2>{cat === 'All' ? 'All products' : cat}</h2>
            <div className="st-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'top'} className={tab === 'top' ? 'on' : ''} onClick={() => setTab('top')}>Top picks</button>
              <button type="button" role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>New arrivals</button>
            </div>
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

      <ul className="st-trust">
        <li><b>Pay on collection</b><span>No card needed online</span></li>
        <li><b>Live stock</b><span>See what is available now</span></li>
        <li><b>Track your order</b><span>With your code and number</span></li>
        <li><b>Collect in shop</b><span>We confirm when it is ready</span></li>
      </ul>
      <footer className="st-foot">
        <div><b>{shop.shop_name}</b>{shop.contact && <p>{shop.contact}</p>}</div>
        <div><b>Shop</b>{cats.filter((c) => c !== 'All').slice(0, 5).map((c) => <button key={c} type="button" onClick={() => { setCat(c); toShelf(); }}>{c}</button>)}</div>
        <div><b>Help</b><Link href="/track">Track my order</Link></div>
      </footer>

      {count > 0 && !sheet && (
        <button type="button" className="basket" onClick={() => setSheet({ type: 'cart' })}>
          <span>View basket &middot; {count} item{count > 1 ? 's' : ''}</span>
          <span className="mono">{gbp(total)}</span>
        </button>
      )}

      {open && (
        <Sheet title={open.name} onClose={() => setSheet(null)}>
          <Gallery p={open} />
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
                  <div className="fld"><label htmlFor="c-phone">Mobile number (optional)</label><input id="c-phone" type="tel" value={info.phone} onChange={field('phone')} autoComplete="tel" /></div>
                </div>
                <div className="fld"><label htmlFor="c-email">Email (optional)</label><input id="c-email" type="email" value={info.email} onChange={field('email')} autoComplete="email" /></div>
                <div className="fld"><label htmlFor="c-addr">Address (optional)</label><input id="c-addr" value={info.address} onChange={field('address')} autoComplete="street-address" /></div>
                <div className="fld"><label htmlFor="c-note">Note to the shop (optional)</label><textarea id="c-note" value={info.note} onChange={field('note')} /></div>
                <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={info.website} onChange={field('website')} />
                <button className="btn pri" type="submit" disabled={busy || lines.some((l) => !l.ok)}>{busy ? 'Sending order' : 'Place order'}</button>
                {lines.some((l) => !l.ok) && <p className="sub">Remove unavailable items before ordering.</p>}
                <p className="sub">{shop.pickup_note || 'You pay when you collect. Add a mobile number if you want the shop to confirm by phone and to track your order online.'}</p>
              </form>
            </>
          )}
        </Sheet>
      )}

      {sheet?.type === 'done' && (
        <Sheet title="Order sent" onClose={() => setSheet(null)}>
          <div className="empty">
            <span className="price lg">#{sheet.code}</span>
            <p>The shop has your order and {info.phone.trim() ? `will confirm it on ${info.phone}. Keep this code. You can check progress any time with your code and mobile number.` : 'will have it ready for you. Keep this code and show it when you collect. Tracking online needs a mobile number.'}</p>
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
