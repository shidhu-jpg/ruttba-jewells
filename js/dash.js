/* Staff & owner dashboards (staff.html, admin.html).
   Polls Supabase every 20 s; a new customer click plays a chime, shows a toast and a phone notification.
   Both can add products; the owner also manages staff and their own login. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const OWNER = document.body.dataset.page === 'owner';
const POLL_MS = 20000;
const SEEN_KEY = OWNER ? 'rj-seen-owner' : 'rj-seen-staff';
const BASE_TITLE = document.title;
const TABS = OWNER
  ? [['activity', 'Activity'], ['products', 'Products'], ['staff', 'Staff'], ['settings', 'Settings']]
  : [['activity', 'My clicks'], ['products', 'Products']];

let feed = null;                                 // last response from rj_owner_feed / rj_staff_feed
let products = null;                             // rj_products_manage (incl. hidden pieces)
let alerted = 0;                                 // highest event id already alerted in this session
let seen = RJ.ls.get(SEEN_KEY, 0);               // highest event id the user has looked at (newer ones get a NEW tag)
let tab = 'activity', staffFilter = '', editing = null, prodEditing = null, prodQuery = '', ownerName = '', timer = null;

const token = () => OWNER ? RJ.owner() : RJ.staff()?.token;
const staffById = id => feed.staff.find(s => s.id === id);
const prodById = id => products?.find(p => p.id === id);
const catName = id => CATEGORIES.find(c => c.id === id)?.name || id;
const fmtPhone = p => p ? `${p.slice(0, 5)} ${p.slice(5)}` : '';
const empty = text => `<li class="ev-empty">${text}</li>`;

function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
const stamp = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/* ---------- Event rows ---------- */
const plain = e => e.kind === 'order' ? `Order sent: ${e.product_name}` : `Customer opened ${e.product_id ? e.product_name : 'the store'}`;
function eventItem(e) {
  const what = e.kind === 'order' ? `sent an order on WhatsApp — <b>${esc(e.product_name)}</b>`
    : e.product_id ? `opened <b>${esc(e.product_name)}</b>` : 'opened the store';
  const isNew = e.id > seen;
  return `<li class="ev ${e.kind}${isNew ? ' new' : ''}">
    <span class="ev-ico">${e.kind === 'order' ? '🛍️' : '👀'}</span>
    <div class="ev-body">
      <p>A customer ${what}</p>
      ${OWNER ? `<p class="ev-staff">via <b>${esc(e.staff_name)}</b> · <a href="tel:+91${esc(e.staff_phone)}">${fmtPhone(e.staff_phone)}</a> · <a href="https://wa.me/91${esc(e.staff_phone)}" target="_blank" rel="noopener">WhatsApp</a></p>` : ''}
      <small>${e.detail ? esc(e.detail) + ' · ' : ''}${esc(e.device)} · <time title="${stamp(e.created_at)}">${ago(e.created_at)}</time></small>
    </div>
    ${isNew ? '<span class="ev-new">NEW</span>' : ''}
  </li>`;
}

const tiles = s => `<div class="tiles">
  <div class="tile"><b>${s.today}</b><span>Clicks today</span></div>
  <div class="tile"><b>${s.week}</b><span>Last 7 days</span></div>
  <div class="tile"><b>${s.total}</b><span>All clicks</span></div>
  <div class="tile gold"><b>${s.orders}</b><span>Orders</span></div>
</div>`;

const unseenCount = () => feed ? feed.events.filter(e => e.id > seen).length : 0;
const unseenBtn = () => unseenCount() ? `<button class="link" data-seen>Mark all as seen</button>` : '';

function alertsBtn() {
  if (!('Notification' in window)) {
    return /iPhone|iPad/i.test(navigator.userAgent) ? `<p class="muted small">For alerts on iPhone: Share → <b>Add to Home Screen</b>, then open from there.</p>` : '';
  }
  if (Notification.permission === 'granted') return `<span class="pill on">🔔 Alerts on</span>`;
  if (Notification.permission === 'denied') return `<span class="pill">🔕 Alerts blocked in browser settings</span>`;
  return `<button class="btn btn-gold sm" data-alerts>🔔 Turn on alerts</button>`;
}

