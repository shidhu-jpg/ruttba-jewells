/* Ruttba Jewels — WhatsApp store logic. Settings & products live in data.js */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const byId = id => PRODUCTS.find(p => p.id === id);
const catOf = id => CATEGORIES.find(c => c.id === id);
const off = p => Math.round((1 - p.price / p.mrp) * 100);

/* ---------- Drawn jewellery illustrations (used when a product has no photo) ---------- */
function qPoint(t, a, b, c) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
}
function beads(a, b, c, n, r, fill) {
  let s = '';
  for (let i = 0; i <= n; i++) { const [x, y] = qPoint(i / n, a, b, c); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"/>`; }
  return s;
}
const gem = (x, y, s = 10, f = 'url(#rj-ruby)') =>
  `<polygon points="${x},${y - s} ${x + s * .8},${y} ${x},${y + s * 1.2} ${x - s * .8},${y}" fill="${f}" stroke="#fff6" stroke-width="1"/>`;
const drop = (x, y, s = 1, f = 'url(#rj-gold)') =>
  `<path d="M${x} ${y} C ${x + 12 * s} ${y + 14 * s}, ${x + 10 * s} ${y + 30 * s}, ${x} ${y + 30 * s} C ${x - 10 * s} ${y + 30 * s}, ${x - 12 * s} ${y + 14 * s}, ${x} ${y}Z" fill="${f}"/>`;

const ART = {
  ring: () => `<circle cx="100" cy="122" r="44" fill="none" stroke="url(#rj-gold)" stroke-width="11"/>
    <path d="M86 80 L100 60 L114 80" fill="none" stroke="url(#rj-gold)" stroke-width="5"/>${gem(100, 64, 16, 'url(#rj-diamond)')}`,
  necklace: () => `<path d="M38 40 Q100 170 162 40" fill="none" stroke="url(#rj-gold)" stroke-width="4"/>
    ${beads([38, 40], [100, 170], [162, 40], 16, 5, 'url(#rj-gold)')}${drop(100, 108, 1.1)}${gem(100, 124, 7)}`,
  earrings: () => [70, 130].map(x => `<path d="M${x} 40 q 10 -12 14 4" fill="none" stroke="url(#rj-gold)" stroke-width="3"/>
    <circle cx="${x}" cy="62" r="11" fill="url(#rj-gold)"/>${gem(x, 62, 6)}
    <path d="M${x - 22} 112 Q ${x} 70 ${x + 22} 112 Z" fill="url(#rj-gold)"/>
    ${beads([x - 22, 116], [x, 128], [x + 22, 116], 5, 3, '#fff')}`).join(''),
  bangles: () => `<ellipse cx="100" cy="86" rx="62" ry="24" fill="none" stroke="url(#rj-gold)" stroke-width="10"/>
    <ellipse cx="100" cy="118" rx="62" ry="24" fill="none" stroke="url(#rj-gold)" stroke-width="10"/>
    ${[52, 76, 100, 124, 148].map(x => `<circle cx="${x}" cy="${140 - Math.abs(100 - x) * .28}" r="3.5" fill="url(#rj-ruby)"/>`).join('')}`,
  bracelet: () => `${beads([30, 80], [100, 170], [170, 80], 14, 8, 'url(#rj-diamond)')}${beads([30, 80], [100, 170], [170, 80], 14, 3, '#fff')}`,
  pendant: () => `<path d="M48 30 L100 104 L152 30" fill="none" stroke="url(#rj-gold)" stroke-width="3"/>
    <circle cx="100" cy="108" r="6" fill="none" stroke="url(#rj-gold)" stroke-width="3"/>${drop(100, 114, 1.6, 'url(#rj-gold)')}${gem(100, 146, 9, 'url(#rj-emerald)')}`,
  bridal: () => `<path d="M30 30 Q100 130 170 30" fill="none" stroke="url(#rj-gold)" stroke-width="3"/>
    ${beads([30, 30], [100, 130], [170, 30], 14, 6, 'url(#rj-gold)')}
    <path d="M44 34 Q100 190 156 34" fill="none" stroke="url(#rj-gold)" stroke-width="3"/>
    ${beads([44, 34], [100, 190], [156, 34], 18, 4, '#fff')}${gem(100, 84, 10)}${gem(76, 72, 6, 'url(#rj-emerald)')}${gem(124, 72, 6, 'url(#rj-emerald)')}${drop(100, 112, 1.3)}`,
  silver: () => `<path d="M30 70 Q100 150 170 70" fill="none" stroke="url(#rj-silver)" stroke-width="5"/>
    ${beads([30, 70], [100, 150], [170, 70], 12, 4, 'url(#rj-silver)')}
    ${[.17, .33, .5, .67, .83].map(t => { const [x, y] = qPoint(t, [30, 70], [100, 150], [170, 70]); return `<circle cx="${x}" cy="${y + 14}" r="7" fill="url(#rj-silver)"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 8}" stroke="#aaa" stroke-width="2"/>`; }).join('')}`,
};
function artFor(p) {
  const key = p.art || catOf(p.cat)?.art || 'ring';
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(p.name)}">${ART[key]()}</svg>`;
}
function media(p) {
  return p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : artFor(p);
}

