/* Staff referral links, product photos & sharing — shared by the store, staff.html and admin.html.
   Talks to Supabase through the rj_* functions in supabase/setup.sql. Keys live in data.js → BACKEND. */

const RJ = (() => {
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const ready = !!(BACKEND.url && BACKEND.key);
  const REF_DAYS = 30;                             // an order within this many days still counts for the staff member
  const base = () => BACKEND.url.replace(/\/+$/, '');
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

  function headers(extra) {
    const h = { apikey: BACKEND.key, ...extra };
    if (BACKEND.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + BACKEND.key; // legacy anon JWT key
    return h;
  }
  async function rpc(fn, args = {}) {
    if (!ready) throw new Error('Staff sharing is not set up yet — add the Supabase keys in js/data.js');
    const res = await fetch(`${base()}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(args), keepalive: true });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `Server error (${res.status})`);
    if (data?.error) throw new Error(data.error);
    return data;
  }

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const device = () => isIOS ? 'iPhone' : /Android/i.test(ua) ? 'Android' : 'Computer';
  function visitor() {
    let v = ls.get('rj-visitor', '');
    if (!v) { v = crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36); ls.set('rj-visitor', v); }
    return v;
  }
  const staff = () => ls.get('rj-staff', null);
  const track = (ref, kind, productId, productName, detail = null) =>
    rpc('rj_track', { p_ref: ref, p_kind: kind, p_product_id: productId, p_product_name: productName, p_visitor: visitor(), p_device: device(), p_detail: detail });

  /* Link to a piece. Logged-in staff get their ref code added so clicks are credited to them. */
  function shareUrl(productId) {
    const u = new URL(location.pathname.replace(/[^/]*$/, ''), location.origin);
    if (productId) u.searchParams.set('p', productId);
    if (staff()) u.searchParams.set('ref', staff().ref);
    return u.href;
  }
  const caption = p => `✨ *${p.name}*\n${p.purity}${p.weight ? ' · ' + p.weight : ''}\n*${inr(p.price)}*${p.mrp > p.price ? ` ~${inr(p.mrp)}~ (${Math.round((1 - p.price / p.mrp) * 100)}% off)` : ''}\n\nView & order 👉 ${shareUrl(p.id)}`;

  /* Product photo as a File, kept so a second tap shares instantly (phones only allow sharing right after a tap) */
  const files = new Map();
  async function photoFile(p) {
    if (!p.img) throw new Error('This piece has no photo yet');
    if (!files.has(p.img)) {
      const blob = await (await fetch(p.img)).blob();
      const name = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || p.id;
      files.set(p.img, new File([blob], `${name}.jpg`, { type: blob.type || 'image/jpeg' }));
    }
    return files.get(p.img);
  }

  const actions = {
    async share(p) {
      const text = caption(p);
      navigator.clipboard?.writeText(text).catch(() => {});
      const file = p.img && navigator.canShare ? await photoFile(p) : null;
      if (file && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text });
      else if (navigator.share) await navigator.share({ text });
      else { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return ''; }
      return 'Caption with your link is copied — paste it if WhatsApp drops it';
    },
    async copy(p) {
      const url = shareUrl(p.id);
      try { await navigator.clipboard.writeText(url); return 'Link copied'; } catch { prompt('Copy this link', url); return ''; }
    },
    async download(p) {
      const file = await photoFile(p);
      if (isIOS && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return ''; } // iPhone: "Save Image"
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      return 'Photo downloaded';
    },
  };

  /* Phone photo → JPEG at most 1400px, so uploads are quick and the store stays fast */
  async function shrink(file, max = 1400) {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { throw new Error('This photo type is not supported — use a JPG or PNG'); }
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('Could not read the photo')), 'image/jpeg', .85));
  }

  return {
    ready, rpc, ls, staff, shareUrl, caption,
    async login(phone, pin) { const s = await rpc('rj_staff_login', { p_phone: phone, p_pin: pin }); ls.set('rj-staff', s); return s; },
    logout() { ls.set('rj-staff', null); },
    owner: () => ls.get('rj-owner', null),
    setOwner(token) { ls.set('rj-owner', token); },

    /* share | copy | download a piece; messages go to the page's toast */
    async act(kind, p, toast) {
      if (!p) return;
      try { const msg = await actions[kind](p); if (msg) toast(msg); }
      catch (e) {
        if (e.name === 'AbortError') return;
        if (e.name === 'NotAllowedError') return toast('Photo ready — tap again');
        toast(e.message || 'Something went wrong');
      }
    },

    products: () => rpc('rj_products_list'),
    async uploadPhoto(token, file) {
      const [{ ticket }, blob] = await Promise.all([rpc('rj_upload_ticket', { p_token: token }), shrink(file)]);
      const path = `${ticket}/${Date.now().toString(36)}.jpg`;
      const res = await fetch(`${base()}/storage/v1/object/rj-products/${path}`, { method: 'POST', headers: headers({ 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }), body: blob });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'Photo upload failed');
      return `${base()}/storage/v1/object/public/rj-products/${path}`;
    },

    /* Customer arrived through a staff link: remember the referrer and log the click */
    landing(ref, productId, productName) {
      ref = (ref || '').toUpperCase();
      if (!ready || !ref || ref === staff()?.ref) return;
      ls.set('rj-ref', { ref, at: Date.now() });
      track(ref, 'view', productId || null, productName || 'Store home page').catch(() => {});
    },
    referral() { const r = ls.get('rj-ref', null); return r && Date.now() - r.at < REF_DAYS * 864e5 ? r.ref : null; },
    orderPlaced(ref, productId, productNames, detail) { if (ready && ref) track(ref, 'order', productId, productNames, detail).catch(() => {}); },
  };
})();