/* ---------- Activity tab ---------- */
function activityTab() {
  const { stats, events } = feed;
  if (!OWNER) {
    const s = feed.staff;
    return `
      <div class="hello">
        <div><small class="muted">Welcome back</small><h1>${esc(s.name)}</h1>
          <p class="muted">Your code <b class="code">${esc(s.ref)}</b> · ${fmtPhone(s.phone)}</p></div>
        ${alertsBtn()}
      </div>
      ${tiles(stats)}
      <div class="row"><a class="btn btn-wa grow" href="./">Open the store &amp; share</a><button class="btn btn-ghost grow" data-tab="products">Products, links &amp; photos</button></div>
      <p class="muted small center">Tap <b>Share to Status</b> on any piece → WhatsApp → <b>My status</b>.</p>
      <div class="sec-head"><h2>Customers who opened your links</h2>${unseenBtn()}</div>
      <ul class="feed">${events.length ? events.map(eventItem).join('') : empty('No clicks yet. Share a piece on your status to get started.')}</ul>`;
  }
  const staff = feed.staff;
  const list = staffFilter ? events.filter(e => e.staff_id === staffFilter) : events;
  const top = staff.filter(s => s.views || s.orders).slice(0, 5);
  return `
    <div class="hello"><div><h1>Customer clicks</h1><p class="muted">Updates every 20 seconds</p></div>${alertsBtn()}</div>
    ${tiles(stats)}
    ${top.length ? `<h2 class="dash-h">Top staff</h2><ol class="board">${top.map(s => `<li><b>${esc(s.name)}</b><span>${s.today} today · ${s.views} clicks · ${s.orders} orders</span></li>`).join('')}</ol>` : ''}
    <div class="sec-head"><h2>Live activity</h2>
      <select id="staff-filter" aria-label="Filter by staff"><option value="">All staff</option>${staff.map(s => `<option value="${s.id}"${s.id === staffFilter ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    </div>
    ${unseenBtn()}
    <ul class="feed">${list.length ? list.map(eventItem).join('') : empty(staff.length ? 'No customer clicks yet.' : 'Add your staff in the Staff tab to get started.')}</ul>`;
}

/* ---------- Products tab (owner + staff) ---------- */
function productForm() {
  const p = prodEditing === 'new' ? null : prodById(prodEditing);
  return `<form class="dash-card" id="prod-form">
    <h2>${p ? 'Edit ' + esc(p.name) : 'Add a new piece'}</h2>
    <label class="photo-pick">
      <input type="file" name="photo" accept="image/*" hidden>
      <span class="photo-box">${p?.img ? `<img id="photo-preview" src="${esc(p.img)}" alt="">` : '<img id="photo-preview" alt="" hidden>'}<em>${p?.img ? 'Tap to change photo' : '📷 Tap to add a photo'}</em></span>
    </label>
    <label class="field"><span>Name *</span><input name="name" required maxlength="120" value="${esc(p?.name)}" placeholder="e.g. Polki Choker Set"></label>
    <div class="two">
      <label class="field"><span>Category *</span><select name="cat" required>${CATEGORIES.map(c => `<option value="${c.id}"${c.id === p?.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Purity</span><input name="purity" maxlength="60" value="${esc(p?.purity)}" placeholder="22K Hallmarked"></label>
    </div>
    <div class="two">
      <label class="field"><span>Price ₹ *</span><input name="price" required inputmode="numeric" value="${p?.price ?? ''}" placeholder="86800"></label>
      <label class="field"><span>MRP ₹ (before discount)</span><input name="mrp" inputmode="numeric" value="${p && p.mrp > p.price ? p.mrp : ''}" placeholder="optional"></label>
    </div>
    <div class="two">
      <label class="field"><span>Weight</span><input name="weight" maxlength="40" value="${esc(p?.weight)}" placeholder="12.4 g"></label>
      <label class="field"><span>Sizes (comma separated)</span><input name="sizes" value="${esc(p?.sizes?.join(', '))}" placeholder="optional, e.g. 12, 14, 16"></label>
    </div>
    <label class="field"><span>Description</span><textarea name="desc" rows="2" maxlength="1000">${esc(p?.desc)}</textarea></label>
    <label class="check"><input type="checkbox" name="best"${p?.best ? ' checked' : ''}> Show in Best Sellers</label>
    <div class="row"><button class="btn btn-gold">${p ? 'Save changes' : 'Add to store'}</button><button type="button" class="btn btn-ghost" data-prodcancel>Cancel</button></div>
    <p class="form-msg" id="prod-msg"></p>
  </form>`;
}

function prodItem(p) {
  return `<li class="prod${p.active ? '' : ' off'}">
    <div class="prod-img">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}</div>
    <div class="prod-info">
      <b>${esc(p.name)}</b>${p.active ? '' : ' <em>Hidden</em>'}
      <small>${esc(catName(p.cat))}${p.purity ? ' · ' + esc(p.purity) : ''}${p.weight ? ' · ' + esc(p.weight) : ''}</small>
      <span class="prod-price">${inr(p.price)}${p.mrp > p.price ? ` <s>${inr(p.mrp)}</s>` : ''}</span>
      <small>Added by ${esc(p.added_by_name)}</small>
    </div>
    <div class="prod-actions">
      ${p.active ? `<button class="btn btn-share sm" data-pact="share" data-pid="${p.id}">Share</button>
      <button class="btn btn-ghost sm" data-pact="copy" data-pid="${p.id}">Copy link</button>` : ''}
      ${p.img ? `<button class="btn btn-ghost sm" data-pact="download" data-pid="${p.id}">Download photo</button>` : ''}
      ${p.can_edit ? `<button class="btn btn-ghost sm" data-pedit="${p.id}">Edit</button>` : ''}
      ${OWNER ? `<button class="btn btn-ghost sm" data-phide="${p.id}">${p.active ? 'Hide' : 'Show'}</button>` : ''}
      ${p.can_edit ? `<button class="btn sm danger" data-pdel="${p.id}">Delete</button>` : ''}
    </div>
  </li>`;
}

function renderProdList() {
  const box = $('#prod-list'); if (!box || !products) return;
  const q = prodQuery.trim().toLowerCase();
  const list = products.filter(p => !q || `${p.name} ${p.purity} ${catName(p.cat)} ${p.added_by_name}`.toLowerCase().includes(q));
  box.innerHTML = list.length ? list.map(prodItem).join('') : empty(products.length ? 'No pieces match your search.' : 'No pieces yet — add the first one.');
}

function productsTab() {
  if (!products) { loadProducts(); return '<p class="muted center">Loading products…</p>'; }
  return `
    <div class="hello"><div><h1>Products</h1><p class="muted">${products.filter(p => p.active).length} live on the store${OWNER ? '' : ' · copy links and download photos here'}</p></div>
      ${prodEditing ? '' : '<button class="btn btn-gold" data-prodnew>+ Add product</button>'}</div>
    ${prodEditing ? productForm() : ''}
    <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="prod-q" type="search" placeholder="Search pieces…" value="${esc(prodQuery)}" autocomplete="off"></label>
    <ul class="prod-list" id="prod-list"></ul>`;
}

let productsLoading = false;
async function loadProducts() {
  if (productsLoading) return;
  productsLoading = true;
  try { products = await RJ.rpc('rj_products_manage', { p_token: token() }); if (tab === 'products') render(); }
  catch (err) { if (!sessionEnded(err)) toast(err.message); }
  productsLoading = false;
}

/* ---------- Staff tab (owner) ---------- */
const staffCard = s => `<li class="staff-item${s.active ? '' : ' off'}">
  <div>
    <b>${esc(s.name)}</b>${s.active ? '' : ' <em>Switched off</em>'}
    <small>${fmtPhone(s.phone)} · code ${esc(s.ref)}</small>
    <small>${s.views} clicks · ${s.orders} orders${s.last ? ' · last ' + ago(s.last) : ''}</small>
  </div>
  <div class="row">
    <button class="btn btn-ghost sm" data-edit="${s.id}">Edit</button>
    <button class="btn btn-ghost sm" data-toggle="${s.id}">${s.active ? 'Switch off' : 'Switch on'}</button>
    <button class="btn sm danger" data-del="${s.id}">Delete</button>
  </div>
</li>`;

function staffTab() {
  const s = editing && staffById(editing);
  return `
    <form class="dash-card" id="staff-form">
      <h2>${s ? 'Edit ' + esc(s.name) : 'Add staff member'}</h2>
      <div class="two">
        <label class="field"><span>Name</span><input name="name" required value="${esc(s?.name)}" autocomplete="off"></label>
        <label class="field"><span>Mobile number</span><input name="phone" required inputmode="tel" value="${esc(s?.phone)}" placeholder="10-digit mobile" autocomplete="off"></label>
      </div>
      <label class="field"><span>${s ? 'New PIN (leave empty to keep the old one)' : 'Login PIN (4–8 digits)'}</span>
        <input name="pin" inputmode="numeric" pattern="\\d{4,8}" ${s ? '' : 'required'} autocomplete="off"></label>
      <div class="row"><button class="btn btn-gold">${s ? 'Save changes' : 'Add staff'}</button>${s ? '<button type="button" class="btn btn-ghost" data-cancel>Cancel</button>' : ''}</div>
      <p class="form-msg" id="staff-msg"></p>
    </form>
    <ul class="staff-list">${feed.staff.map(staffCard).join('') || empty('No staff added yet.')}</ul>`;
}

/* ---------- Settings tab (owner) ---------- */
function settingsTab() {
  if (!ownerName) RJ.rpc('rj_owner_info', { p_token: token() }).then(r => { ownerName = r.username; const u = $('#acct-form [name=user]'); if (u && !u.value) u.value = ownerName; }).catch(() => {});
  const staffUrl = new URL('staff.html', location.href).href;
  return `
    <form class="dash-card" id="acct-form">
      <h2>Owner login</h2>
      <label class="field"><span>Username</span><input name="user" required value="${esc(ownerName)}" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
      <label class="field"><span>New password (leave empty to keep the current one)</span><input name="newpass" type="password" minlength="6" autocomplete="new-password"></label>
      <label class="field"><span>Current password (to confirm)</span><input name="oldpass" type="password" required autocomplete="current-password"></label>
      <button class="btn btn-gold">Save login</button>
      <p class="form-msg" id="acct-msg"></p>
    </form>
    <div class="dash-card">
      <h2>How it works</h2>
      <ol class="how">
        <li>Add each staff member in the <b>Staff</b> tab with their mobile number and a PIN.</li>
        <li>They log in at <a href="${staffUrl}">${esc(staffUrl)}</a>, open the store and tap <b>Share to Status</b> on any piece — or copy a link / download a photo from their <b>Products</b> tab.</li>
        <li>When a customer taps that link, it shows up here and on that staff member's dashboard. Orders sent from that visit are tagged with the staff code.</li>
        <li>You and your staff can add pieces in the <b>Products</b> tab; they go live on the store straight away. You can edit, hide or delete any piece; staff can edit or delete only the ones they added.</li>
        <li>Keep this page open (or add it to your home screen) and turn on alerts to get a sound and notification for each click.</li>
      </ol>
    </div>`;
}

/* ---------- Render ---------- */
function render(fromPoll) {
  if (!feed) return;
  // polling only refreshes the activity tab, and never while the user is typing or choosing
  if (fromPoll && (tab !== 'activity' || document.activeElement?.closest('#app select, #app input, #app textarea'))) return updateTitle();
  const nav = `<nav class="tabs">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'staff' ? ` (${feed.staff.length})` : ''}</button>`).join('')}</nav>`;
  $('#app').innerHTML = nav + ({ activity: activityTab, products: productsTab, staff: staffTab, settings: settingsTab })[tab]();
  if (tab === 'products') renderProdList();
  updateTitle();
}
function updateTitle() { const n = unseenCount(); document.title = n ? `(${n}) ${BASE_TITLE}` : BASE_TITLE; }
function markSeen(quiet) { if (!feed) return; seen = Math.max(seen, alerted); RJ.ls.set(SEEN_KEY, seen); render(quiet); }

/* ---------- Loading & alerts ---------- */
async function load(fromPoll) {
  try {
    const data = await RJ.rpc(OWNER ? 'rj_owner_feed' : 'rj_staff_feed', { p_token: token() });
    const fresh = data.events.filter(e => e.id > alerted);
    if (feed && fresh.length) notify(fresh);
    else if (!feed) { const missed = data.events.filter(e => e.id > seen).length; if (missed) toast(`${missed} new click${missed === 1 ? '' : 's'} since your last visit`); }
    alerted = Math.max(alerted, 0, ...data.events.map(e => e.id));
    feed = data;
    if (!OWNER) RJ.ls.set('rj-staff', { ...RJ.staff(), ...data.staff });
    render(fromPoll);
  } catch (err) {
    if (err.message === 'logged_out') return logout('Your session ended — please log in again');
    if (!fromPoll) toast(err.message);
  }
}

function notify(events) {
  chime();
  const e = events[0];
  const title = events.length > 1 ? `${events.length} new customer clicks` : e.kind === 'order' ? '🛍️ New order from a status link' : '👀 A customer opened a link';
  const body = events.slice(0, 3).map(x => plain(x) + (OWNER ? ` — via ${x.staff_name} (${fmtPhone(x.staff_phone)})` : '')).join('\n');
  toast(title);
  if (window.Notification?.permission !== 'granted') return;
  const opts = { body, icon: 'icon.svg', badge: 'icon.svg', tag: 'rj-click', renotify: true, data: { url: location.href } };
  const fallback = () => { try { new Notification(title, opts); } catch { /* not allowed outside a service worker */ } };
  navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(title, opts) : fallback()).catch(fallback) : fallback();
}

let audio;
function chime() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * .18;
      o.frequency.value = freq; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
      o.start(t); o.stop(t + .5);
    });
  } catch { /* no audio */ }
}
// browsers only allow sound after the first tap
addEventListener('pointerdown', () => { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch { /* no audio */ } }, { once: true });

async function enableAlerts() {
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Alerts are on — keep this page open' : 'Alerts were not allowed');
  if (p === 'granted') chime();
  render();
}

/* ---------- Session ---------- */
function show() {
  const signedIn = !!token();
  $('#login').hidden = signedIn;
  $('#app').hidden = !signedIn;
  $$('[data-logout]').forEach(b => b.hidden = !signedIn);
  clearInterval(timer);
  feed = null; products = null; alerted = 0; tab = 'activity'; ownerName = '';
  if (!signedIn) return;
  $('#app').innerHTML = '<p class="muted center">Loading…</p>';
  load();
  timer = setInterval(() => load(true), POLL_MS);
}
function logout(message) {
  OWNER ? RJ.setOwner(null) : RJ.logout();
  show();
  if (message) toast(message);
}

let toastTimer;
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

const loginInvite = (name, phone, pin) => `https://wa.me/91${phone}?text=` + encodeURIComponent(
  `Hi ${name}, you can now share ${STORE.name} jewellery on your WhatsApp status.\n\nLogin: ${new URL('staff.html', location.href).href}\nNumber: ${phone}\nPIN: ${pin}\n\nAfter logging in, open the store and tap "Share to Status" on any piece. You'll see every customer who opens your link.`);
const sessionEnded = err => err.message === 'logged_out' && (logout('Your session ended — please log in again'), true);

/* ---------- Events ---------- */
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, msg = $('#login-msg'), btn = $('button', f);
  msg.textContent = ''; btn.disabled = true;
  try {
    if (OWNER) RJ.setOwner((await RJ.rpc('rj_owner_login', { p_user: f.user.value, p_pass: f.pass.value })).token);
    else await RJ.login(f.phone.value, f.pin.value);
    f.reset();
    show();
  } catch (err) { msg.textContent = err.message; }
  btn.disabled = false;
});

