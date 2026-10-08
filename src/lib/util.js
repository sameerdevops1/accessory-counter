export const CATS = ['Phone cases', 'Screen protectors', 'Chargers', 'Cables', 'Power banks', 'Earphones', 'Car accessories', 'Smartwatch accessories'];
export const FLOW = ['new', 'confirmed', 'preparing', 'ready', 'completed'];
export const STATUS_LABEL = { new: 'New', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready / Dispatched', completed: 'Completed', cancelled: 'Cancelled' };
export const NEXT_LABEL = { new: 'Confirm order', confirmed: 'Start preparing', preparing: 'Mark ready', ready: 'Complete order' };

export const gbp = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(n) || 0);
export const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};
export const r2 = (n) => Math.round(n * 100) / 100;

// Mirrors phone_key() in supabase/schema.sql.
export const phoneKey = (p) => String(p || '').replace(/\D/g, '').replace(/^(00)?44/, '0');

export function ago(t) {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export const when = (t) =>
  new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Shrinks a phone photo before upload so product pages load fast.
export async function downscale(file, max = 900) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.82));
  } catch {
    return file;
  }
}
