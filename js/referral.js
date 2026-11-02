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

  /* Photo → JPEG at most 1400px, so uploads are quick and the store stays fast.
     JPG is the main format; PNG/WebP are converted to JPG too. */
  const PHOTO_TYPES = /^image\/(jpe?g|pjpeg|png|webp)$/i;
  const PHOTO_EXT = /\.(jpe?g|jfif|png|webp)$/i;
  const MAX_RAW = 3 * 1024 * 1024;                 // storage limit for a photo sent without resizing
  const isJpg = f => /^image\/(jpe?g|pjpeg)$/i.test(f.type) || /\.(jpe?g|jfif)$/i.test(f.name);
  function checkPhoto(file) {
    if (!file) return 'Choose a photo';
    if (!PHOTO_TYPES.test(file.type) && !PHOTO_EXT.test(file.name)) return 'Please choose a JPG photo (.jpg / .jpeg)';
    if (file.size > 25 * 1024 * 1024) return 'This photo is too big (over 25 MB) — choose a smaller JPG';
    return '';
  }
  function decode(file) {                          // fallback for browsers without createImageBitmap
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { ok(im); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      im.onerror = () => { URL.revokeObjectURL(url); no(new Error('decode')); };
      im.src = url;
    });
  }
  async function shrink(file, max = 1400) {
    const bad = checkPhoto(file); if (bad) throw new Error(bad);
    let pic;
    try { pic = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { try { pic = await decode(file); } catch { pic = null; } }
    if (!pic) {
      if (isJpg(file) && file.size <= MAX_RAW) return file;      // can't resize here, but the JPG itself is fine to upload
      throw new Error('Could not open this photo — please choose a JPG photo');
    }
    const w = pic.width || pic.naturalWidth, h = pic.height || pic.naturalHeight;
    const s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);   // transparent PNGs get a white background, not black
    g.drawImage(pic, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', .85));
    if (blob) return blob;
    if (isJpg(file) && file.size <= MAX_RAW) return file;
    throw new Error('Could not read the photo — please try another JPG');
  }
  function uploadError(status, body) {
    const m = (body?.message || body?.error || '').toLowerCase();
    if (m.includes('bucket') && m.includes('not found')) return 'Photo storage is not set up — run supabase/setup.sql in Supabase once';
    if (m.includes('row-level security') || m.includes('policy') || status === 403) return 'Upload not allowed — log out, log in again and retry (if it repeats, re-run supabase/setup.sql)';
    if (m.includes('size') || status === 413) return 'Photo is too big — choose a smaller JPG';
    if (m.includes('mime') || m.includes('type')) return 'Please choose a JPG photo';
    return body?.message || `Photo upload failed (${status}) — check the internet and try again`;
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
    checkPhoto,
    async uploadPhoto(token, file) {
      const [{ ticket }, blob] = await Promise.all([rpc('rj_upload_ticket', { p_token: token }), shrink(file)]);
      const path = `${ticket}/${Date.now().toString(36)}.jpg`;
      let res;
      try {
        res = await fetch(`${base()}/storage/v1/object/rj-products/${path}`, { method: 'POST', headers: headers({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' }), body: blob });
      } catch { throw new Error('No internet — photo not uploaded. Try again'); }
      if (!res.ok) throw new Error(uploadError(res.status, await res.json().catch(() => null)));
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