document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id === 'staff-form') {
    e.preventDefault();
    const s = editing && staffById(editing), pin = f.pin.value.trim() || null;
    const name = f.name.value.trim(), phone = f.phone.value.replace(/\D/g, '').slice(-10);
    try {
      await RJ.rpc('rj_owner_save_staff', { p_token: token(), p_id: s?.id || null, p_name: name, p_phone: phone, p_pin: pin, p_active: s ? s.active : true });
      editing = null;
      await load();
      $('#staff-msg').innerHTML = pin
        ? `${s ? 'Saved' : 'Added'} ${esc(name)}. <a target="_blank" rel="noopener" href="${loginInvite(name, phone, pin)}">Send them the login on WhatsApp →</a>`
        : `Saved ${esc(name)}.`;
    } catch (err) { if (!sessionEnded(err)) $('#staff-msg').textContent = err.message; }
  }

  if (f.id === 'prod-form') {
    e.preventDefault();
    const msg = $('#prod-msg'), btn = $('button', f), file = f.photo.files[0];
    const p = prodEditing === 'new' ? null : prodById(prodEditing);
    btn.disabled = true; msg.textContent = '';
    try {
      if (!file && !p?.img) throw new Error('Add a photo of the piece');
      let img = p?.img || '';
      if (file) { msg.textContent = 'Uploading photo…'; img = await RJ.uploadPhoto(token(), file); }
      msg.textContent = 'Saving…';
      const num = v => v.replace(/[^\d.]/g, '');
      await RJ.rpc('rj_product_save', { p_token: token(), p_id: p?.id || null, p: {
        name: f.name.value, cat: f.cat.value, purity: f.purity.value.trim(), weight: f.weight.value.trim(),
        price: num(f.price.value), mrp: num(f.mrp.value), desc: f.desc.value.trim(), best: f.best.checked, img,
        sizes: f.sizes.value.split(',').map(x => x.trim()).filter(Boolean),
      } });
      prodEditing = null; products = null;
      toast(p ? 'Saved — the store is updated' : 'Added — it is live on the store');
      render();
    } catch (err) { if (!sessionEnded(err)) msg.textContent = err.message; }
    btn.disabled = false;
  }

  if (f.id === 'acct-form') {
    e.preventDefault();
    try {
      const r = await RJ.rpc('rj_owner_account', { p_token: token(), p_old_pass: f.oldpass.value, p_new_user: f.user.value, p_new_pass: f.newpass.value });
      RJ.setOwner(r.token); ownerName = r.username;
      f.oldpass.value = f.newpass.value = ''; f.user.value = r.username;
      $('#acct-msg').textContent = 'Saved. Use the new login next time — other devices are logged out.';
    } catch (err) { if (!sessionEnded(err)) $('#acct-msg').textContent = err.message; }
  }
});