/* ---------- State ---------- */
let cart = store.get('rj-cart', []);            // [{key,id,size,qty}]
let coupon = store.get('rj-coupon', '');
let checkoutItems = null;                        // null = cart, otherwise a buy-now list
const filter = { cat: 'all', q: '', best: false, sort: 'featured' };

function saveCart() { store.set('rj-cart', cart); renderCartBadge(); }

/* ---------- Static store details ---------- */
function fillStore() {
  document.title = `${STORE.name} — Order on WhatsApp`;
  $$('[data-store]').forEach(el => { el.textContent = STORE[el.dataset.store]; });
  $$('[data-wa]').forEach(el => { el.href = waLink(el.dataset.wa || `Hello ${STORE.name}, I'd like to know more about your jewellery.`); el.target = '_blank'; el.rel = 'noopener'; });
  $$('[data-tel]').forEach(el => { el.href = 'tel:' + STORE.phone.replace(/\s/g, ''); });
  $$('[data-mail]').forEach(el => { el.href = 'mailto:' + STORE.email; });
  $$('[data-map]').forEach(el => { el.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(STORE.mapQuery + ' ' + STORE.address); el.target = '_blank'; el.rel = 'noopener'; });
  $$('[data-social]').forEach(el => { const url = STORE[el.dataset.social]; if (url) { el.href = url; el.target = '_blank'; el.rel = 'noopener'; } else el.remove(); });
  $('#marquee').innerHTML = Array(4).fill(`<span>✦ ${esc(STORE.offerText)}</span>`).join('');
  $('#coupon-chips').innerHTML = Object.entries(STORE.coupons)
    .map(([c, pc]) => `<button class="chip-code" data-copy="${c}"><b>${c}</b><small>${pc}% off</small></button>`).join('');
  $('#year').textContent = new Date().getFullYear();
}
const waLink = text => `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;

/* ---------- Categories ---------- */
function renderCategories() {
  const count = id => PRODUCTS.filter(p => p.cat === id).length;
  $('#cat-grid').innerHTML = CATEGORIES.map(c => `
    <button class="cat" data-cat="${c.id}">
      <span class="cat-art">${c.img ? `<img src="${esc(c.img)}" alt="">` : `<svg viewBox="0 0 200 200">${ART[c.art]()}</svg>`}</span>
      <span class="cat-name">${esc(c.name)}</span>
      <span class="cat-count">${count(c.id)} items</span>
    </button>`).join('');
  $('#filter-chips').innerHTML = [{ id: 'all', name: 'All' }, ...CATEGORIES]
    .map(c => `<button class="fchip" data-fcat="${c.id}">${esc(c.name)}</button>`).join('');
}

/* ---------- Product cards ---------- */
function card(p) {
  return `<article class="card" data-open="${p.id}">
    <div class="card-media">${media(p)}
      ${p.best ? '<span class="badge">Best Seller</span>' : ''}
      ${p.mrp > p.price ? `<span class="badge off">${off(p)}% OFF</span>` : ''}
    </div>
    <div class="card-body">
      <small class="card-cat">${esc(catOf(p.cat)?.name)}</small>
      <h3>${esc(p.name)}</h3>
      <p class="card-meta">${esc(p.purity)}${p.weight ? ' · ' + esc(p.weight) : ''}</p>
      <div class="rating">★ ${p.rating.toFixed(1)}</div>
      <div class="price"><b>${inr(p.price)}</b>${p.mrp > p.price ? `<s>${inr(p.mrp)}</s>` : ''}</div>
      <div class="card-actions">
        <button class="btn btn-ghost" data-add="${p.id}">Add to Cart</button>
        <button class="btn btn-wa" data-buy="${p.id}">Order Now</button>
      </div>
    </div>
  </article>`;
}

function renderProducts() {
  const q = filter.q.trim().toLowerCase();
  let list = PRODUCTS.filter(p =>
    (filter.cat === 'all' || p.cat === filter.cat) &&
    (!filter.best || p.best) &&
    (!q || `${p.name} ${p.purity} ${catOf(p.cat)?.name} ${p.desc}`.toLowerCase().includes(q)));
  if (filter.sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
  if (filter.sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
  if (filter.sort === 'off') list = [...list].sort((a, b) => off(b) - off(a));
  $('#product-grid').innerHTML = list.length ? list.map(card).join('')
    : `<p class="empty">No pieces match your search. <a data-wa href="#">Ask us on WhatsApp</a> — we may have it in store.</p>`;
  $$('#product-grid [data-wa]').forEach(a => { a.href = waLink(`Hi, I'm looking for: ${filter.q || 'jewellery'}`); a.target = '_blank'; });
  $$('.fchip').forEach(b => b.classList.toggle('on', b.dataset.fcat === filter.cat));
  $('#best-toggle').classList.toggle('on', filter.best);
  $('#result-count').textContent = `${list.length} piece${list.length === 1 ? '' : 's'}`;
}

