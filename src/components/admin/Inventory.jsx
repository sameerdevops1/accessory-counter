'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CATS, downscale, gbp, int, num, r2, when } from '@/lib/util';
import { Pill, ScanIcon, Sheet, Thumb } from '@/components/ui';
import Scanner from './Scanner';

export default function Inventory({ d, openForm, onScanAdd }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  if (d.products === null) return <div className="empty"><p>Loading.</p></div>;
  const s = q.trim().toLowerCase();
  const shown = d.products.filter((p) => {
    if (f === 'low' && !(p.qty > 0 && p.qty <= p.low_at)) return false;
    if (f === 'out' && p.qty > 0) return false;
    if (f === 'hidden' && p.published) return false;
    return !s || [p.name, p.brand, p.model, p.sku, p.barcode, p.supplier, p.category].join(' ').toLowerCase().includes(s);
  });
  const margin = (p) => (Number(p.price) > 0 ? Math.round(((Number(p.price) - p.cost) / Number(p.price)) * 100) : 0);
  return (
    <>
      <div className="sechead">
        <h2>Inventory</h2>
        <div className="acts">
          <button type="button" className="btn pri" onClick={onScanAdd}><ScanIcon /> Scan to add</button>
          <button type="button" className="btn" onClick={() => openForm(null)}>Add manually</button>
        </div>
      </div>
      <input className="search" type="search" placeholder="Search name, brand, SKU or barcode" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" autoComplete="off" />
      <div className="chips">
        {[['all', 'All'], ['low', 'Low'], ['out', 'Out'], ['hidden', 'Hidden']].map(([k, l]) => (
          <button key={k} type="button" className={`chip ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="empty"><p>{d.products.length ? 'No products match.' : 'No products yet. Tap Scan to add and scan a barcode, or Add manually.'}</p></div>
      ) : (
        <div className="list">
          {shown.map((p) => (
            <button key={p.id} type="button" className="item" onClick={() => openForm(p)}>
              <div className="thumb"><Thumb p={p} /></div>
              <div>
                <div className="nm">{p.name} {!p.published && <Pill>Hidden</Pill>}</div>
                <div className="meta">{[p.sku, p.barcode].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="rt">
                {p.qty <= 0 ? <Pill tone="bad">Out</Pill> : p.qty <= p.low_at ? <Pill tone="warn">Low &middot; {p.qty}</Pill> : <Pill tone="ok">{p.qty}</Pill>}
                <span className="meta">{gbp(p.price)} &middot; {margin(p)}%</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function ProductForm({ product, prefill, onClose, onSaved, reload, toast }) {
  const isNew = !product;
  const p0 = product || {};
  const [f, setF] = useState({
    name: p0.name || '', brand: p0.brand || prefill?.carry?.brand || '', category: p0.category || prefill?.carry?.category || '', model: p0.model || '',
    description: p0.description || '', price: p0.price ?? '', sku: p0.sku || '', barcode: p0.barcode || prefill?.barcode || '',
    cost: p0.cost ?? '', qty: prefill?.qty ?? '0', low_at: p0.low_at ?? 5, supplier: p0.supplier || prefill?.carry?.supplier || '', location: p0.location || prefill?.carry?.location || '',
    published: p0.published ?? prefill?.carry?.published ?? true,
    photos: (p0.photos && p0.photos.length ? p0.photos : (p0.photo_url ? [p0.photo_url] : [])),
  });
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [adj, setAdj] = useState('1');
  const [qtyNow, setQtyNow] = useState(p0.qty ?? 0);
  const [hist, setHist] = useState([]);
  const [delAsk, setDelAsk] = useState(false);
  const fromScan = prefill?.then === 'scan';
  const kind = useRef(fromScan ? 'scan' : 'close');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    if (isNew) return;
    supabase.from('stock_moves').select('delta,reason,created_at').eq('product_id', product.id)
      .order('created_at', { ascending: false }).limit(8).then(({ data }) => setHist(data || []));
  }, [isNew, product?.id, qtyNow]);

  const cats = [...new Set([...CATS, ...(f.category ? [f.category] : [])])];
  const price = num(f.price), cost = num(f.cost);

  const MAX_PHOTOS = 6;
  const [uploading, setUploading] = useState(false);
  async function uploadPhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_PHOTOS - f.photos.length;
    if (room <= 0) { toast(`You can add up to ${MAX_PHOTOS} photos`); return; }
    setUploading(true);
    const added = [];
    let failed = 0;
    for (const file of files.slice(0, room)) {
      try {
        const blob = await downscale(file, 1000);
        const path = `${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('product-photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) { failed++; continue; }
        added.push(supabase.storage.from('product-photos').getPublicUrl(path).data.publicUrl);
      } catch { failed++; }
    }
    setUploading(false);
    if (added.length) setF((s) => ({ ...s, photos: [...s.photos, ...added].slice(0, MAX_PHOTOS) }));
    if (failed) toast(`${failed} photo${failed === 1 ? '' : 's'} could not be uploaded. Try a smaller picture.`);
    else if (files.length > room) toast(`Added ${added.length}. The limit is ${MAX_PHOTOS} photos.`);
    else toast(`${added.length} photo${added.length === 1 ? '' : 's'} added. Save the product to keep ${added.length === 1 ? 'it' : 'them'}.`);
  }
  const dropPhoto = (i) => setF((s) => ({ ...s, photos: s.photos.filter((_, k) => k !== i) }));
  const makeCover = (i) => setF((s) => ({ ...s, photos: [s.photos[i], ...s.photos.filter((_, k) => k !== i)] }));

  async function save(e) {
    e.preventDefault();
    if (!f.name.trim()) { toast('Add a product name'); return; }
    if (f.published && price <= 0) { toast('Add a selling price, or untick "Show in the customer shop"'); return; }
    setBusy(true);
    const row = {
      name: f.name.trim(), brand: f.brand.trim(), category: f.category.trim(), model: f.model.trim(),
      description: f.description.trim(), price: r2(price), sku: f.sku.trim() || null,
      barcode: f.barcode.replace(/\s+/g, '') || null, photos: f.photos, photo_url: f.photos[0] || '', published: f.published,
      updated_at: new Date().toISOString(),
    };
    const priv = { cost: r2(cost), low_at: int(f.low_at), supplier: f.supplier.trim(), location: f.location.trim() };
    let err = null;
    if (isNew) {
      const ins = await supabase.from('products').insert(row).select('id').single();
      err = ins.error;
      if (!err) {
        const qty = Math.max(0, int(f.qty));
        const pv = await supabase.from('product_private').insert({ product_id: ins.data.id, ...priv, qty });
        err = pv.error;
        if (!err && qty > 0) await supabase.from('stock_moves').insert({ product_id: ins.data.id, delta: qty, reason: 'Opening stock' });
      }
    } else {
      const a = await supabase.from('products').update(row).eq('id', product.id);
      err = a.error;
      if (!err) err = (await supabase.from('product_private').update(priv).eq('product_id', product.id)).error;
    }
    setBusy(false);
    if (err) { toast(err.code === '23505' ? 'That barcode or SKU is already used by another product' : err.message); return; }
    toast(isNew ? 'Product added' : 'Changes saved');
    reload();
    onClose();
    if (isNew && kind.current === 'again') {
      onSaved?.('again', { brand: f.brand.trim(), category: f.category.trim(), supplier: f.supplier.trim(), location: f.location.trim(), published: f.published });
    } else if (isNew && kind.current === 'scan') {
      onSaved?.('scan');
    }
  }

  async function adjust(sign) {
    const delta = Math.max(1, int(adj)) * sign;
    const { data, error } = await supabase.rpc('adjust_stock', { p_product: product.id, p_delta: delta, p_reason: sign > 0 ? 'Stock in' : 'Stock out' });
    if (error) { toast(error.message); return; }
    setQtyNow(data);
    toast(`Stock is now ${data}`);
    reload();
  }

  async function remove() {
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) { toast(error.message); return; }
    toast('Product deleted');
    reload();
    onClose();
  }

  return (
    <>
      <Sheet title={isNew ? 'Add product' : 'Edit product'} onClose={onClose}>
        <form className="form" onSubmit={save}>
          <div className="gal">
            <div className="gal-head"><span className="k">Photos (optional) &middot; {f.photos.length} of {MAX_PHOTOS}</span></div>
            <div className="gal-grid">
              {f.photos.map((u, i) => (
                <div key={u} className="gal-item">
                  <div className="thumb"><img src={u} alt={`Photo ${i + 1}`} /></div>
                  {i === 0 ? <span className="cover">Cover</span> : <button type="button" className="gal-mk" onClick={() => makeCover(i)}>Make cover</button>}
                  <button type="button" className="gal-x" aria-label={`Remove photo ${i + 1}`} onClick={() => dropPhoto(i)}>&times;</button>
                </div>
              ))}
              {f.photos.length < MAX_PHOTOS && (
                <label className="gal-add" htmlFor="f-photo">
                  <span>{uploading ? 'Uploading' : f.photos.length ? '+ Add more' : '+ Add photos'}</span>
                  <input id="f-photo" type="file" accept="image/*" multiple hidden disabled={uploading} onChange={uploadPhotos} />
                </label>
              )}
            </div>
            <p className="sub">Pick several at once, or add them one by one. The cover photo shows first in the shop.</p>
          </div>
          <div className="fld"><label htmlFor="f-name">Product name</label><input id="f-name" required maxLength={90} value={f.name} onChange={set('name')} /></div>
          <div className="two">
            <div className="fld"><label htmlFor="f-brand">Brand</label><input id="f-brand" value={f.brand} onChange={set('brand')} /></div>
            <div className="fld"><label htmlFor="f-cat">Category</label><input id="f-cat" list="cats" value={f.category} onChange={set('category')} autoComplete="off" /><datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
          </div>
          <div className="fld"><label htmlFor="f-model">Model / compatibility</label><input id="f-model" placeholder="iPhone 15, Galaxy S24" value={f.model} onChange={set('model')} /></div>
          <div className="two">
            <div className="fld"><label htmlFor="f-barcode">Barcode</label><input id="f-barcode" className="mono" value={f.barcode} onChange={set('barcode')} autoComplete="off" /></div>
            <div className="fld"><label>&nbsp;</label><button type="button" className="btn" onClick={() => setScan(true)}><ScanIcon /> Scan</button></div>
          </div>
          <div className="fld"><label htmlFor="f-sku">SKU / product code</label><input id="f-sku" className="mono" value={f.sku} onChange={set('sku')} /></div>
          <div className="two">
            <div className="fld"><label htmlFor="f-cost">Buying price (GBP)</label><input id="f-cost" inputMode="decimal" value={f.cost} onChange={set('cost')} /></div>
            <div className="fld"><label htmlFor="f-price">Selling price (GBP)</label><input id="f-price" inputMode="decimal" value={f.price} onChange={set('price')} /></div>
          </div>
          {price > 0 && <p className="sub mono">Margin {gbp(price - cost)} per unit ({Math.round(((price - cost) / price) * 100)}%)</p>}
          <div className="two">
            {isNew && <div className="fld"><label htmlFor="f-qty">Quantity in stock</label><input id="f-qty" type="number" min="0" step="1" inputMode="numeric" value={f.qty} onChange={set('qty')} /></div>}
            <div className="fld"><label htmlFor="f-low">Low-stock alert at</label><input id="f-low" type="number" min="0" step="1" inputMode="numeric" value={f.low_at} onChange={set('low_at')} /></div>
          </div>
          <div className="two">
            <div className="fld"><label htmlFor="f-sup">Supplier</label><input id="f-sup" value={f.supplier} onChange={set('supplier')} /></div>
            <div className="fld"><label htmlFor="f-loc">Location / bin</label><input id="f-loc" value={f.location} onChange={set('location')} /></div>
          </div>
          <div className="fld"><label htmlFor="f-desc">Description shown to customers</label><textarea id="f-desc" value={f.description} onChange={set('description')} /></div>
          <label className="check"><input type="checkbox" checked={f.published} onChange={set('published')} /> Show in the customer shop</label>
          <button className="btn pri" type="submit" disabled={busy} onClick={() => { kind.current = fromScan ? 'scan' : 'close'; }}>
            {busy ? 'Saving' : !isNew ? 'Save changes' : fromScan ? 'Save and scan next' : 'Add product'}
          </button>
          {isNew && (
            <button className="btn" type="submit" disabled={busy} onClick={() => { kind.current = fromScan ? 'close' : 'again'; }}>
              {fromScan ? 'Save and close' : 'Save and add another'}
            </button>
          )}
          {!isNew && (delAsk
            ? <button type="button" className="btn danger" onClick={remove}>Tap again to delete</button>
            : <button type="button" className="btn danger" onClick={() => setDelAsk(true)}>Delete product</button>)}
        </form>

        {!isNew && (
          <div className="rxcard">
            <div className="two">
              <div className="fld"><label>In stock now</label><b className="mono big">{qtyNow}</b></div>
              <div className="fld"><label htmlFor="f-adj">Change by</label><input id="f-adj" type="number" min="1" step="1" inputMode="numeric" value={adj} onChange={(e) => setAdj(e.target.value)} /></div>
            </div>
            <div className="acts">
              <button type="button" className="btn" onClick={() => adjust(1)}>Stock in</button>
              <button type="button" className="btn" onClick={() => adjust(-1)}>Stock out</button>
            </div>
            {hist.length > 0 && (
              <div className="hist">
                {hist.map((h, i) => <div key={i}><span>{when(h.created_at)} &middot; {h.reason}</span><span>{h.delta > 0 ? '+' : ''}{h.delta}</span></div>)}
              </div>
            )}
          </div>
        )}
      </Sheet>
      {scan && <Scanner once title="Scan the barcode" doneLabel="Cancel" onClose={() => setScan(false)} onScan={(c) => { setScan(false); setF((s) => ({ ...s, barcode: c })); return { ok: true, msg: c }; }} />}
    </>
  );
}