async function call(fn, args, done, after) {
  try { await RJ.rpc(fn, { p_token: token(), ...args }); await after(); toast(done); }
  catch (err) { if (!sessionEnded(err)) toast(err.message); }
}
const reloadProducts = async () => { products = null; render(); };

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  const d = t.dataset;
  if ('logout' in d) return logout();
  if ('alerts' in d) return enableAlerts();
  if ('seen' in d) return markSeen();
  if (d.tab) { tab = d.tab; editing = null; prodEditing = null; render(); return scrollTo({ top: 0 }); }
  if (d.edit) { editing = d.edit; render(); return $('#staff-form').scrollIntoView({ behavior: 'smooth' }); }
  if ('cancel' in d) { editing = null; return render(); }
  if (d.toggle) {
    const s = staffById(d.toggle);
    return call('rj_owner_save_staff', { p_id: s.id, p_name: s.name, p_phone: s.phone, p_pin: null, p_active: !s.active }, `${s.name} switched ${s.active ? 'off' : 'on'}`, load);
  }
  if (d.del) {
    const s = staffById(d.del);
    if (confirm(`Delete ${s.name}? Their click history is deleted too.\nTip: "Switch off" stops their links but keeps the history.`)) call('rj_owner_delete_staff', { p_id: s.id }, `${s.name} deleted`, load);
    return;
  }
  // products
  if ('prodnew' in d) { prodEditing = 'new'; return render(); }
  if ('prodcancel' in d) { prodEditing = null; return render(); }
  if (d.pedit) { prodEditing = d.pedit; render(); return $('#prod-form').scrollIntoView({ behavior: 'smooth' }); }
  if (d.pact) return RJ.act(d.pact, prodById(d.pid), toast);
  if (d.phide) {
    const p = prodById(d.phide);
    return call('rj_product_active', { p_id: p.id, p_active: !p.active }, p.active ? `${p.name} hidden from the store` : `${p.name} is back on the store`, reloadProducts);
  }
  if (d.pdel) {
    const p = prodById(d.pdel);
    if (confirm(`Delete "${p.name}" from the store?${OWNER ? '\nTip: "Hide" takes it off the store but keeps it here.' : ''}`)) call('rj_product_delete', { p_id: p.id }, `${p.name} deleted`, reloadProducts);
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'staff-filter') { staffFilter = e.target.value; render(); }
  if (e.target.name === 'photo' && e.target.files[0]) {
    const img = $('#photo-preview');
    img.src = URL.createObjectURL(e.target.files[0]); img.hidden = false;
    $('.photo-box em').textContent = 'Tap to change photo';
  }
});
document.addEventListener('input', e => { if (e.target.id === 'prod-q') { prodQuery = e.target.value; renderProdList(); } });
document.addEventListener('visibilitychange', () => {
  if (!token()) return;
  if (document.hidden) markSeen(true); else load(true);   // quiet: never wipe a half-filled form
});

/* ---------- Boot ---------- */
$$('[data-store]').forEach(el => { el.textContent = STORE[el.dataset.store]; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
if (RJ.ready) show(); else $('#setup-note').hidden = false;