function renderBest() {
  $('#best-row').innerHTML = PRODUCTS.filter(p => p.best).map(card).join('');
}

function showProducts(opts = {}) {
  Object.assign(filter, opts);
  renderProducts();
  $('#products').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Product detail ---------- */
function openProduct(id) {
  const p = byId(id); if (!p) return;
  $('#pd').innerHTML = `
    <div class="pd-media">${media(p)}</div>
    <div class="pd-info">
      <small class="card-cat">${esc(catOf(p.cat)?.name)}${p.best ? ' · Best Seller' : ''}</small>
      <h2>${esc(p.name)}</h2>
      <div class="rating">★ ${p.rating.toFixed(1)} · ${esc(p.purity)}${p.weight ? ' · ' + esc(p.weight) : ''}</div>
      <div class="price big"><b>${inr(p.price)}</b>${p.mrp > p.price ? `<s>${inr(p.mrp)}</s><em>${off(p)}% off</em>` : ''}</div>
      <p class="muted">${esc(p.desc)}</p>
      ${p.sizes ? `<label class="field"><span>Size</span><select id="pd-size">${p.sizes.map(s => `<option>${esc(s)}</option>`).join('')}</select></label>` : ''}
      <ul class="pd-points">
        <li>BIS hallmark / purity certificate where applicable</li>
        <li>Price inclusive of making; ${STORE.gstPercent}% GST added at checkout</li>
        <li>Final price confirmed on WhatsApp as per today's metal rate</li>
      </ul>
      <div class="card-actions">
        <button class="btn btn-ghost" data-add="${p.id}" data-from-pd>Add to Cart</button>
        <button class="btn btn-wa" data-buy="${p.id}" data-from-pd>Order on WhatsApp</button>
      </div>
      <a class="link" data-wa href="#">Ask a question about this piece →</a>
    </div>`;
  const ask = $('#pd [data-wa]'); ask.href = waLink(`Hi ${STORE.name}, I have a question about "${p.name}" (${inr(p.price)}).`); ask.target = '_blank';
  openSheet('product-sheet');
}
const pdSize = () => $('#pd-size')?.value || '';

/* ---------- Cart ---------- */
function addToCart(id, size = '', qty = 1) {
  const p = byId(id); if (!p) return;
  if (p.sizes && !size) size = p.sizes[0];
  const key = id + '|' + size;
  const line = cart.find(l => l.key === key);
  line ? line.qty += qty : cart.push({ key, id, size, qty });
  saveCart();
  toast(`${p.name} added to cart`);
}

function totals(items) {
  const sub = items.reduce((s, l) => s + byId(l.id).price * l.qty, 0);
  const pc = STORE.coupons[coupon] || 0;
  const disc = Math.round(sub * pc / 100);
  const taxable = sub - disc;
  const gst = Math.round(taxable * STORE.gstPercent / 100);
  const delivery = !items.length || (STORE.freeDeliveryAbove && sub >= STORE.freeDeliveryAbove) ? 0 : STORE.deliveryCharge;
  return { sub, pc, disc, gst, delivery, total: taxable + gst + delivery, count: items.reduce((s, l) => s + l.qty, 0) };
}

function totalsHtml(t) {
  return `<div class="tot"><span>Items (${t.count})</span><b>${inr(t.sub)}</b></div>
    ${t.disc ? `<div class="tot save"><span>Coupon ${esc(coupon)} (−${t.pc}%)</span><b>−${inr(t.disc)}</b></div>` : ''}
    <div class="tot"><span>GST (${STORE.gstPercent}%)</span><b>${inr(t.gst)}</b></div>
    <div class="tot"><span>Delivery</span><b>${t.delivery ? inr(t.delivery) : 'FREE'}</b></div>
    <div class="tot grand"><span>Grand Total</span><b>${inr(t.total)}</b></div>`;
}

function renderCartBadge() {
  const n = cart.reduce((s, l) => s + l.qty, 0);
  $$('.cart-count').forEach(el => { el.textContent = n; el.hidden = !n; });
}

function renderCart() {
  const body = $('#cart-body');
  if (!cart.length) {
    body.innerHTML = `<div class="empty"><p>Your cart is empty.</p><button class="btn btn-gold" data-close>Continue shopping</button></div>`;
    $('#cart-foot').hidden = true; return;
  }
  body.innerHTML = cart.map(l => {
    const p = byId(l.id);
    return `<div class="line">
      <div class="line-media" data-open="${p.id}">${media(p)}</div>
      <div class="line-info">
        <b>${esc(p.name)}</b>
        <small>${esc(p.purity)}${l.size ? ' · Size ' + esc(l.size) : ''}</small>
        <span>${inr(p.price)}</span>
      </div>
      <div class="qty">
        <button data-qty="${esc(l.key)}" data-d="-1" aria-label="Decrease">−</button>
        <span>${l.qty}</span>
        <button data-qty="${esc(l.key)}" data-d="1" aria-label="Increase">+</button>
      </div>
    </div>`;
  }).join('');
  $('#cart-foot').hidden = false;
  $('#coupon-input').value = coupon;
  $('#coupon-msg').textContent = coupon ? `${coupon} applied — ${STORE.coupons[coupon]}% off` : '';
  $('#cart-totals').innerHTML = totalsHtml(totals(cart));
}

function applyCoupon(code) {
  code = code.trim().toUpperCase();
  const msg = $('#coupon-msg');
  if (!code) { coupon = ''; store.set('rj-coupon', ''); renderCart(); return; }
  if (!STORE.coupons[code]) { msg.textContent = 'Invalid coupon code'; msg.className = 'coupon-msg err'; return; }
  coupon = code; store.set('rj-coupon', code);
  renderCart(); $('#coupon-msg').className = 'coupon-msg ok';
}

/* ---------- Checkout → WhatsApp ---------- */
function openCheckout(items) {
  checkoutItems = items;
  const list = items || cart;
  if (!list.length) return toast('Your cart is empty');
  const saved = store.get('rj-customer', {});
  const f = $('#checkout-form');
  ['name', 'phone', 'address', 'city', 'pincode'].forEach(k => { if (saved[k]) f[k].value = saved[k]; });
  $('#co-items').innerHTML = list.map(l => { const p = byId(l.id); return `<div class="tot"><span>${esc(p.name)}${l.size ? ` (${esc(l.size)})` : ''} × ${l.qty}</span><b>${inr(p.price * l.qty)}</b></div>`; }).join('');
  $('#co-totals').innerHTML = totalsHtml(totals(list));
  toggleAddress();
  openSheet('checkout-sheet');
}

function toggleAddress() {
  const pickup = $('#checkout-form').mode.value === 'pickup';
  $$('.addr-field').forEach(el => { el.hidden = pickup; $$('input,textarea', el).forEach(i => i.required = !pickup); });
}

function placeOrder(e) {
  e.preventDefault();
  const f = e.target;
  const phone = f.phone.value.replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) { toast('Please enter a valid 10-digit mobile number'); f.phone.focus(); return; }
  const list = checkoutItems || cart;
  const t = totals(list);
  const now = new Date();
  const id = 'RJ' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  const c = { name: f.name.value.trim(), phone, address: f.address.value.trim(), city: f.city.value.trim(), pincode: f.pincode.value.trim() };
  store.set('rj-customer', c);
  const pickup = f.mode.value === 'pickup';

  const lines = list.map((l, i) => { const p = byId(l.id); return `${i + 1}. ${p.name}${l.size ? ` (Size ${l.size})` : ''} — ${p.purity}\n    ${l.qty} × ${inr(p.price)} = ${inr(p.price * l.qty)}`; });
  const msg = [
    `*New Order — ${STORE.name}*`,
    `Order ID: ${id}`,
    '',
    ...lines,
    '',
    `Subtotal: ${inr(t.sub)}`,
    t.disc ? `Coupon ${coupon}: −${inr(t.disc)}` : null,
    `GST (${STORE.gstPercent}%): ${inr(t.gst)}`,
    `Delivery: ${pickup ? 'Store pickup' : t.delivery ? inr(t.delivery) : 'Free'}`,
    `*Total: ${inr(pickup ? t.total - t.delivery : t.total)}*`,
    '',
    `*Customer*`,
    `${c.name} · ${phone}`,
    pickup ? 'Will collect from store' : `${c.address}, ${c.city} – ${c.pincode}`,
    `Payment: ${f.pay.value}`,
    f.note.value.trim() ? `Note: ${f.note.value.trim()}` : null,
  ].filter(x => x !== null).join('\n');

  const orders = store.get('rj-orders', []);
  orders.unshift({ id, at: now.toISOString(), items: list.map(l => ({ name: byId(l.id).name, size: l.size, qty: l.qty, price: byId(l.id).price })), total: pickup ? t.total - t.delivery : t.total, msg });
  store.set('rj-orders', orders.slice(0, 30));

  if (!checkoutItems) { cart = []; saveCart(); }
  coupon = ''; store.set('rj-coupon', '');
  window.open(waLink(msg), '_blank');
  closeSheets();
  toast('Order sent to WhatsApp — we will confirm shortly');
}

