'use client';
// Shared pieces of the public shop: top strip, header, footer.
// Used by the shop page ("/") and the order tracking page ("/track") so they always match.
import Link from 'next/link';
import { PlugIcon } from '@/components/ui';

export function StoreTop() {
  return (
    <div className="st-top">
      <div className="st-in">
        <span>Order online, pay when you collect</span>
        <Link href="/track">Track order</Link>
      </div>
    </div>
  );
}

export function StoreHeader({ name, simple = false, children }) {
  return (
    <header className="st-head">
      <div className={`st-in st-head-in${simple ? ' simple' : ''}`}>
        <Link href="/" className="st-brand" aria-label={`${name} home`}>
          <span className="st-logo"><PlugIcon /></span>
          <span className="st-name">{name}</span>
        </Link>
        {children}
      </div>
    </header>
  );
}

export function StoreFooter({ shop, cats = [], onCat }) {
  const year = new Date().getFullYear();
  return (
    <footer className="st-foot">
      <div className="st-in st-foot-grid">
        <div className="st-foot-brand">
          <Link href="/" className="st-brand light">
            <span className="st-logo"><PlugIcon /></span>
            <span className="st-name">{shop.shop_name}</span>
          </Link>
          <p>Phone cases, chargers, cables and more. Order online and pay when you collect.</p>
        </div>
        {onCat && cats.length > 0 && (
          <div>
            <b>Shop</b>
            {cats.slice(0, 6).map((c) => <button key={c} type="button" onClick={() => onCat(c)}>{c}</button>)}
          </div>
        )}
        <div>
          <b>Help</b>
          <Link href="/track">Track my order</Link>
          <Link href="/">Browse the shop</Link>
        </div>
        {shop.contact && (
          <div>
            <b>Visit us</b>
            <p>{shop.contact}</p>
          </div>
        )}
      </div>
      <div className="st-legal">
        <div className="st-in">&copy; {year} {shop.shop_name}</div>
      </div>
    </footer>
  );
}
