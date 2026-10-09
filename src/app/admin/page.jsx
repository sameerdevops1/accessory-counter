'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { PlugIcon, useToast } from '@/components/ui';
import Overview from '@/components/admin/Overview';
import Inventory, { ProductForm } from '@/components/admin/Inventory';
import Receive from '@/components/admin/Receive';
import Sell from '@/components/admin/Sell';
import Scanner from '@/components/admin/Scanner';
import Orders from '@/components/admin/Orders';
import Customers from '@/components/admin/Customers';

function norm(p) {
  const pv = Array.isArray(p.product_private) ? p.product_private[0] : p.product_private;
  return { ...p, cost: Number(pv?.cost ?? 0), qty: pv?.qty ?? 0, low_at: pv?.low_at ?? 5, supplier: pv?.supplier || '', location: pv?.location || '' };
}

function useAdminData() {
  const [d, setD] = useState({ products: null, orders: null, customers: null, settings: null, error: '' });
  const reload = useCallback(async () => {
    const [p, o, c, s, iv] = await Promise.all([
      supabase.from('products').select('*, product_private(*)').order('name'),
      supabase.from('orders').select('*, order_lines(*)').order('created_at', { ascending: false }).limit(500),
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('invoice_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setD({
      products: (p.data || []).map(norm), orders: o.data || [], customers: c.data || [], settings: s.data, invoice: iv.data || null,
      error: (p.error || o.error || c.error || s.error)?.message || '',
    });
  }, []);
  useEffect(() => {
    reload();
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);
  return [d, reload];
}

function Login({ notAdmin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr('That email and password did not match.');
  }
  return (
    <div className="wrap">
      <header className="top"><Link href="/" className="brand"><PlugIcon /><span>Back to shop</span></Link></header>
      <div className="sechead"><h2>Shop admin</h2></div>
      {notAdmin && <div className="notice">You are signed in, but this account is not set up as an admin. See README.md, step 4.</div>}
      <form className="form" style={{ marginTop: 16, maxWidth: 420 }} onSubmit={go}>
        <div className="fld"><label htmlFor="a-email">Email</label><input id="a-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
        <div className="fld"><label htmlFor="a-pass">Password</label><input id="a-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
        {err && <p className="pill bad">{err}</p>}
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
      </form>
      {notAdmin && <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => supabase.auth.signOut()}>Sign out</button>}
    </div>
  );
}

function AdminApp() {
  const [d, reload] = useAdminData();
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState(null); // { product, prefill, key }
  const [scanAdd, setScanAdd] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [toastNode, toast] = useToast();
  const newCount = (d.orders || []).filter((o) => o.status === 'new').length;
  const openForm = (product, prefill) => setForm({ product, prefill, key: Date.now() });
  const afterSave = (kind, carry) => {
    if (kind === 'again') setForm({ product: null, prefill: { carry, qty: '1' }, key: Date.now() });
    else if (kind === 'scan') setScanAdd(true);
  };
  // Scan to add: a known barcode opens that product, a new one opens a blank form with the barcode filled in.
  const onAddScan = (code) => {
    const c = code.trim();
    const k = c.toLowerCase();
    const hit = (d.products || []).find((p) => (p.barcode || '').toLowerCase() === k || (p.sku || '').toLowerCase() === k);
    setScanAdd(false);
    if (hit) { toast(`Already in inventory: ${hit.name}`); openForm(hit); return { ok: true, msg: hit.name }; }
    openForm(null, { barcode: c, qty: '1', then: 'scan' });
    return { ok: true, msg: c };
  };
  const goOrders = (id) => { setFocusId(id); setTab('orders'); window.scrollTo(0, 0); };
  const TABS = [['overview', 'Overview'], ['inventory', 'Inventory'], ['receive', 'Receive'], ['sell', 'Sell'], ['orders', 'Orders'], ['customers', 'Customers']];

  return (
    <div className="wrap fresh">
      <header className="top">
        <div className="brand"><PlugIcon /><span>{d.settings?.shop_name || 'Accessory Counter'}</span></div>
        <div className="top-r">
          <Link href="/" className="toplink">View shop</Link>
          <button type="button" className="btn sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      {d.error && <div className="notice">Could not load everything: {d.error}</div>}
      <main>
        {tab === 'overview' && <Overview d={d} reload={reload} toast={toast} openForm={openForm} goOrders={goOrders} />}
        {tab === 'inventory' && <Inventory d={d} openForm={openForm} onScanAdd={() => setScanAdd(true)} />}
        {tab === 'receive' && <Receive d={d} reload={reload} toast={toast} openForm={openForm} />}
        {tab === 'sell' && <Sell d={d} reload={reload} toast={toast} />}
        {tab === 'orders' && <Orders d={d} reload={reload} toast={toast} focusId={focusId} />}
        {tab === 'customers' && <Customers d={d} reload={reload} toast={toast} />}
      </main>
      <nav className="tabs" aria-label="Admin">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => { setTab(k); window.scrollTo(0, 0); }}>
            {l}{k === 'orders' && newCount > 0 && <span className="badge">{newCount}</span>}
          </button>
        ))}
      </nav>
      {form && <ProductForm key={form.key} product={form.product} prefill={form.prefill} reload={reload} toast={toast} onSaved={afterSave} onClose={() => setForm(null)} />}
      {scanAdd && <Scanner once title="Scan a product to add" doneLabel="Cancel" onClose={() => setScanAdd(false)} onScan={onAddScan} />}
      {toastNode}
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    if (!configured) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (!configured) return <div className="wrap"><div className="notice">This site is not connected to its database yet. Follow the setup steps in README.md.</div></div>;
  if (session === undefined || (session && isAdmin === null)) return <div className="wrap"><div className="empty"><p>Loading.</p></div></div>;
  if (!session) return <Login />;
  if (!isAdmin) return <Login notAdmin />;
  return <AdminApp />;
}