/* ---------- My Orders ---------- */
function renderOrders() {
  const orders = store.get('rj-orders', []);
  $('#orders-body').innerHTML = orders.length ? orders.map((o, i) => `
    <div class="order">
      <div class="order-head"><b>${esc(o.id)}</b><small>${new Date(o.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
      <ul>${o.items.map(it => `<li>${esc(it.name)}${it.size ? ` (${esc(it.size)})` : ''} × ${it.qty}</li>`).join('')}</ul>
      <div class="order-foot"><b>${inr(o.total)}</b><a class="btn btn-wa sm" target="_blank" rel="noopener" href="${waLink(`Hi, I'd like an update on my order ${o.id}.`)}">Track on WhatsApp</a>
      <button class="btn btn-ghost sm" data-resend="${i}">Resend</button></div>
    </div>`).join('')
    : `<div class="empty"><p>No orders yet. Orders you place from this phone appear here.</p></div>`;
}

/* ---------- Catalogue (printable PDF) ---------- */
function renderCatalog() {
  $('#catalog-body').innerHTML = CATEGORIES.map(c => {
    const items = PRODUCTS.filter(p => p.cat === c.id); if (!items.length) return '';
    return `<h3 class="cat-h">${esc(c.name)}</h3><div class="cat-list">${items.map(p => `
      <div class="cat-item"><div class="ci-media">${media(p)}</div><div><b>${esc(p.name)}</b><small>${esc(p.purity)}${p.weight ? ' · ' + esc(p.weight) : ''}</small><span>${inr(p.price)} ${p.mrp > p.price ? `<s>${inr(p.mrp)}</s>` : ''}</span></div></div>`).join('')}</div>`;
  }).join('');
}

/* ---------- Policies ---------- */
const POLICIES = {
  privacy: ['Privacy Policy', `We collect only the details you type at checkout (name, phone, address) to process your order over WhatsApp. These details are stored on your own device to pre-fill future orders and are shared with ${STORE.name} only when you send the WhatsApp message. We never sell or share your information with third parties.`],
  terms: ['Terms & Conditions', `Prices shown are indicative and may change with daily gold/silver rates. Your order is confirmed only after ${STORE.name} confirms the final price, availability and payment on WhatsApp. Product photos and illustrations are representative; weight may vary slightly for handcrafted pieces.`],
  shipping: ['Shipping & Delivery', `Ready pieces are dispatched within 2–4 working days through insured courier with tamper-proof packaging. Made-to-order pieces take 10–20 days. Store pickup is available during ${STORE.hours}. Tracking details are shared on WhatsApp.`],
  refund: ['Refund & Cancellation', 'Orders can be cancelled before dispatch for a full refund. Damaged or incorrect items must be reported on WhatsApp within 48 hours of delivery with an unboxing video. Customised, resized or engraved pieces cannot be returned. Exchange on gold jewellery is available at the prevailing rate as per store policy.'],
};
function openPolicy(k) {
  const [title, body] = POLICIES[k];
  $('#policy-title').textContent = title;
  $('#policy-body').innerHTML = `<p>${esc(body)}</p><p class="muted">Questions? <a data-wa href="#">Chat with us on WhatsApp</a>.</p>`;
  const a = $('#policy-body [data-wa]'); a.href = waLink(`Hi, I have a question about your ${title}.`); a.target = '_blank';
  openSheet('policy-sheet');
}

/* ---------- Sheets & toast ---------- */
function openSheet(id) {
  $$('.sheet.open').forEach(s => s.id !== id && s.classList.remove('open'));
  $('#' + id).classList.add('open');
  $('#scrim').classList.add('open');
  document.body.classList.add('locked');
}
function closeSheets() {
  $$('.sheet.open').forEach(s => s.classList.remove('open'));
  $('#scrim').classList.remove('open');
  document.body.classList.remove('locked');
}
let toastTimer;
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, a, [data-open]'); if (!t) return;
  const d = t.dataset;
  if (d.add) { e.stopPropagation(); addToCart(d.add, 'fromPd' in d ? pdSize() : ''); if ('fromPd' in d) closeSheets(); return; }
  if (d.buy) { e.stopPropagation(); const p = byId(d.buy); openCheckout([{ key: d.buy, id: d.buy, size: 'fromPd' in d ? pdSize() : (p.sizes?.[0] || ''), qty: 1 }]); return; }
  if (d.open) return openProduct(d.open);
  if (d.cat) return showProducts({ cat: d.cat, best: false, q: '' });
  if (d.fcat) return (filter.cat = d.fcat, renderProducts());
  if (d.qty) {
    const l = cart.find(x => x.key === d.qty); l.qty += +d.d;
    if (l.qty < 1) cart = cart.filter(x => x !== l);
    saveCart(); return renderCart();
  }
  if (d.copy) { navigator.clipboard?.writeText(d.copy).catch(() => {}); coupon = d.copy; store.set('rj-coupon', d.copy); return toast(`${d.copy} copied & will be applied at checkout`); }
  if (d.policy) { e.preventDefault(); return openPolicy(d.policy); }
  if (d.resend !== undefined) { const o = store.get('rj-orders', [])[+d.resend]; if (o) window.open(waLink(o.msg), '_blank'); return; }
  if ('close' in d) return closeSheets();
  if (d.action) {
    e.preventDefault();
    ({
      cart: () => { renderCart(); openSheet('cart-sheet'); },
      checkout: () => openCheckout(null),
      orders: () => { renderOrders(); openSheet('orders-sheet'); },
      catalog: () => { renderCatalog(); openSheet('catalog-sheet'); },
      print: () => window.print(),
      best: () => showProducts({ best: true, cat: 'all', q: '' }),
      all: () => showProducts({ best: false, cat: 'all', q: '' }),
      home: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      cats: () => $('#categories').scrollIntoView({ behavior: 'smooth' }),
      search: () => { $('#products').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => $('#search').focus(), 350); },
      install: () => installApp(),
    })[d.action]?.();
  }
});
$('#scrim').addEventListener('click', closeSheets);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheets(); });
$('#search').addEventListener('input', e => { filter.q = e.target.value; renderProducts(); });
$('#sort').addEventListener('change', e => { filter.sort = e.target.value; renderProducts(); });
$('#best-toggle').addEventListener('click', () => { filter.best = !filter.best; renderProducts(); });
$('#coupon-apply').addEventListener('click', () => applyCoupon($('#coupon-input').value));
$('#checkout-form').addEventListener('submit', placeOrder);
$('#checkout-form').addEventListener('change', e => { if (e.target.name === 'mode') toggleAddress(); });

/* Header shadow + bottom-nav highlight */
const header = $('.top');
addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 10), { passive: true });

/* ---------- PWA install ---------- */
let deferredPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $$('[data-action="install"]').forEach(b => b.hidden = false); });
function installApp() {
  if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; return; }
  toast('On iPhone: tap Share → "Add to Home Screen"');
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- Boot ---------- */
fillStore();
renderCategories();
renderBest();
renderProducts();
renderCartBadge();
